/* State machine + rendering.

   Four screens, one render() and no router:
     start -> question -> feedback -> (question | result) -> start

   The pookalam SVG is built once and mutated in place, so rings keep their
   bloom animation instead of being torn down on every render. */

const state = {
  screen: 'start',   // start | question | feedback | result
  index: 0,
  score: 0,
  results: [],       // one boolean per answered question — drives ring colour
  picked: null,
  submitting: false,
  leaderboard: null,
  lbError: false
};

const el = {
  progress: null,
  panel: null,
  kalam: null
};

const BEST_KEY = 'onam-pookalam-best';

function scoreMessage(score, total) {
  const pct = score / total;
  if (score === total) return 'Perfect. Every ring in full bloom.';
  if (pct >= 0.8) return 'Onam Ashamsakal! A pookalam worth photographing.';
  if (pct >= 0.6) return 'A fine pookalam, a few petals short of glory.';
  if (pct >= 0.4) return 'Half in bloom. The sadya is still yours.';
  return 'Mostly bare earth. Come back for another round.';
}

function bestScore() {
  const raw = Number(localStorage.getItem(BEST_KEY));
  return Number.isFinite(raw) ? raw : 0;
}

function saveBest(score) {
  if (score > bestScore()) localStorage.setItem(BEST_KEY, String(score));
}

/* ---------- rendering ---------- */

function renderProgress() {
  if (state.screen === 'start' || state.screen === 'result') {
    el.progress.hidden = true;
    return;
  }
  el.progress.hidden = false;
  const n = state.index + 1;
  const total = questions.length;
  const pct = Math.round((n / total) * 100);
  /* Running score — only once the player has at least 1 correct answer so we
     never show the deflating "✓ 0 correct" label. */
  const scoreHint = state.score > 0
    ? `<span class="score-hint">&#10003; ${state.score} correct</span>`
    : '';
  el.progress.innerHTML = `
    <div class="progress-row">
      <span>Question ${n} of ${total} ${scoreHint}</span>
      <span>${pct}%</span>
    </div>
    <div class="bar"><i style="width:${pct}%"></i></div>`;
}

/* King Maveli — the beloved king who descends from Vaikuntha every Onam to
   visit his people. Drawn as a simple SVG character: umbrella, crown, third eye,
   garland, mundum gold border. Floats gently to show he has just descended. */
const MAVELI_SVG = `
<svg class="maveli" viewBox="0 0 100 160" xmlns="http://www.w3.org/2000/svg"
     role="img" aria-label="King Maveli, the Onam king">
  <!-- umbrella stick -->
  <line x1="50" y1="28" x2="50" y2="68" stroke="#C9A227" stroke-width="3"
        stroke-linecap="round"/>
  <!-- umbrella canopy -->
  <path d="M16 30 Q50 8 84 30 Q67 25 50 27 Q33 25 16 30Z" fill="#C9A227"/>
  <path d="M16 30 Q33 37 50 27 Q67 37 84 30" fill="none" stroke="#EDD040"
        stroke-width="1.5" stroke-linecap="round"/>
  <!-- tassels -->
  <line x1="28" y1="32" x2="26" y2="42" stroke="#EDD040" stroke-width="1.5"
        stroke-linecap="round"/>
  <line x1="72" y1="32" x2="74" y2="42" stroke="#EDD040" stroke-width="1.5"
        stroke-linecap="round"/>
  <!-- crown -->
  <path d="M27 66 L32 55 L37 63 L43 50 L50 61 L57 50 L63 63 L68 55 L73 66Z"
        fill="#EDD040" stroke="#C9A227" stroke-width="1"/>
  <!-- crown gems -->
  <circle cx="43" cy="53" r="2.5" fill="#E05858"/>
  <circle cx="50" cy="61" r="2.5" fill="#3DBF68"/>
  <circle cx="57" cy="53" r="2.5" fill="#E05858"/>
  <!-- head -->
  <circle cx="50" cy="86" r="19" fill="#C8895A"/>
  <!-- forehead bindi / third eye -->
  <ellipse cx="50" cy="80" rx="4.5" ry="3" fill="#A8201A" stroke="#7A1A1A"
           stroke-width="0.5"/>
  <circle cx="50" cy="80" r="1.5" fill="#2A0808"/>
  <!-- eyebrows -->
  <path d="M40 86 Q44 83 48 84" fill="none" stroke="#5A3520" stroke-width="1.5"
        stroke-linecap="round"/>
  <path d="M52 84 Q56 83 60 86" fill="none" stroke="#5A3520" stroke-width="1.5"
        stroke-linecap="round"/>
  <!-- eyes -->
  <ellipse cx="44" cy="89" rx="3" ry="2" fill="#2A1810"/>
  <ellipse cx="56" cy="89" rx="3" ry="2" fill="#2A1810"/>
  <circle cx="44.8" cy="88.5" r="1" fill="#fff"/>
  <circle cx="56.8" cy="88.5" r="1" fill="#fff"/>
  <!-- smile -->
  <path d="M43 95 Q50 101 57 95" fill="none" stroke="#5A3520" stroke-width="2"
        stroke-linecap="round"/>
  <!-- moustache -->
  <path d="M43 92 Q47 94 50 92 Q53 94 57 92" fill="none" stroke="#3A2010"
        stroke-width="1.5" stroke-linecap="round"/>
  <!-- ears -->
  <ellipse cx="31" cy="88" rx="4" ry="5" fill="#C8895A"/>
  <ellipse cx="69" cy="88" rx="4" ry="5" fill="#C8895A"/>
  <!-- earrings -->
  <circle cx="31" cy="93" r="2.5" fill="#EDD040"/>
  <circle cx="69" cy="93" r="2.5" fill="#EDD040"/>
  <!-- neck -->
  <path d="M38 106 Q50 101 62 106" stroke="#C8895A" stroke-width="9" fill="none"
        stroke-linecap="round"/>
  <!-- body / mundum -->
  <ellipse cx="50" cy="136" rx="28" ry="22" fill="#F0E8D8"/>
  <!-- mundum kasavu border -->
  <path d="M22 155 Q50 162 78 155" stroke="#C9A227" stroke-width="4" fill="none"
        stroke-linecap="round"/>
  <!-- garland / mala -->
  <path d="M37 114 Q50 109 63 114" fill="none" stroke="#F08C00" stroke-width="3"
        stroke-linecap="round"/>
  <circle cx="42" cy="114" r="2.5" fill="#F08C00"/>
  <circle cx="50" cy="110" r="2.5" fill="#F08C00"/>
  <circle cx="58" cy="114" r="2.5" fill="#F08C00"/>
  <!-- hands / arms hinting -->
  <line x1="22" y1="125" x2="14" y2="118" stroke="#C8895A" stroke-width="6"
        stroke-linecap="round"/>
  <line x1="78" y1="125" x2="86" y2="118" stroke="#C8895A" stroke-width="6"
        stroke-linecap="round"/>
  <!-- blessing hand gesture (right) -->
  <circle cx="86" cy="116" r="5" fill="#C8895A"/>
</svg>`;

function renderStart() {
  const best = bestScore();
  el.panel.innerHTML = `
    <p class="subtitle">ഓണാശംസകൾ &middot; Onam 2025</p>
    <div class="maveli-wrap">${MAVELI_SVG}</div>
    <h1 class="title">Onam Pookalam Quiz</h1>
    <p class="lede">Ten questions. Every answer lays another ring of flowers.
       Finish the quiz, finish the pookalam.</p>
    ${best ? `<p class="best">&#9733; Your best: ${best} / ${questions.length}</p>` : ''}
    <button class="btn" id="startBtn">&#9654; Start Solo Quiz</button>
    <div class="mode-divider"><span>or play together</span></div>
    <div class="mode-row">
      <button class="btn ghost mode-btn" id="hostBtn">
        &#128247; Host a Live Quiz
      </button>
      <button class="btn ghost mode-btn" id="joinBtn">
        &#127918; Join with Code
      </button>
    </div>`;

  document.getElementById('startBtn').addEventListener('click', () => {
    state.screen = 'question';
    render();
  });
  document.getElementById('hostBtn').addEventListener('click', () => {
    location.hash = 'host';
  });
  document.getElementById('joinBtn').addEventListener('click', () => {
    location.hash = 'join';
  });
}

function renderQuestion() {
  const q = questions[state.index];
  const answered = state.screen === 'feedback';
  const correct = answered && state.picked === q.answer;

  const opts = q.options.map((opt, i) => {
    const letter = String.fromCharCode(65 + i);
    let cls = 'opt';
    if (answered) {
      if (opt === q.answer) cls += ' good';
      else if (opt === state.picked) cls += ' bad';
      else cls += ' dim';
    }
    return `<button class="${cls}" data-opt="${encodeURIComponent(opt)}" ${answered ? 'disabled' : ''}>
              <span class="k">${answered && opt === q.answer ? '&#10003;' : letter}</span>
              <span>${opt}</span>
            </button>`;
  }).join('');

  const last = state.index === questions.length - 1;

  el.panel.innerHTML = `
    <p class="area">${q.area}</p>
    <h2 class="q">${q.question}</h2>
    <div class="opts">${opts}</div>
    ${answered ? `
      <p class="fb ${correct ? 'ok' : 'no'}">
        ${correct ? 'Correct &mdash; a new ring blooms.' : `Not quite. The answer is ${q.answer}.`}
      </p>
      <button class="btn" id="nextBtn">${last ? 'See my pookalam' : 'Next Question'}</button>` : ''}`;

  if (!answered) {
    el.panel.querySelectorAll('.opt').forEach(b => {
      b.addEventListener('click', () => choose(decodeURIComponent(b.dataset.opt)));
    });
  } else {
    document.getElementById('nextBtn').addEventListener('click', next);
  }
}

function renderResult() {
  const total = questions.length;
  const best = bestScore();
  el.panel.innerHTML = `
    <div class="score">${state.score} / ${total}<small>YOUR POOKALAM IS COMPLETE</small></div>
    <p class="msg">${scoreMessage(state.score, total)}</p>
    ${best > state.score ? `<p class="best">&#9733; Your best is still ${best} / ${total}</p>` : ''}
    <div id="lbSlot"></div>
    <div class="result-actions">
      <button class="btn ghost share-btn" id="shareBtn">&#x1F517; Share Score</button>
      <button class="btn" id="againBtn">&#9654; Play Again</button>
    </div>`;

  document.getElementById('againBtn').addEventListener('click', restart);
  document.getElementById('shareBtn').addEventListener('click', () => {
    const petal = state.score === total ? 'complete! Every ring in full bloom.' : `${state.score} rings deep.`;
    const text = `I scored ${state.score}/${total} on the Onam Pookalam Quiz! 🌸 My pookalam is ${petal}\nTry it: https://onam-quiz-tegpgzpi.onslate.in`;
    const btn = document.getElementById('shareBtn');
    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => {
        if (btn) { btn.innerHTML = '&#10003; Copied!'; setTimeout(() => { if (btn) btn.innerHTML = '&#x1F517; Share Score'; }, 2000); }
      }).catch(() => {
        if (btn) btn.innerHTML = '&#10003; Score: ' + state.score + '/' + total;
      });
    }
  });
  renderLeaderboardSlot();
}

/* The leaderboard is the only part that can fail. When it does, the slot stays
   empty and the score above it is untouched. */
function renderLeaderboardSlot() {
  const slot = document.getElementById('lbSlot');
  if (!slot) return;

  if (state.leaderboard) {
    const rows = state.leaderboard.map((r, i) => `
      <div class="row">
        <span><i class="rk">${i + 1}</i>${r.player_name || 'Anonymous'}</span>
        <span>${r.score}</span>
      </div>`).join('');
    slot.innerHTML = `<div class="lb"><h4>Top pookalams</h4>${rows}</div>`;
    return;
  }

  if (state.submitting) {
    slot.innerHTML = `<div class="lb"><p class="lb-note">Sending your score&hellip;</p></div>`;
    return;
  }

  // Only mention a failure if the player actively tried to submit. A silent
  // background failure shows nothing at all.
  if (state.lbError) {
    slot.innerHTML = `<div class="lb"><p class="lb-note">Leaderboard unavailable right now &mdash;
      your score above still counts.</p></div>`;
    return;
  }

  slot.innerHTML = `
    <div class="lb">
      <h4>Add your name</h4>
      <form class="lb-form" id="lbForm">
        <input id="lbName" type="text" maxlength="40" placeholder="Your name" autocomplete="off">
        <button class="btn small" type="submit">Post score</button>
      </form>
    </div>`;

  document.getElementById('lbForm').addEventListener('submit', async ev => {
    ev.preventDefault();
    const name = document.getElementById('lbName').value.trim() || 'Anonymous';
    state.submitting = true;
    renderLeaderboardSlot();
    const res = await Api.soloSubmit(name, state.score, questions.length);
    state.submitting = false;
    if (res && res.top) state.leaderboard = res.top;
    else state.lbError = true;
    renderLeaderboardSlot();
  });
}

function render() {
  /* Restart the panel's fade-in animation on every render so content
     changes feel like arrivals, not instant swaps. The offsetHeight read
     forces a reflow so the browser sees the class removal before re-adding. */
  el.panel.classList.remove('fade-in');
  void el.panel.offsetHeight;
  el.panel.classList.add('fade-in');

  renderProgress();
  if (state.screen === 'start') renderStart();
  else if (state.screen === 'result') renderResult();
  else renderQuestion();
}

/* ---------- transitions ---------- */

function choose(opt) {
  const q = questions[state.index];
  const correct = opt === q.answer;
  state.picked = opt;
  state.results[state.index] = correct;
  if (correct) state.score++;
  state.screen = 'feedback';
  Pookalam.bloomRing(state.index, correct);
  render();
}

function next() {
  state.picked = null;
  if (state.index === questions.length - 1) {
    state.screen = 'result';
    saveBest(state.score);
  } else {
    state.index++;
    state.screen = 'question';
  }
  render();
}

function restart() {
  state.screen = 'start';
  state.index = 0;
  state.score = 0;
  state.results = [];
  state.picked = null;
  state.leaderboard = null;
  state.lbError = false;
  /* Fresh draw per game: new 10 from the pool, new option order. restart() also
     runs on boot via route(), so the first game is shuffled too. */
  newQuiz();
  Pookalam.reset();
  render();
}

/* ---------- routing ---------- */

/* Hash routes, not real paths. A hash needs zero server configuration, so it
   cannot 404 on static Slate hosting — which matters when the join URL is
   printed inside a QR code and projected in front of a room.

     (no hash)  the graded single-player quiz — untouched by live mode
     #host      host dashboard: QR, session code, live leaderboard
     #join      participant flow for a scanned phone
*/
function route() {
  const hash = (location.hash || '').replace(/^#/, '').toLowerCase();
  Live.stop();

  if (hash === 'host' || hash === 'join') {
    el.progress.hidden = true;
    Pookalam.build(el.kalam);
    // The host dashboard has no pookalam of its own; hide it there.
    el.kalam.style.display = (hash === 'host') ? 'none' : '';
    if (hash === 'host') Live.startHost(el.panel);
    else Live.startJoin(el.panel);
    return;
  }

  el.kalam.style.display = '';
  Pookalam.build(el.kalam);
  restart();
}

/* ---------- keyboard shortcuts ----------

   On desktop a quiz is much faster when you can keep your hands on keys.
   Keys A/B/C/D or 1/2/3/4 click the corresponding option.
   Enter or Space advance to the next question / start the quiz. */

document.addEventListener('keydown', e => {
  /* Ignore while the user is typing in an input field */
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  if (state.screen === 'question') {
    const KEY_MAP = { a: 0, '1': 0, b: 1, '2': 1, c: 2, '3': 2, d: 3, '4': 3 };
    const idx = KEY_MAP[e.key.toLowerCase()];
    if (idx !== undefined) {
      const opts = el.panel.querySelectorAll('.opt:not(:disabled)');
      if (opts[idx]) { e.preventDefault(); opts[idx].click(); }
      return;
    }
  }

  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    const btn = document.getElementById('nextBtn')
               || document.getElementById('startBtn')
               || document.getElementById('againBtn');
    if (btn) btn.click();
  }
});

/* ---------- boot ---------- */

document.addEventListener('DOMContentLoaded', () => {
  el.progress = document.getElementById('progress');
  el.panel = document.getElementById('panel');
  el.kalam = document.getElementById('kalam');
  route();
  window.addEventListener('hashchange', route);
});
