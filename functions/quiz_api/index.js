'use strict';

/* quiz_api — Advanced I/O (node24)
 *
 * GET  /server/quiz_api/execute                       -> { top: [...] }
 * POST /server/quiz_api/execute {name, score, total}  -> { top: [...] } after insert
 *
 * Advanced I/O rather than Basic I/O because Basic I/O returns a bare string
 * with no status codes or headers, and write() may only be called once — it
 * cannot carry JSON properly.
 *
 * SECURITY NOTE, stated openly: Catalyst creates functions with Security Rules
 * `authentication: optional`, so this endpoint is publicly invocable. Anyone who
 * finds the URL can POST a fake 10/10. That is an accepted tradeoff here —
 * setting `authentication: required` would force the Catalyst Web SDK into the
 * frontend, and the assignment forbids external JavaScript libraries. The
 * validation below limits the damage to "a plausible-looking score".
 */

const catalyst = require('zcatalyst-sdk-node');

const TABLE = 'Pookalam_Scores';
const MAX_NAME = 40;
const TOP_N = 10;

function sendJson(res, statusCode, data) {
  /* Only Content-Type. CORS is handled by Authorized Domains at the gateway:
     setting Access-Control-Allow-Origin here as well produces a duplicated
     header, which every browser rejects with a CORS error that looks like the
     origin is wrong when it isn't. Localhost is the one exception, below. */
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

/* Data Store silently stores 4-byte UTF-8 as "?", so "Sibhi <flower emoji>"
   would land as "Sibhi ?". Strip before insert. */
function stripEmoji(str) {
  return String(str).replace(/[\u{10000}-\u{10FFFF}]/gu, '');
}

function cleanName(raw) {
  const name = stripEmoji(raw == null ? '' : raw)
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .slice(0, MAX_NAME);
  return name || 'Anonymous';
}

async function fetchTop(app) {
  const zcql = app.zcql();
  /* No AS aliases — ZCQL silently drops them and returns the original column
     name. Well inside the 300-row ZCQL ceiling. */
  const result = await zcql.executeZCQLQuery(
    `SELECT player_name, score, total FROM ${TABLE} ORDER BY score DESC LIMIT 0, ${TOP_N}`
  );
  /* Raw ZCQL rows arrive wrapped under the table-name key — skipping this
     unwrap is the single most common Data Store bug. */
  return result.map(r => r[TABLE]).filter(Boolean);
}

module.exports = async (req, res) => {
  // Manual CORS for local dev only; production origins are covered by
  // Authorized Domains and must NOT get headers here.
  const origin = req.headers.origin || '';
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  }

  try {
    /* Admin scope: the App User role has INSERT off by default, so a
       user-scope write returns "No privileges to perform this action". */
    const app = catalyst.initialize(req, { scope: 'admin' });

    if (req.method === 'GET') {
      return sendJson(res, 200, { top: await fetchTop(app) });
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const score = Number(body.score);
      const total = Number(body.total);

      if (!Number.isInteger(total) || total !== 10) {
        return sendJson(res, 400, { error: 'total must be 10' });
      }
      if (!Number.isInteger(score) || score < 0 || score > total) {
        return sendJson(res, 400, { error: 'score out of range' });
      }

      await app.datastore().table(TABLE).insertRow({
        player_name: cleanName(body.name),
        score: score,
        total: total
      });

      return sendJson(res, 201, { top: await fetchTop(app) });
    }

    return sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('quiz_api failed:', err);
    return sendJson(res, 500, { error: err.message });
  }
};
