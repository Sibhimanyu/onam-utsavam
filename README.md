# 🌸 Onam Pookalam Quiz

> A Kerala festival quiz where every correct answer blooms another ring on a traditional pookalam flower mandala.

**Live →** https://onam-quiz-tegpgzpi.onslate.in

---

## What it is

The Onam Pookalam Quiz is a festive, browser-based trivia game built for Onam celebrations. Ten questions drawn from a randomised pool of 32 across nine areas of Kerala culture — history, traditions, the sadya feast, boat races, Kathakali, and more. Every answer you give lays a new ring of flowers on your pookalam. Finish all ten questions and your pookalam is complete.

It runs two modes side-by-side on the same URL:

| Mode | URL | Who uses it |
|---|---|---|
| Solo quiz | `/` | Anyone — graded, leaderboard at the end |
| Live event host | `/#host` | The person running the show — generates a 4-char session code, displays a QR, and watches a live leaderboard update as people play |
| Live event participant | `/#join` | Audience members — scan the QR, enter name, play at their own pace |

---

## Screenshots

| Start screen | Question screen | Result screen |
|---|---|---|
| Maveli floats under his gold umbrella while the un-bloomed pookalam waits | Each answer blooms one ring in saturated Kerala festival colours | The fully-bloomed pookalam is your score |

---

## Architecture

```
cayenne/
├── functions/
│   └── quiz_api/          # Zoho Catalyst Advanced I/O function (Node.js 24)
│       └── index.js        # All API routes — ~280 lines, no framework
└── onam-quiz/             # Frontend — also the deploy artifact, no build step
    ├── index.html          # Minimal shell, 5 <script> tags in dependency order
    ├── styles.css          # Kerala festival palette, two-column grid, animations
    └── js/
        ├── questions.js    # 32 questions across 9 knowledge areas
        ├── pookalam.js     # SVG pookalam builder + bloom animation engine
        ├── api.js          # fetch() wrapper — no SDK, no external libraries
        ├── live.js         # Host dashboard + participant join flow
        └── app.js          # State machine, routing, King Maveli SVG, rendering
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

### Design highlights

- **The pookalam is the progress bar.** 10 rings, one per question. Correct → festival colour; wrong → muted taupe `#CBC3B4`. The finished artwork is the score.
- **King Maveli** floats on the start screen — a hand-drawn SVG (21 elements) with a gentle float animation. He descends from Vaikuntha every Onam; now he descends onto the start screen too.
- **No build step.** The `onam-quiz/` folder deploys as-is. Cache busting via manual `?v=N` query strings (Slate caches assets for 1 year).
- **No Catalyst Web SDK on the frontend.** All API calls are raw `fetch()` with a 6-second `AbortController` timeout. Failures are silent — the quiz continues unaffected.
- **ZCQL injection guard.** Session codes are whitelisted against `/^[A-Z0-9]{1,8}$/` before interpolation into ZCQL queries (ZCQL has no parameter binding).

---

## Local development

```bash
# Install Catalyst CLI
npm install -g zcatalyst-cli

# Serve locally (function on :3000, Slate on :5000)
catalyst serve
```

The app detects `localhost` and switches `Api` to `http://localhost:3000`. No `.env` needed.

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
