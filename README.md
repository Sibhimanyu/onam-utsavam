# Onam Pookalam Quiz

A real-time Kerala Onam trivia game for solo play or a room-wide quiz. King
Maveli celebrates correct answers, hosts can start a QR-join round, and every
player's progress appears on a live leaderboard.

## Play online

| Experience | Link |
|---|---|
| Play solo | [onam-pookalam-quiz.web.app](https://onam-pookalam-quiz.web.app/) |
| Host a live round | [Open host view](https://onam-pookalam-quiz.web.app/#host) |
| Join a live round | [Open join view](https://onam-pookalam-quiz.web.app/#join) |

## Features

- Solo Onam trivia with a personal best score.
- Host-controlled live rounds with QR joining and a short room code.
- Firebase Realtime Database leaderboard updates and round-close events.
- Projector-ready final standings with the champion, podium, and a scrollable
  score board.
- Anonymous Firebase Authentication, so players do not need an account.

## Technology

- Vanilla HTML, CSS, and JavaScript.
- Firebase Hosting.
- Firebase Authentication with anonymous sign-in.
- Firebase Realtime Database with checked-in security rules.

## Run locally

Install the Firebase CLI and sign in once:

```bash
npm install -g firebase-tools
firebase login
firebase emulators:start
```

Open `http://127.0.0.1:5000`. The app uses the Authentication and Realtime
Database emulators on localhost, keeping local sessions separate from the live
quiz.

## Deploy

The configured Firebase project is `onam-pookalam-quiz`.

```bash
firebase deploy
```

This deploys Hosting, Authentication configuration, and Realtime Database
rules. The Firebase web configuration in
[onam-quiz/js/firebase-config.js](onam-quiz/js/firebase-config.js) identifies
the public project; access control lives in
[database.rules.json](database.rules.json).

## Live event flow

1. Open the [host view](https://onam-pookalam-quiz.web.app/#host) on a shared screen.
2. Start a round and have players scan the QR code or enter the displayed code.
3. Players answer independently while the leaderboard updates in real time.
4. Close the round to reveal the final standings.

## Licence

MIT
