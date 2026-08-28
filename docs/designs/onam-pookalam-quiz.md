# Design: Onam Pookalam Quiz on Firebase

## Goal

Keep the existing no-build quiz experience while replacing Zoho Catalyst
Functions, Slate, and Data Store with Firebase Hosting, Anonymous
Authentication, and Realtime Database.

## Data model

```text
live
  code, hostUid, openedAt

sessions/{code}
  status: open | closed
  hostUid, createdAt

players/{code}/{playerId}
  uid, player_name, score, answered, total, createdAt, updatedAt

soloScores/{uid}
  player_name, score, answered, total, createdAt, updatedAt
```

`live` points at the session offered to a participant opening `/#join`.
Scoreboards are sorted in the client by score, answered count, then creation
time. Queries retrieve only the top 50 rows; solo mode retains one personal
best per anonymous identity. Realtime Database listeners update the host board
and participant close state without periodic HTTP requests.

## Authentication and rules

The frontend calls `signInAnonymously()` before any database operation. The
Realtime Database rules require an authenticated user and bind a player row to
its anonymous `uid`; another participant cannot overwrite it. Session creation
is bound to its host, while any authenticated device may make the one-way
`open` to `closed` transition so a host can recover after identity restoration.

This is appropriate for a party-game leaderboard, not a high-trust competition.
Firebase App Check should be enabled for public events, and a server-side
authority would be required to prevent every form of score manipulation.

## Local and production behavior

`firebase.json` maps Firebase Hosting directly to `onam-quiz/` and configures
the Authentication and Realtime Database emulators. On localhost,
`firebase-config.js` selects those emulators; elsewhere it expects the Firebase
Web configuration supplied during project setup.

The QR image cannot infer a future Hosting domain. Set `QUIZ_PUBLIC_URL` and
regenerate `img/join-qr.svg` before the first production deploy, then verify it
matches the typed join URL on `/#host`.
