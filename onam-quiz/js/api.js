/* Firebase Realtime Database adapter for the quiz.

   The former Catalyst function exposed an HTTP-shaped API. Keeping that small
   surface lets the quiz UI stay framework-free, while Realtime Database pushes
   leaderboard and session changes instead of polling every three seconds. */

const Api = (() => {
  const MAX_NAME = 40;
  const BOARD_LIMIT = 50;
  const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const CODE_LEN = 4;
  let db = null;
  let auth = null;

  try {
    const config = window.FIREBASE_CONFIG;
    if (!config || !config.apiKey || !config.databaseURL ||
        config.apiKey === 'local-development-only' && !window.FIREBASE_EMULATOR) {
      throw new Error('Firebase configuration is missing.');
    }
    firebase.initializeApp(config);
    db = firebase.database();
    auth = firebase.auth();
    if (window.FIREBASE_EMULATOR) {
      auth.useEmulator('http://127.0.0.1:9099', { disableWarnings: true });
      db.useEmulator('127.0.0.1', 9000);
    }
  } catch (err) {
    console.warn('Quiz storage is unavailable.', err);
  }

  function newCode() {
    let code = '';
    for (let i = 0; i < CODE_LEN; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    return code;
  }

  function safeCode(raw) {
    const code = String(raw == null ? '' : raw).toUpperCase().trim();
    return /^[A-Z0-9]{4}$/.test(code) ? code : null;
  }

  function cleanName(raw) {
    const name = String(raw == null ? '' : raw)
      .replace(/[\r\n\t]+/g, ' ')
      .trim()
      .slice(0, MAX_NAME);
    return name || 'Anonymous';
  }

  async function user() {
    if (!auth || !db) return null;
    if (auth.currentUser) return auth.currentUser;
    try {
      const credential = await auth.signInAnonymously();
      return credential.user;
    } catch (err) {
      return null;
    }
  }

  async function ready() {
    const currentUser = await user();
    return currentUser ? { db, user: currentUser } : null;
  }

  function rank(values) {
    return Object.keys(values || {}).map(id => ({ id, ...values[id] }))
      .sort((a, b) => Number(b.score) - Number(a.score) ||
        Number(b.answered) - Number(a.answered) ||
        Number(a.createdAt) - Number(b.createdAt))
      .slice(0, BOARD_LIMIT);
  }

  async function readBoard(path) {
    const service = await ready();
    if (!service) return null;
    try {
      const snapshot = await service.db.ref(path)
        .orderByChild('score')
        .limitToLast(BOARD_LIMIT)
        .once('value');
      return { top: rank(snapshot.val()) };
    } catch (err) {
      return null;
    }
  }

  async function unusedCode(service) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = newCode();
      const snapshot = await service.db.ref('sessions/' + code).once('value');
      if (!snapshot.exists()) return code;
    }
    return newCode();
  }

  return {
    async openSession() {
      const service = await ready();
      if (!service) return null;
      try {
        const code = await unusedCode(service);
        const liveSnapshot = await service.db.ref('live').once('value');
        const previous = liveSnapshot.val();
        const now = firebase.database.ServerValue.TIMESTAMP;
        const updates = {
          ['sessions/' + code]: {
            status: 'open',
            hostUid: service.user.uid,
            createdAt: now
          },
          live: { code, hostUid: service.user.uid, openedAt: now }
        };
        /* A host can replace its own abandoned round without allowing one host
           to close a different host's session. */
        if (previous && previous.code && previous.hostUid === service.user.uid) {
          updates['sessions/' + previous.code + '/status'] = 'closed';
        }
        await service.db.ref().update(updates);
        return { code };
      } catch (err) {
        return null;
      }
    },

    async closeSession(rawCode) {
      const code = safeCode(rawCode);
      const service = await ready();
      if (!code || !service) return null;
      try {
        const liveSnapshot = await service.db.ref('live').once('value');
        const updates = { ['sessions/' + code + '/status']: 'closed' };
        if (liveSnapshot.child('code').val() === code &&
            liveSnapshot.child('hostUid').val() === service.user.uid) {
          updates.live = null;
        }
        await service.db.ref().update(updates);
        return readBoard('players/' + code);
      } catch (err) {
        return null;
      }
    },

    async currentSession() {
      const service = await ready();
      if (!service) return null;
      try {
        const live = (await service.db.ref('live').once('value')).val();
        if (!live || !safeCode(live.code)) return { code: null };
        const status = (await service.db.ref('sessions/' + live.code + '/status').once('value')).val();
        return { code: status === 'open' ? live.code : null };
      } catch (err) {
        return null;
      }
    },

    async join(rawCode, rawName, rawTotal) {
      const code = safeCode(rawCode);
      const total = Number(rawTotal);
      const service = await ready();
      if (!code || !service || !Number.isInteger(total) || total < 1 || total > 100) return null;
      try {
        const session = await service.db.ref('sessions/' + code).once('value');
        if (session.child('status').val() !== 'open') return null;
        const row = service.db.ref('players/' + code).push();
        await row.set({
          uid: service.user.uid,
          player_name: cleanName(rawName),
          score: 0,
          answered: 0,
          total,
          createdAt: firebase.database.ServerValue.TIMESTAMP,
          updatedAt: firebase.database.ServerValue.TIMESTAMP
        });
        return { rowid: code + ':' + row.key };
      } catch (err) {
        return null;
      }
    },

    async updateScore(rowid, score, answered, total) {
      const parts = String(rowid || '').split(':');
      const code = safeCode(parts[0]);
      const playerId = parts[1];
      const service = await ready();
      const value = { score: Number(score), answered: Number(answered), total: Number(total) };
      if (!service || !code || !/^[A-Za-z0-9_-]{8,}$/.test(playerId) ||
          !Number.isInteger(value.score) || !Number.isInteger(value.answered) ||
          !Number.isInteger(value.total) || value.total < 1 || value.total > 100 ||
          value.score < 0 || value.score > value.total || value.answered < 0 || value.answered > value.total) {
        return null;
      }
      try {
        await service.db.ref('players/' + code + '/' + playerId).update({
          score: value.score,
          answered: value.answered,
          total: value.total,
          updatedAt: firebase.database.ServerValue.TIMESTAMP
        });
        return { ok: true };
      } catch (err) {
        return null;
      }
    },

    board(rawCode) {
      const code = safeCode(rawCode);
      return code ? readBoard('players/' + code) : Promise.resolve(null);
    },

    subscribeBoard(rawCode, callback) {
      const code = safeCode(rawCode);
      let listener = null;
      let reference = null;
      let stopped = false;
      ready().then(service => {
        if (stopped) return;
        if (!service || !code) return callback(null);
        reference = service.db.ref('players/' + code)
          .orderByChild('score')
          .limitToLast(BOARD_LIMIT);
        listener = snapshot => callback({ top: rank(snapshot.val()) });
        reference.on('value', listener, () => callback(null));
      });
      return () => {
        stopped = true;
        if (reference && listener) reference.off('value', listener);
      };
    },

    subscribeSessionStatus(rawCode, callback) {
      const code = safeCode(rawCode);
      let listener = null;
      let reference = null;
      let stopped = false;
      ready().then(service => {
        if (stopped) return;
        if (!service || !code) return callback(null);
        reference = service.db.ref('sessions/' + code + '/status');
        listener = snapshot => callback({ status: snapshot.val() || 'gone' });
        reference.on('value', listener, () => callback(null));
      });
      return () => {
        stopped = true;
        if (reference && listener) reference.off('value', listener);
      };
    },

    soloBoard() { return readBoard('soloScores'); },

    async soloSubmit(rawName, rawScore, rawTotal) {
      const service = await ready();
      const score = Number(rawScore);
      const total = Number(rawTotal);
      if (!service || !Number.isInteger(score) || !Number.isInteger(total) ||
          total < 1 || total > 100 || score < 0 || score > total) return null;
      try {
        const row = service.db.ref('soloScores/' + service.user.uid);
        const name = cleanName(rawName);
        await row.transaction(current => {
          /* Keep one personal best per anonymous identity. This prevents repeat
             plays from turning the public leaderboard into an ever-growing
             history while preserving the score a player is proudest of. */
          if (current && Number(current.score) >= score) return;
          const now = Date.now();
          return {
            uid: service.user.uid,
            player_name: name,
            score,
            answered: total,
            total,
            createdAt: current && current.createdAt ? current.createdAt : now,
            updatedAt: now
          };
        });
        return readBoard('soloScores');
      } catch (err) {
        return null;
      }
    }
  };
})();
