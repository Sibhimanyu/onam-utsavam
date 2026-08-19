/* Leaderboard client for the Catalyst quiz_api function.

   Plain fetch() only — deliberately NOT the Catalyst Web SDK, because the
   assignment forbids external JavaScript libraries and the SDK is one.

   Everything here fails soft. If the network is down, the function isn't
   deployed, or the Data Store table doesn't exist yet, every call resolves to
   null and the results screen simply hides the leaderboard. The graded
   experience never depends on the backend. */

const Leaderboard = (() => {
  /* Absolute URL is mandatory. Slate serves from *.onslate.in while functions
     live on *.catalystserverless.com — a relative "/server/..." path does not
     error, it hits Slate's own fallback and returns index.html with status 200,
     so fetch "succeeds" and JSON.parse explodes somewhere unrelated.
     The /execute suffix is also required; the URL printed by `catalyst deploy`
     omits it and 404s exactly as shown. */
  const LOCAL_HOSTS = ['localhost', '127.0.0.1', ''];
  const isLocal = LOCAL_HOSTS.includes(location.hostname);

  const API = isLocal
    ? 'http://localhost:3000/server/quiz_api/execute'
    : 'https://onam-utsavam-60083782173.development.catalystserverless.com/server/quiz_api/execute';

  const TIMEOUT_MS = 4000;

  async function call(options) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(API, { ...options, signal: controller.signal });
      if (!res.ok) return null;
      const text = await res.text();
      // Guard against the Slate-fallback-HTML case described above.
      if (!text || text.trim().startsWith('<')) return null;
      const body = JSON.parse(text);
      return Array.isArray(body.top) ? body.top : null;
    } catch (err) {
      return null;                       // offline, aborted, 404, bad JSON — all the same to us
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    /* Returns an array of {player_name, score, total} or null. */
    fetchTop() {
      return call({ method: 'GET' });
    },

    /* Submits a score and returns the refreshed top 10, or null. */
    submit(name, score, total) {
      return call({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, score, total })
      });
    }
  };
})();
