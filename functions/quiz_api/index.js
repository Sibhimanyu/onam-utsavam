'use strict';

/* quiz_api — Advanced I/O (node24)
 *
 * Live-event backend for the Onam pookalam quiz. The host opens a session, the
 * audience joins by scanning a static QR, and the host dashboard polls a
 * leaderboard that climbs as people answer.
 *
 * Routes (the /execute prefix is stripped before matching):
 *   POST /session/open              -> { code }            host starts a round
 *   POST /session/close  {code}     -> { ok }               host freezes the board
 *   GET  /session/current           -> { code | null }      what a joiner attaches to
 *   GET  /session/status?code=XXXX  -> { status }            open|closed|gone for one code
 *   POST /join    {code, name}      -> { rowid }            claim a slot
 *   POST /score   {rowid, score, answered, total} -> { ok } per-answer update
 *   GET  /board?code=XXXX           -> { top: [...] }       leaderboard
 *   GET  /                          -> { top: [...] }       solo-mode board (SOLO bucket)
 *
 * SECURITY NOTE, stated openly: Catalyst creates functions with Security Rules
 * `authentication: optional`, so every route here is publicly invocable. Anyone
 * who finds the URL can post a fake score or close your session. That is an
 * accepted tradeoff — requiring auth would force the Catalyst Web SDK into the
 * frontend, and the assignment forbids external JavaScript libraries. The
 * session code acts as a weak shared secret and all input is validated below.
 */

const catalyst = require('zcatalyst-sdk-node');

const T_PLAYERS = 'Pookalam_Scores';
const T_SESSIONS = 'Quiz_Sessions';
const MAX_NAME = 40;
const BOARD_LIMIT = 50;
const SOLO = 'SOLO';

/* Unambiguous alphabet — no O/0 or I/1, because this gets read off a projector
   and typed by hand when a camera won't focus. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LEN = 4;

/* ⚠️ CORS: PICK EXACTLY ONE MECHANISM. Catalyst offers two and they are mutually
   exclusive — using both yields two Access-Control-Allow-Origin values, which
   every browser rejects with a CORS error that misleadingly looks like the
   origin is wrong.

   This function uses Option 2, explicit headers below, because the gateway was
   verified to inject NOTHING for the Slate origin: a request carrying
   `Origin: https://onam-quiz-tegpgzpi.onslate.in` returned 200 with no
   access-control-* header at all, so the browser discarded every response while
   curl saw success.

   >>> Therefore: do NOT add the Slate domain under Authentication → Authorized
   >>> Domains. If you ever do, delete this block in the same change. <<< */
const ALLOWED_ORIGINS = [
  'https://onam-quiz-tegpgzpi.onslate.in'
];

function corsOrigin(req) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return null;
}

function sendJson(res, statusCode, data, origin) {
  const headers = { 'Content-Type': 'application/json' };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }
  res.writeHead(statusCode, headers);
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    if (req.body && typeof req.body === 'string') {
      try { return resolve(JSON.parse(req.body)); } catch (e) { return resolve({}); }
    }
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { resolve({}); }
    });
    req.on('error', reject);
  });
}

/* ZCQL has NO parameter binding — every query below is built by string
   concatenation. So anything interpolated must be whitelisted to a known-safe
   shape, not merely escaped. A code that fails this check is rejected outright. */
function safeCode(raw) {
  const code = String(raw == null ? '' : raw).toUpperCase().trim();
  return /^[A-Z0-9]{1,8}$/.test(code) ? code : null;
}

function newCode() {
  let out = '';
  for (let i = 0; i < CODE_LEN; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

/* Data Store silently stores 4-byte UTF-8 as "?", so an emoji in a name would
   land as "Sibhi ?". Strip before insert. */
function cleanName(raw) {
  const name = String(raw == null ? '' : raw)
    .replace(/[\u{10000}-\u{10FFFF}]/gu, '')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .slice(0, MAX_NAME);
  return name || 'Anonymous';
}

/* Raw ZCQL rows arrive wrapped under the table-name key. Forgetting this unwrap
   is the single most common Data Store bug. */
function unwrap(rows, table) {
  return (rows || []).map(r => r[table]).filter(Boolean);
}

async function board(app, code) {
  const zcql = app.zcql();
  /* No AS aliases — ZCQL silently drops them and returns the original column
     name. Well inside the 300-row ZCQL ceiling. */
  /* ORDER BY score alone leaves ties in an undefined order that can reorder
     between two 3s polls — visible flicker on the projector. The extra keys make
     it deterministic AND meaningful: on equal score, whoever answered more ranks
     higher, and ROWID (join order) is the final, stable tiebreak. */
  const rows = await zcql.executeZCQLQuery(
    `SELECT player_name, score, answered, total FROM ${T_PLAYERS} ` +
    `WHERE session_code = '${code}' ` +
    `ORDER BY score DESC, answered DESC, ROWID ASC LIMIT 0, ${BOARD_LIMIT}`
  );
  return unwrap(rows, T_PLAYERS);
}

async function currentSession(app) {
  const rows = await app.zcql().executeZCQLQuery(
    `SELECT session_code, session_status FROM ${T_SESSIONS} ` +
    `WHERE session_status = 'open' ORDER BY ROWID DESC LIMIT 0, 1`
  );
  const list = unwrap(rows, T_SESSIONS);
  return list.length ? list[0].session_code : null;
}

module.exports = async (req, res) => {
  const origin = corsOrigin(req);

  /* Preflight. The browser sends OPTIONS before any POST carrying
     Content-Type: application/json, and blocks the real request if this
     does not answer with the right headers. */
  if (req.method === 'OPTIONS') {
    const headers = { 'Content-Length': '0' };
    if (origin) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
      headers['Access-Control-Allow-Headers'] = 'Content-Type';
      headers['Access-Control-Max-Age'] = '86400';
      headers['Vary'] = 'Origin';
    }
    res.writeHead(204, headers);
    return res.end();
  }

  try {
    /* Admin scope: the App User role has INSERT/UPDATE off by default, so a
       user-scope write returns "No privileges to perform this action". */
    const app = catalyst.initialize(req, { scope: 'admin' });

    /* req.url arrives WITH the /execute prefix — a call to .../execute/board
       shows up as '/execute/board'. Without this strip, every route below
       misses and everything 404s. */
    const parsed = new URL(req.url, `https://${req.headers.host}`);
    const path = parsed.pathname.replace(/^\/execute/, '') || '/';
    const query = Object.fromEntries(parsed.searchParams);
    const method = req.method;

    // ---- host: open a session ----
    if (method === 'POST' && path === '/session/open') {
      /* Close any round still marked open before starting a new one.
         Without this, orphans accumulate: a host who forgets to close, or whose
         browser dies mid-round, leaves an 'open' row forever. Observed live —
         after closing session 2G7A, /session/current resurfaced 6GEM from an
         earlier test, so a joiner would have attached to a dead round.
         Invariant: at most one open session at any time, which matches the
         "one live round" mental model the host has. */
      await app.zcql().executeZCQLQuery(
        `UPDATE ${T_SESSIONS} SET session_status = 'closed' WHERE session_status = 'open'`
      );
      /* The code must be unique across ALL history, not just open rows.
         board() scopes players by session_code alone, and closed sessions live
         forever, so reusing a past code would merge that old round's players
         into this live board. Regenerate until the code is unused. The candidate
         is drawn from CODE_ALPHABET (⊂ [A-Z0-9]), so it is safe to interpolate.
         8 collisions across a 32^4 (~1M) space is astronomically unlikely; if it
         somehow happens we degrade to an unchecked code rather than loop forever. */
      let code = null;
      for (let attempt = 0; attempt < 8; attempt++) {
        const candidate = newCode();
        const existing = await app.zcql().executeZCQLQuery(
          `SELECT ROWID FROM ${T_SESSIONS} WHERE session_code = '${candidate}' LIMIT 0, 1`
        );
        if (!existing || existing.length === 0) { code = candidate; break; }
      }
      if (!code) code = newCode();
      await app.datastore().table(T_SESSIONS).insertRow({
        session_code: code,
        session_status: 'open'
      });
      return sendJson(res, 201, { code: code }, origin);
    }

    // ---- host: close a session ----
    if (method === 'POST' && path === '/session/close') {
      const body = await readBody(req);
      const code = safeCode(body.code);
      if (!code) return sendJson(res, 400, { error: 'bad code' }, origin);
      await app.zcql().executeZCQLQuery(
        `UPDATE ${T_SESSIONS} SET session_status = 'closed' WHERE session_code = '${code}'`
      );
      return sendJson(res, 200, { ok: true, top: await board(app, code) }, origin);
    }

    // ---- joiner: which session is live? ----
    if (method === 'GET' && path === '/session/current') {
      return sendJson(res, 200, { code: await currentSession(app) }, origin);
    }

    // ---- joiner: is MY session still live? ----
    /* A player mid-round polls this so a host "close" reaches their phone live,
       instead of them answering into a round nobody is watching. Scoped to their
       own code, not currentSession(), so opening a fresh round elsewhere still
       reads as 'closed' for the old one rather than resurfacing a stranger's. */
    if (method === 'GET' && path === '/session/status') {
      const code = safeCode(query.code);
      if (!code) return sendJson(res, 400, { error: 'bad code' }, origin);
      const rows = await app.zcql().executeZCQLQuery(
        `SELECT session_status FROM ${T_SESSIONS} ` +
        `WHERE session_code = '${code}' ORDER BY ROWID DESC LIMIT 0, 1`
      );
      const list = unwrap(rows, T_SESSIONS);
      const status = list.length ? list[0].session_status : 'gone';
      return sendJson(res, 200, { status: status }, origin);
    }

    // ---- joiner: claim a slot, get a rowid to update ----
    if (method === 'POST' && path === '/join') {
      const body = await readBody(req);
      const code = safeCode(body.code);
      if (!code) return sendJson(res, 400, { error: 'bad code' }, origin);
      /* Clamp total to the same [1,100] range /score enforces. Without this a
         garbage total would be stored and then surface in the "answered/total"
         board display and drive the progress bar out of bounds. */
      const joinTotal = Number(body.total);
      const total = (Number.isInteger(joinTotal) && joinTotal >= 1 && joinTotal <= 100)
        ? joinTotal : 10;
      const row = await app.datastore().table(T_PLAYERS).insertRow({
        session_code: code,
        player_name: cleanName(body.name),
        score: 0,
        answered: 0,
        total: total
      });
      return sendJson(res, 201, { rowid: row.ROWID }, origin);
    }

    // ---- joiner: update my score after each answer ----
    if (method === 'POST' && path === '/score') {
      const body = await readBody(req);
      const rowid = String(body.rowid || '');
      if (!/^\d+$/.test(rowid)) return sendJson(res, 400, { error: 'bad rowid' }, origin);

      const total = Number(body.total);
      const score = Number(body.score);
      const answered = Number(body.answered);
      if (!Number.isInteger(total) || total < 1 || total > 100) {
        return sendJson(res, 400, { error: 'bad total' }, origin);
      }
      if (!Number.isInteger(score) || score < 0 || score > total) {
        return sendJson(res, 400, { error: 'score out of range' }, origin);
      }
      if (!Number.isInteger(answered) || answered < score || answered > total) {
        return sendJson(res, 400, { error: 'answered out of range' }, origin);
      }

      await app.datastore().table(T_PLAYERS).updateRow({
        ROWID: rowid, score: score, answered: answered
      });
      return sendJson(res, 200, { ok: true }, origin);
    }

    // ---- dashboard: leaderboard for a session ----
    if (method === 'GET' && path === '/board') {
      const code = safeCode(query.code);
      if (!code) return sendJson(res, 400, { error: 'bad code' }, origin);
      return sendJson(res, 200, { top: await board(app, code) }, origin);
    }

    // ---- solo mode: single-player board, kept for the graded flow ----
    if (method === 'GET' && path === '/') {
      return sendJson(res, 200, { top: await board(app, SOLO) }, origin);
    }

    if (method === 'POST' && path === '/') {
      const body = await readBody(req);
      const total = Number(body.total);
      const score = Number(body.score);
      if (!Number.isInteger(total) || total !== 10) {
        return sendJson(res, 400, { error: 'total must be 10' }, origin);
      }
      if (!Number.isInteger(score) || score < 0 || score > total) {
        return sendJson(res, 400, { error: 'score out of range' }, origin);
      }
      await app.datastore().table(T_PLAYERS).insertRow({
        session_code: SOLO,
        player_name: cleanName(body.name),
        score: score,
        answered: total,
        total: total
      });
      return sendJson(res, 201, { top: await board(app, SOLO) }, origin);
    }

    return sendJson(res, 404, { error: 'no such route', path: path }, origin);
  } catch (err) {
    console.error('quiz_api failed:', err);
    return sendJson(res, 500, { error: err.message }, origin);
  }
};
