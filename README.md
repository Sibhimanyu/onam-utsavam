# Onam Pookalam Quiz

A browser-based Onam trivia game with a solo leaderboard and a live event
mode. King Maveli reacts to each answer, and a perfect score brings a shower of
flower petals.

| Mode | URL | Use |
|---|---|---|
| Solo | `/` | Play and post a score |
| Host | `/#host` | Start and close a live round |
| Join | `/#join` | Join the active round from a phone |

## Firebase architecture

The app is a static Firebase Hosting site with no server function:

- Firebase Authentication signs each browser in anonymously.
- Realtime Database stores the active session, live players, and solo scores.
- Realtime Database listeners push scoreboard and close events directly to
  clients, replacing the former polling loop.
- [database.rules.json](database.rules.json) restricts player writes to their
  anonymous identity. Session creation belongs to the host identity; any signed
  in device can only close an open session, keeping a projected round recoverable
  after a browser identity is restored.

```
.
├── firebase.json             # Hosting, Emulator, and rules configuration
├── database.rules.json       # Realtime Database security rules
└── onam-quiz/                # Firebase Hosting public directory
    ├── index.html
    ├── styles.css
    ├── img/
    └── js/
        ├── firebase-config.js
        ├── api.js            # Firebase adapter
        ├── live.js           # Host and participant experience
        ├── app.js            # Solo state machine
        └── questions.js
```

## First-time Firebase setup

1. Create a Firebase project and register a Web app in the Firebase console.
2. Enable **Authentication -> Sign-in method -> Anonymous**.
3. Create a **Realtime Database** in production mode.
4. Copy the Firebase Web config into
   [onam-quiz/js/firebase-config.js](onam-quiz/js/firebase-config.js). The
   `databaseURL` is required.
5. Set `window.QUIZ_PUBLIC_URL` to the final Hosting URL, for example
   `https://your-project.web.app`.
6. Regenerate the QR image with that exact public URL:

```bash
npx qrcode -t svg -o onam-quiz/img/join-qr.svg \
  "https://your-project.web.app/#join"
```

Firebase Web config values identify the project; they are not credentials.
Security is enforced by the checked-in Realtime Database rules. Enable Firebase
App Check before exposing the app beyond a trusted event audience.

## Local development

```bash
npm install -g firebase-tools
firebase login
firebase emulators:start
```

Open `http://127.0.0.1:5000`. On localhost the app automatically uses the
Authentication and Realtime Database emulators, so it does not touch the
production project.

## Deployment

Choose the Firebase project once for this checkout:

```bash
firebase use --add
```

Deploy authentication, rules, and the static app:

```bash
firebase deploy --only auth
firebase deploy --only database
firebase deploy --only hosting
```

`firebase deploy` deploys both. After the first deployment, verify the host
screen's typed join URL and QR image both point at the Firebase Hosting domain.

## Live event checklist

1. Open `/#host` on the projector and start a round.
2. Project the generated code and QR image.
3. Participants scan the code, enter a name, and play independently.
4. The leaderboard updates immediately as score writes arrive.
5. Close the round to reveal final standings on every joined device.

## Licence

MIT
