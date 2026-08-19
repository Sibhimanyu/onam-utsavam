/* Client for the Catalyst quiz_api function.

   Plain fetch() only — deliberately NOT the Catalyst Web SDK, because the
   assignment forbids external JavaScript libraries and the SDK is one.

   Every call resolves to null on failure rather than throwing, so callers can
   degrade instead of crashing. The solo quiz treats null as "hide the
   leaderboard"; the live screens surface it as a visible retry, because a live
   leaderboard that silently vanishes is worse than one that says it's stuck. */

const Api = (() => {
  /* Absolute URL is mandatory. Slate serves from *.onslate.in while functions
     live on *.catalystserverless.in — a relative "/server/..." path does not
     error, it hits Slate's own fallback and returns index.html with status 200,
     so fetch "succeeds" and JSON.parse explodes somewhere unrelated.

     Note the .in TLD: this is the IN data center. Every doc example says
     .catalystserverless.com, which silently fails here. The /execute suffix is
     also required — the URL printed by `catalyst deploy` omits it and 404s. */
  const isLocal = ['localhost', '127.0.0.1', ''].includes(location.hostname);

  const BASE = isLocal
    ? 'http://localhost:3000/server/quiz_api/execute'
    : 'https://onam-utsavam-60083782173.development.catalystserverless.in/server/quiz_api/execute';

  const TIMEOUT_MS = 6000;

  async function call(path, options) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(BASE + path, { ...options, signal: controller.signal });
      const text = await res.text();
      // Guard against the Slate-fallback-HTML case described above.
      if (!text || text.trim().startsWith('<')) return null;
      const body = JSON.parse(text);
      if (!res.ok) return null;
      return body;
    } catch (err) {
      return null;              // offline, aborted, 404, bad JSON — all the same here
    } finally {
      clearTimeout(timer);
    }
  }

  const postJson = (path, payload) => call(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  return {
    // --- host ---
    openSession()        { return postJson('/session/open', {}); },
    closeSession(code)   { return postJson('/session/close', { code }); },
    board(code)          { return call('/board?code=' + encodeURIComponent(code), { method: 'GET' }); },

    // --- participant ---
    currentSession()     { return call('/session/current', { method: 'GET' }); },
    join(code, name, total) { return postJson('/join', { code, name, total }); },
    updateScore(rowid, score, answered, total) {
      return postJson('/score', { rowid, score, answered, total });
    },

    // --- solo mode (the graded flow) ---
    soloBoard()                  { return call('/', { method: 'GET' }); },
    soloSubmit(name, score, total) { return postJson('/', { name, score, total }); }
  };
})();
