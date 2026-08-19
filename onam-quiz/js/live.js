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
            <p class="joinurl">onam-quiz-tegpgzpi.onslate.in</p>
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

    async mount(root) {
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
      const res = await Api.join(this.code, this.name, questions.length);
      if (!res || !res.rowid) {
        err.textContent = 'Could not join. Ask the host if the round is still open.';
        return;
      }
      this.rowid = res.rowid;
      this.index = 0;
      this.score = 0;
      Pookalam.reset();
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
      /* Fire and forget: the score update must never block the UI. If it fails
         the player keeps playing and simply lands lower on the board. */
      Api.updateScore(this.rowid, this.score, this.index + 1, questions.length);
    },

    next() {
      if (this.index === questions.length - 1) return this.finish();
      this.index++;
      this.renderQuestion();
    },

    finish() {
      document.getElementById('joinBody').innerHTML = `
        <div class="score">${this.score} / ${questions.length}<small>YOUR POOKALAM IS COMPLETE</small></div>
        <p class="msg">Your score is on the host's leaderboard. Look up.</p>`;
    }
  };

  /* ---------------- entry ---------------- */

  return {
    startHost(root) { stopPolling(); host.mount(root); },
    startJoin(root) { stopPolling(); join.mount(root); },
    stop() { stopPolling(); }
  };
})();
