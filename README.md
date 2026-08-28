# 🌸 Onam Pookalam Quiz

> A Kerala festival quiz where King Maveli cheers every right answer and sighs along with every miss.

**Live →** https://onam-quiz-tegpgzpi.onslate.in

---

## What it is

The Onam Pookalam Quiz is a festive, browser-based trivia game built for Onam celebrations. Every game draws ten questions at random from a pool of 32 spanning nine areas of Kerala culture — the Mahabali legend, the ten days, the sadya feast, boat races, Kathakali and more — and shuffles each question's options, so a second play is a genuinely different quiz rather than the same ten in a new order.

Maveli reacts to every answer: he waves you in on the start screen, celebrates when you are right, and gives a sympathetic sigh when you are not. Score ten out of ten and the screen fills with falling flower petals.

It runs three modes side-by-side on the same URL:

| Mode | URL | Who uses it |
|---|---|---|
| Solo quiz | `/` | Anyone — graded, leaderboard at the end |
| Live event host | `/#host` | The person running the show — generates a 4-char session code, displays a QR, and watches a live leaderboard update as people play |
| Live event participant | `/#join` | Audience members — scan the QR, enter name, play at their own pace |

---

## Architecture

```
.
├── functions/
│   └── quiz_api/          # Zoho Catalyst Advanced I/O function (Node.js 24)
│       └── index.js        # All API routes — ~330 lines, no framework
└── onam-quiz/             # Frontend — also the deploy artifact, no build step
    ├── index.html          # Minimal shell, 4 <script> tags in dependency order
    ├── styles.css          # Kerala festival palette, animations, responsive rules
    ├── img/
    │   ├── maveli-welcome.{webp,png}   # start screen
    │   ├── maveli-happy.{webp,png}     # correct answer
    │   ├── maveli-sigh.{webp,png}      # wrong answer
    │   └── join-qr.svg                 # static QR for the live join URL
    └── js/
        ├── questions.js    # 32-question pool across 9 knowledge areas
        ├── api.js          # fetch() wrapper — no SDK, no external libraries
        ├── live.js         # Host dashboard + participant join flow
        └── app.js          # State machine, rendering, petal confetti
```

### Tech stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML + CSS + JS (zero frameworks, zero external libraries) |
| Frontend hosting | Zoho Catalyst Slate (static, `framework = "static"`) |
| Backend | Zoho Catalyst Advanced I/O function, Node.js 24 |
| Database | Zoho Catalyst Data Store (ZCQL) |

### Data store schema

**`Pookalam_Scores`** — one row per play
`session_code | player_name | score | answered | total | ROWID | CREATEDTIME`

- `session_code = 'SOLO'` for single-player runs
- Live sessions use the 4-char code; `ROWID` is updated in-flight as the participant answers

**`Quiz_Sessions`** — one row per live round
`session_code | session_status` (`open` / `closed`)

### API routes

| Method | Path | Purpose |
|---|---|---|
| `GET /` | `/execute/` | Top-10 solo leaderboard |
| `POST /` | `/execute/` | Submit solo score `{name, score, total}` |
| `POST` | `/execute/session/open` | Open a live session → returns `{code}` |
| `POST` | `/execute/session/close` | Close session → returns final board |
| `GET` | `/execute/session/current` | Active session code (or null) |
| `POST` | `/execute/join` | Join as participant → returns `{rowid}` |
| `POST` | `/execute/score` | Update score in-flight `{rowid, score, answered, total}` |
| `GET` | `/execute/board?code=XXXX` | Live leaderboard for a session |

> **These routes are publicly invocable.** Catalyst creates functions with Security Rules `authentication: optional`, and requiring auth would force the Catalyst Web SDK into the frontend, which the no-external-libraries constraint rules out. Anyone who finds the URL can post a score or close a session. The session code acts as a weak shared secret and every input is validated server-side. Fine for a party game; do not copy this posture for anything that matters.

### Design notes

- **Maveli is the feedback channel.** Three pieces of art — welcome, cheering, sighing — carry the whole emotional read of the quiz, so there is no separate "correct/incorrect" chrome to design.
- **Art ships as WebP with a PNG fallback.** `<picture>` keeps the payload at 134KB instead of 1002KB (87% smaller) without showing a broken image on browsers predating WebP. The two reaction images are `rel=prefetch`ed, so the first answer does not wait on a download.
- **Answers are matched by string, not index.** That is what makes shuffling each question's options safe.
- **Keyboard-first.** `A`–`D` select an option, `Enter` advances. Personal best persists in `localStorage`.
- **Perfect scores rain petals.** 72 CSS flower shapes in Kerala festival colours, skipped entirely under `prefers-reduced-motion`.
- **No build step.** The `onam-quiz/` folder deploys as-is. Cache busting is a manual `?v=N` query string, because Slate caches assets for a year and nothing fingerprints filenames.
- **No Catalyst Web SDK on the frontend.** All API calls are raw `fetch()` with a 6-second `AbortController` timeout. Every failure collapses to `null`, so the UI degrades instead of crashing — the solo leaderboard hides itself, the live screens offer a retry.
- **ZCQL injection guard.** Session codes are whitelisted against `/^[A-Z0-9]{1,8}$/` before interpolation into ZCQL queries (ZCQL has no parameter binding).

---

## Local development

```bash
# Install Catalyst CLI
npm install -g zcatalyst-cli

# Serve locally — function on :3000, Slate on :3001
catalyst serve
```

The app detects `localhost` and points `Api` at `http://localhost:3000`. No `.env` needed.

> `catalyst serve` will skip the function with *"Required NodeJS version v24 is not present in the system path"* on any other major version — the stack is pinned to `node24` in `functions/quiz_api/catalyst-config.json`. Slate still serves the frontend, but every API call fails, so you only get the offline degradation paths. Use Node 24 to exercise the backend.

---

## Deployment

```bash
# Deploy only the backend function
catalyst deploy --only functions:quiz_api

# Deploy only the frontend
catalyst deploy slate onam-quiz -m "your message here"

# Deploy everything
catalyst deploy
```

### Bumping the cache key

Slate serves assets with `max-age=31536000`, so bump `?v=N` on every frontend deploy or returning devices keep the old app.

**This is not a find-and-replace.** `onam-quiz/img/join-qr.svg` has the join URL — `?v=` included — encoded *into the QR image*, and scanning is how most people join. A text-only bump leaves the QR pointing at the previous version. Regenerate it in the same commit:

```bash
npx qrcode -t svg -o onam-quiz/img/join-qr.svg \
  "https://onam-quiz-tegpgzpi.onslate.in/?v=<NEW>#join"
```

Then check the QR and the typed fallback in `live.js` still agree.

---

## Database setup

Create two tables in the Catalyst Data Store console:

**Pookalam_Scores**
```
session_code   VARCHAR(8)
player_name    VARCHAR(40)
score          INT
answered       INT
total          INT
```

**Quiz_Sessions**
```
session_code    VARCHAR(8)
session_status  VARCHAR(10)
```

> `session_status` not `status` — Catalyst rejects reserved column names.

---

## Live event checklist

1. Open `/#host` on a laptop or projector
2. Click **Start the quiz** — a 4-char session code appears alongside a QR code
3. Project the screen. Audience scans the QR or types the URL + code
4. Participants play at their own pace — the leaderboard updates live every 3 seconds
5. Click **Close & reveal final scores** when the round is done

The 3-second poll interval is deliberate — Catalyst limits Advanced I/O functions to 10 concurrent executions per environment, and a faster poll would breach it during large groups.

---

## Licence

MIT
