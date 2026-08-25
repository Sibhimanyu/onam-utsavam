/* Live event mode: the host dashboard (#host) and the participant flow (#join).
   The solo quiz at / is untouched by any of this — that is the graded app. */

const Live = (() => {
  const POLL_MS = 3000;   /* Deliberately not faster. Catalyst allows 10
                             concurrent executions per function per environment
                             and returns HTTP 429 past that. A 3s dashboard poll
                             plus self-paced player writes stays well clear;
                             a 500ms poll would not. */
  let pollTimer = null;

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  /* ---------------- shared rendering ---------------- */

  function boardHtml(rows, opts) {
    const o = opts || {};
    if (!rows || !rows.length) {
      return `<p class="lb-note">${o.emptyText || 'No one has joined yet.'}</p>`;
    }
    return rows.map((r, i) => {
      const done = Number(r.answered) >= Number(r.total);
      const me = o.highlight && r.player_name === o.highlight;
      return `
        <div class="row ${me ? 'me' : ''}">
          <span><i class="rk">${i + 1}</i>${escapeHtml(r.player_name || 'Anonymous')}</span>
          <span class="rs">${r.score}
            <i class="prog-dots">${done ? 'done' : (r.answered || 0) + '/' + r.total}</i>
          </span>
        </div>`;
    }).join('');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  /* ---------------- score updates: serialized, latest wins ----------------

     Fire-and-forget updates race. Verified in a real end-to-end run: six rapid
     answers produced six concurrent POSTs, they completed out of order, and an
     EARLIER one landed last — the row ended up permanently storing 2/3 when the
     player had actually scored 5 of 6. Silently wrong scores on the leaderboard.

     So: at most one request in flight, and if newer state arrives while one is
     running we keep only the newest and send it afterwards. That makes the last
     write always the true final state, regardless of network ordering. */
  const updater = {
    pending: null,
    inFlight: false,

    queue(rowid, score, answered, total) {
      this.pending = { rowid, score, answered, total };
      this.pump();
    },

    async pump() {
      if (this.inFlight || !this.pending) return;
      this.inFlight = true;
      const s = this.pending;
      this.pending = null;
      try {
        await Api.updateScore(s.rowid, s.score, s.answered, s.total);
      } finally {
        this.inFlight = false;
        if (this.pending) this.pump();
      }
    },

    /* Await until the queue is fully drained. Called at the end of a round so
       the final score is guaranteed committed before we tell the player to
       look up at the leaderboard. */
    async flush() {
      while (this.inFlight || this.pending) {
        await new Promise(r => setTimeout(r, 120));
      }
    },

    reset() { this.pending = null; }
  };

  /* ---------------- host dashboard ---------------- */

  const host = {
    code: null,

    mount(root) {
      root.innerHTML = `
        <div class="host">
          <h1 class="host-title">Onam Pookalam Quiz</h1>
          <div id="hostBody"></div>
        </div>`;
      this.renderIdle();
    },

    renderIdle() {
      document.getElementById('hostBody').innerHTML = `
        <p class="lede">Press start, then point the room at the QR code.</p>
        <button class="btn" id="openBtn">Start the quiz</button>
        <p class="lb-note" id="hostErr"></p>`;
      document.getElementById('openBtn').addEventListener('click', () => this.open());
    },

    async open() {
      const btn = document.getElementById('openBtn');
      btn.disabled = true;
      btn.textContent = 'Opening…';
      const res = await Api.openSession();
      if (!res || !res.code) {
        btn.disabled = false;
        btn.textContent = 'Start the quiz';
        document.getElementById('hostErr').textContent =
          'Could not open a session. The Quiz_Sessions table may not exist yet.';
        return;
      }
      this.code = res.code;
      this.renderLive();
    },

    renderLive() {
      document.getElementById('hostBody').innerHTML = `
        <div class="joinbar">
          <div class="qrwrap">
            <img src="img/join-qr.svg" alt="Scan to join the quiz" class="qr">
          </div>
          <div class="joininfo">
            <p class="joinlabel">Scan to join</p>
            <!-- The ?v= must stay in the typed fallback too. Slate caches
                 index.html for a year and ignores _headers, so a bare URL can
                 serve a stale app to any phone that opened it before. -->
            <p class="joinurl">onam-quiz-tegpgzpi.onslate.in/?v=9#join</p>
            <p class="joinlabel">or enter code</p>
            <p class="joincode">${this.code}</p>
          </div>
        </div>
        <div class="lb lb-live">
          <h4>Live leaderboard <i class="pulse"></i></h4>
          <div id="hostBoard"><p class="lb-note">No one has joined yet.</p></div>
        </div>
        <button class="btn ghost" id="closeBtn">Close &amp; reveal final scores</button>`;

      document.getElementById('closeBtn').addEventListener('click', () => this.close());
      this.refresh();
      stopPolling();
      pollTimer = setInterval(() => this.refresh(), POLL_MS);
    },

    async refresh() {
      if (!this.code) return;
      const res = await Api.board(this.code);
      const slot = document.getElementById('hostBoard');
      if (!slot) return;
      if (!res) {
        slot.innerHTML = `<p class="lb-note">Leaderboard stuck &mdash; retrying…</p>`;
        return;
      }
      slot.innerHTML = boardHtml(res.top);
    },

    async close() {
      stopPolling();
      const res = await Api.closeSession(this.code);
      const rows = res && res.top ? res.top : [];
      document.getElementById('hostBody').innerHTML = `
        <p class="joinlabel">Final standings &mdash; session ${this.code}</p>
        <div class="lb">${boardHtml(rows, { emptyText: 'Nobody played this round.' })}</div>
        <button class="btn" id="againBtn">Run another round</button>`;
      document.getElementById('againBtn').addEventListener('click', () => {
        this.code = null;
        this.renderIdle();
      });
    }
  };

  /* ---------------- participant ---------------- */

  const join = {
    code: null,
    rowid: null,
    name: '',
    index: 0,
    score: 0,
    ended: false,
    watchTimer: null,

    /* While a player is answering, poll their own session's status so a host
       "close" reaches this phone live — otherwise they keep tapping through a
       round nobody is watching and their finish screen lands on a dead board. */
    startWatch() {
      this.stopWatch();
      this.watchTimer = setInterval(() => this.checkSession(), POLL_MS);
    },

    stopWatch() {
      if (this.watchTimer) { clearInterval(this.watchTimer); this.watchTimer = null; }
    },

    async checkSession() {
      if (this.ended || !this.code) return;
      const res = await Api.sessionStatus(this.code);
      /* A null is a transient network blip — keep playing and retry next tick.
         Only an explicit non-open status ends the round for this player. */
      if (res && res.status && res.status !== 'open') this.endedByHost();
    },

    endedByHost() {
      if (this.ended) return;
      this.ended = true;
      this.stopWatch();
      updater.reset();
      const played = this.rowid != null;
      document.getElementById('joinBody').innerHTML = `
        <h1 class="title">The round has ended</h1>
        <p class="lede">The host closed this quiz.${played
          ? ` Your final score is <strong>${this.score} / ${questions.length}</strong>.`
          : ''}</p>
        <p class="msg">Look up at the host's screen for the final standings.</p>`;
    },

    async mount(root) {
      this.stopWatch();
      this.ended = false;
      root.innerHTML = `<div id="joinBody"><p class="lede">Looking for a live quiz…</p></div>`;
      const res = await Api.currentSession();
      const body = document.getElementById('joinBody');

      if (!res) {
        body.innerHTML = `<p class="lede">Could not reach the quiz. Check your connection
          and reload.</p>`;
        return;
      }
      if (!res.code) {
        body.innerHTML = `<h1 class="title">No quiz running</h1>
          <p class="lede">Wait for the host to start the round, then reload this page.</p>
          <button class="btn" id="retryBtn">Check again</button>`;
        document.getElementById('retryBtn').addEventListener('click', () => this.mount(root));
        return;
      }

      this.code = res.code;
      body.innerHTML = `
        <h1 class="title">You're in</h1>
        <p class="lede">Session <strong>${this.code}</strong>. What should the leaderboard
          call you?</p>
        <form class="lb-form" id="nameForm">
          <input id="joinName" type="text" maxlength="40" placeholder="Your name" autocomplete="off">
          <button class="btn small" type="submit">Join</button>
        </form>
        <p class="lb-note" id="joinErr"></p>`;

      document.getElementById('nameForm').addEventListener('submit', ev => {
        ev.preventDefault();
        this.claim(document.getElementById('joinName').value.trim());
      });
    },

    async claim(name) {
      this.name = name || 'Anonymous';
      const err = document.getElementById('joinErr');
      err.textContent = 'Joining…';
      /* Draw this participant's own 10 questions and option order BEFORE the
         join call, because join reports questions.length as the round total.
         Everyone gets the same count from the same pool, so the leaderboard
         stays comparable — but nobody can copy a neighbour's screen. */
      newQuiz();
      const res = await Api.join(this.code, this.name, questions.length);
      if (!res || !res.rowid) {
        err.textContent = 'Could not join. Ask the host if the round is still open.';
        return;
      }
      this.rowid = res.rowid;
      this.index = 0;
      this.score = 0;
      this.ended = false;
      updater.reset();
      Pookalam.reset();
      this.startWatch();
      this.renderQuestion();
    },

    renderQuestion(answered, picked) {
      const q = questions[this.index];
      const correct = answered && picked === q.answer;
      const last = this.index === questions.length - 1;

      const opts = q.options.map((opt, i) => {
        const letter = String.fromCharCode(65 + i);
        let cls = 'opt';
        if (answered) {
          if (opt === q.answer) cls += ' good';
          else if (opt === picked) cls += ' bad';
          else cls += ' dim';
        }
        return `<button class="${cls}" data-opt="${encodeURIComponent(opt)}"
                  ${answered ? 'disabled' : ''}>
                  <span class="k">${answered && opt === q.answer ? '&#10003;' : letter}</span>
                  <span>${escapeHtml(opt)}</span>
                </button>`;
      }).join('');

      document.getElementById('joinBody').innerHTML = `
        <div class="progress-row">
          <span>Question ${this.index + 1} of ${questions.length}</span>
          <span>${this.score} correct</span>
        </div>
        <div class="bar"><i style="width:${Math.round(((this.index + 1) / questions.length) * 100)}%"></i></div>
        <p class="area">${q.area}</p>
        <h2 class="q">${escapeHtml(q.question)}</h2>
        <div class="opts">${opts}</div>
        ${answered ? `
          <p class="fb ${correct ? 'ok' : 'no'}">
            ${correct ? 'Correct &mdash; a new ring blooms.'
                      : 'Not quite. The answer is ' + escapeHtml(q.answer) + '.'}
          </p>
          <button class="btn" id="jNext">${last ? 'Finish' : 'Next Question'}</button>` : ''}`;

      if (!answered) {
        document.querySelectorAll('#joinBody .opt').forEach(b => {
          b.addEventListener('click', () => this.choose(decodeURIComponent(b.dataset.opt)));
        });
      } else {
        document.getElementById('jNext').addEventListener('click', () => this.next());
      }
    },

    choose(opt) {
      const q = questions[this.index];
      const correct = opt === q.answer;
      if (correct) this.score++;
      Pookalam.bloomRing(this.index, correct);
      this.renderQuestion(true, opt);
      /* Queued, not fired directly — see `updater` above. Still never blocks the
         UI, but writes can no longer land out of order. */
      updater.queue(this.rowid, this.score, this.index + 1, questions.length);
    },

    next() {
      if (this.index === questions.length - 1) return this.finish();
      this.index++;
      this.renderQuestion();
    },

    async finish() {
      /* Player reached the end on their own — stop watching so a later host
         close doesn't replace their completed screen with the ended notice. */
      this.stopWatch();
      document.getElementById('joinBody').innerHTML = `
        <div class="score">${this.score} / ${questions.length}<small>YOUR POOKALAM IS COMPLETE</small></div>
        <p class="msg" id="finishMsg">Sending your final score&hellip;</p>`;

      /* Wait for the queue to drain, then send one authoritative final write.
         Without this a player could close the tab mid-flight and be recorded
         with a stale intermediate score. */
      await updater.flush();
      await Api.updateScore(this.rowid, this.score, questions.length, questions.length);

      const msg = document.getElementById('finishMsg');
      if (msg) msg.textContent = "Your score is on the host's leaderboard. Look up.";
    }
  };

  /* ---------------- entry ---------------- */

  return {
    startHost(root) { stopPolling(); join.stopWatch(); host.mount(root); },
    startJoin(root) { stopPolling(); join.mount(root); },
    stop() { stopPolling(); join.stopWatch(); }
  };
})();
