/* State machine + rendering.

   Four screens, one render() and no router:
     start -> question -> feedback -> (question | result) -> start */

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
  back: null
};

const BEST_KEY = 'onam-pookalam-best';

function scoreMessage(score, total) {
  const pct = score / total;
  if (score === total) return 'Perfect. Maveli is dancing for you.';
  if (pct >= 0.8) return 'Onam Ashamsakal! Maveli is properly impressed.';
  if (pct >= 0.6) return 'A strong round, with plenty of happy cheers.';
  if (pct >= 0.4) return 'Halfway there. Maveli still believes in you.';
  return 'A tough round. Maveli gives a gentle sigh and a second chance.';
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

function renderStart() {
  const best = bestScore();
  el.panel.innerHTML = `
    <p class="subtitle"><span class="subtitle-ml" lang="ml">ഓണാശംസകൾ</span> &middot; Onam 2025</p>
    <div class="maveli-wrap">
      <picture>
        <source srcset="img/maveli-welcome.webp?v=21" type="image/webp">
        <img class="maveli" src="img/maveli-welcome.png?v=21"
             width="413" height="620"
             alt="King Maveli welcoming you to the quiz">
      </picture>
    </div>
    <h1 class="title">Onam Pookalam Quiz</h1>
    <p class="lede">Ten questions. Maveli cheers every right answer and sighs
       along with every miss.</p>
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
    /* Ballot markers per DESIGN.md: Malayalam numerals with a small Latin
       subscript — answers are quiet typographic rows, never colored tiles. */
    const letter = `${['൧', '൨', '൩', '൪'][i] || String.fromCharCode(65 + i)}<sub>${i + 1}</sub>`;
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
  /* Base name, not a full src: the markup below serves WebP to anything that
     takes it (~87% smaller) and keeps the PNG as the fallback, because a bare
     WebP <img> shows a broken image on older Safari rather than degrading. */
  const reactionBase = correct ? 'img/maveli-happy' : 'img/maveli-sigh';
  const reactionAlt = correct
    ? 'King Maveli celebrating a correct answer'
    : 'King Maveli giving a sympathetic sigh for a wrong answer';

  el.panel.innerHTML = `
    <p class="area">${q.area}</p>
    <h2 class="q">${q.question}</h2>
    <div class="opts ${answered ? 'answered' : ''}">${opts}</div>
    ${answered ? `
      <div class="feedback-strip ${correct ? 'ok' : 'no'}">
        <div class="reaction ${correct ? 'ok' : 'no'}">
          <picture>
            <source srcset="${reactionBase}.webp?v=21" type="image/webp">
            <img src="${reactionBase}.png?v=21" width="420" height="420"
                 alt="${reactionAlt}">
          </picture>
        </div>
        <div class="feedback-copy">
          <p class="fb ${correct ? 'ok' : 'no'}">
            ${correct ? 'Correct &mdash; Maveli is cheering.'
                      : `Not quite. The answer is ${q.answer}.`}
          </p>
          <button class="btn" id="nextBtn">${last ? 'See my score' : 'Next Question'}</button>
        </div>
      </div>
      ` : ''}`;

  if (!answered) {
    el.panel.querySelectorAll('.opt').forEach(b => {
      b.addEventListener('click', () => choose(decodeURIComponent(b.dataset.opt)));
    });
  } else {
    document.getElementById('nextBtn').addEventListener('click', next);
  }
}

/* Onam petal rain — 72 flower shapes in Kerala festival colours falling
   from the top of the viewport. Three CSS shapes (teardrop, reverse-teardrop,
   circle) give it the mixed-petal look of a real pookalam scattered by wind.
   Respects prefers-reduced-motion by skipping entirely. */
function celebratePerfectScore() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* Kerala festival palette */
  const COLORS = [
    '#F08C00', /* marigold       */
    '#F5960A', /* saffron        */
    '#C9A227', /* kasavu gold    */
    '#EDD040', /* bright gold    */
    '#A8201A', /* festival red   */
    '#D94040', /* lighter red    */
    '#1E5B3A', /* Kerala green   */
    '#3DBF68', /* light green    */
    '#FBF6EC', /* cream-white    */
  ];

  /* Three petal shapes as CSS border-radius strings */
  const SHAPES = [
    '50% 50% 50% 0',   /* teardrop pointing bottom-left  */
    '50% 0 50% 50%',   /* teardrop pointing bottom-right */
    '50%',             /* circle (rangoli dot)            */
    '50% 50% 0 50%',   /* teardrop pointing top-right    */
  ];

  const wrap = document.createElement('div');
  wrap.className = 'confetti-wrap';
  document.body.appendChild(wrap);

  for (let i = 0; i < 72; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-petal';
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const w = 5 + Math.random() * 9;               /* 5-14 px wide  */
    const h = w * (0.6 + Math.random() * 0.8);     /* vary aspect   */
    const drift = (Math.random() - 0.5) * 220;     /* px left/right */
    const delay = Math.random() * 2.8;             /* stagger start */
    const dur   = 2.8 + Math.random() * 2.4;       /* fall speed    */
    p.style.cssText = [
      `left:${Math.random() * 100}%`,
      `background:${color}`,
      `width:${w.toFixed(1)}px`,
      `height:${h.toFixed(1)}px`,
      `border-radius:${SHAPES[Math.floor(Math.random() * SHAPES.length)]}`,
      `--drift:${drift.toFixed(0)}px`,
      `animation-delay:${delay.toFixed(2)}s`,
      `animation-duration:${dur.toFixed(2)}s`,
    ].join(';');
    wrap.appendChild(p);
  }

  /* Remove the DOM nodes after the longest possible petal has landed */
  setTimeout(() => wrap.remove(), 7000);
}

function renderResult() {
  const total = questions.length;
  const best = bestScore();
  /* Fire the petal rain before rendering so the DOM update and the confetti
     launch happen in the same frame — no visible delay between score reveal
     and petals appearing. */
  if (state.score === total) celebratePerfectScore();
  el.panel.innerHTML = `
    <div class="score">${state.score} / ${total}<small>YOUR FINAL SCORE</small></div>
    <p class="msg">${scoreMessage(state.score, total)}</p>
    ${best > state.score ? `<p class="best">&#9733; Your best is still ${best} / ${total}</p>` : ''}
    <div id="lbSlot"></div>
    <div class="result-actions">
      <button class="btn ghost share-btn" id="shareBtn">&#x1F517; Share Score</button>
      <button class="btn" id="againBtn">&#9654; Play Again</button>
    </div>`;

  document.getElementById('againBtn').addEventListener('click', restart);
  document.getElementById('shareBtn').addEventListener('click', () => {
    const mood = state.score === total ? 'Maveli is dancing!' : `Maveli gave me ${state.score} cheers.`;
    const publicUrl = String(window.QUIZ_PUBLIC_URL || '').replace(/\/$/, '') ||
      location.origin + location.pathname;
    const text = `I scored ${state.score}/${total} on the Onam Pookalam Quiz! ${mood}\nTry it: ${publicUrl}`;
    const btn = document.getElementById('shareBtn');
    const LABEL = '&#x1F517; Share Score';

    /* Every outcome flashes and then restores the label. Clipboard writes
       reject routinely — permission denied, or the document simply not focused
       because the user switched tabs — and the old catch replaced the label
       permanently, so one failed copy left the button reading "Score: 7/10"
       for the rest of the session with no hint it was still a share button. */
    const flash = html => {
      if (!btn) return;
      btn.innerHTML = html;
      setTimeout(() => { if (btn) btn.innerHTML = LABEL; }, 2000);
    };

    const copy = () => navigator.clipboard.writeText(text)
      .then(() => flash('&#10003; Copied!'))
      .catch(() => flash('&#9888; Could not copy'));

    if (navigator.share) {
      navigator.share({ text }).catch(err => {
        /* AbortError is the user dismissing the share sheet, which is not a
           failure and needs no feedback. Anything else means the sheet is
           unusable, so fall through to the clipboard rather than the old
           silent no-op that left the click looking broken. */
        if (err && err.name !== 'AbortError') copy();
      });
    } else {
      copy();
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
    slot.innerHTML = `<div class="lb"><h4>Top scores</h4>${rows}</div>`;
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
  document.body.dataset.screen = state.screen;
  /* The Home button shows on every screen except the start screen itself.
     Live views (#host/#join) never call render(), so route() handles them. */
  el.back.hidden = state.screen === 'start';
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
  render();
}

/* ---------- routing ---------- */

/* Hash routes, not real paths. A hash needs zero server configuration, so it
   works from one static Firebase Hosting entry point.

     (no hash)  the graded single-player quiz — untouched by live mode
     #host      host dashboard: QR, session code, live leaderboard
     #join      participant flow for a scanned phone
*/
function route() {
  const hash = (location.hash || '').replace(/^#/, '').toLowerCase();
  Live.stop();

  if (hash === 'host' || hash === 'join') {
    el.progress.hidden = true;
    el.back.hidden = false;
    if (hash === 'host') Live.startHost(el.panel);
    else Live.startJoin(el.panel);
    return;
  }

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
  el.back = document.getElementById('backBtn');
  /* Home from anywhere. Live views: clearing the hash re-routes, which also
     stops the live listeners. Solo mid-quiz: restart() abandons the run and
     returns to the start screen — same contract as "Play Again". */
  el.back.addEventListener('click', () => {
    if (location.hash) location.hash = '';
    else restart();
  });
  route();
  window.addEventListener('hashchange', route);
});
