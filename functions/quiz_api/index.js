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

function sendJson(res, statusCode, data) {
  /* Only Content-Type. CORS comes from Authorized Domains at the gateway;
     setting Access-Control-Allow-Origin here too produces a duplicated header
     that every browser rejects. Localhost is handled separately below. */
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
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
  return rows.map(r => r[table]).filter(Boolean);
}

async function board(app, code) {
  const zcql = app.zcql();
  /* No AS aliases — ZCQL silently drops them and returns the original column
     name. Well inside the 300-row ZCQL ceiling. */
  const rows = await zcql.executeZCQLQuery(
    `SELECT player_name, score, answered, total FROM ${T_PLAYERS} ` +
    `WHERE session_code = '${code}' ORDER BY score DESC LIMIT 0, ${BOARD_LIMIT}`
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
  // Manual CORS for local dev only. Production origins are covered by
  // Authorized Domains and must NOT get headers here.
  const origin = req.headers.origin || '';
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
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
      const code = newCode();
      await app.datastore().table(T_SESSIONS).insertRow({
        session_code: code,
        session_status: 'open'
      });
      return sendJson(res, 201, { code: code });
    }

    // ---- host: close a session ----
    if (method === 'POST' && path === '/session/close') {
      const body = await readBody(req);
      const code = safeCode(body.code);
      if (!code) return sendJson(res, 400, { error: 'bad code' });
      await app.zcql().executeZCQLQuery(
        `UPDATE ${T_SESSIONS} SET session_status = 'closed' WHERE session_code = '${code}'`
      );
      return sendJson(res, 200, { ok: true, top: await board(app, code) });
    }

    // ---- joiner: which session is live? ----
    if (method === 'GET' && path === '/session/current') {
      return sendJson(res, 200, { code: await currentSession(app) });
    }

    // ---- joiner: claim a slot, get a rowid to update ----
    if (method === 'POST' && path === '/join') {
      const body = await readBody(req);
      const code = safeCode(body.code);
      if (!code) return sendJson(res, 400, { error: 'bad code' });
      const row = await app.datastore().table(T_PLAYERS).insertRow({
        session_code: code,
        player_name: cleanName(body.name),
        score: 0,
        answered: 0,
        total: Number(body.total) || 10
      });
      return sendJson(res, 201, { rowid: row.ROWID });
    }

    // ---- joiner: update my score after each answer ----
    if (method === 'POST' && path === '/score') {
      const body = await readBody(req);
      const rowid = String(body.rowid || '');
      if (!/^\d+$/.test(rowid)) return sendJson(res, 400, { error: 'bad rowid' });

      const total = Number(body.total);
      const score = Number(body.score);
      const answered = Number(body.answered);
      if (!Number.isInteger(total) || total < 1 || total > 100) {
        return sendJson(res, 400, { error: 'bad total' });
      }
      if (!Number.isInteger(score) || score < 0 || score > total) {
        return sendJson(res, 400, { error: 'score out of range' });
      }
      if (!Number.isInteger(answered) || answered < score || answered > total) {
        return sendJson(res, 400, { error: 'answered out of range' });
      }

      await app.datastore().table(T_PLAYERS).updateRow({
        ROWID: rowid, score: score, answered: answered
      });
      return sendJson(res, 200, { ok: true });
    }

    // ---- dashboard: leaderboard for a session ----
    if (method === 'GET' && path === '/board') {
      const code = safeCode(query.code);
      if (!code) return sendJson(res, 400, { error: 'bad code' });
      return sendJson(res, 200, { top: await board(app, code) });
    }

    // ---- solo mode: single-player board, kept for the graded flow ----
    if (method === 'GET' && path === '/') {
      return sendJson(res, 200, { top: await board(app, SOLO) });
    }

    if (method === 'POST' && path === '/') {
      const body = await readBody(req);
      const total = Number(body.total);
      const score = Number(body.score);
      if (!Number.isInteger(total) || total !== 10) {
        return sendJson(res, 400, { error: 'total must be 10' });
      }
      if (!Number.isInteger(score) || score < 0 || score > total) {
        return sendJson(res, 400, { error: 'score out of range' });
      }
      await app.datastore().table(T_PLAYERS).insertRow({
        session_code: SOLO,
        player_name: cleanName(body.name),
        score: score,
        answered: total,
        total: total
      });
      return sendJson(res, 201, { top: await board(app, SOLO) });
    }

    return sendJson(res, 404, { error: 'no such route', path: path });
  } catch (err) {
    console.error('quiz_api failed:', err);
    return sendJson(res, 500, { error: err.message });
  }
};
