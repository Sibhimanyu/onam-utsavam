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
  el.progress.innerHTML = `
    <div class="progress-row">
      <span>Question ${n} of ${total}</span>
      <span>${pct}%</span>
    </div>
    <div class="bar"><i style="width:${pct}%"></i></div>`;
}

function renderStart() {
  const best = bestScore();
  el.panel.innerHTML = `
    <h1 class="title">Onam Pookalam Quiz</h1>
    <p class="lede">Ten questions. Every answer lays another ring of flowers.
       Finish the quiz, finish the pookalam.</p>
    ${best ? `<p class="best">Your best so far: ${best} / ${questions.length}</p>` : ''}
    <button class="btn" id="startBtn">Start Quiz</button>`;
  document.getElementById('startBtn').addEventListener('click', () => {
    state.screen = 'question';
    render();
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
    ${best > state.score ? `<p class="best">Your best is still ${best} / ${total}</p>` : ''}
    <div id="lbSlot"></div>
    <button class="btn" id="againBtn">Play Again</button>`;

  document.getElementById('againBtn').addEventListener('click', restart);
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
    const top = await Leaderboard.submit(name, state.score, questions.length);
    state.submitting = false;
    if (top) state.leaderboard = top;
    else state.lbError = true;
    renderLeaderboardSlot();
  });
}

function render() {
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
  Pookalam.reset();
  render();
}

/* ---------- boot ---------- */

document.addEventListener('DOMContentLoaded', () => {
  el.progress = document.getElementById('progress');
  el.panel = document.getElementById('panel');
  el.kalam = document.getElementById('kalam');
  Pookalam.build(el.kalam);
  render();
});
