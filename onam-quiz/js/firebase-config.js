/* Firebase web configuration is public by design. Replace these local-emulator
   values with the configuration shown in Firebase Console -> Project settings
   -> Your apps before deploying to Firebase Hosting. */
window.FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDAV1Q7yKQcjXaaoLaYxD5g-cuKCoptaO8',
  authDomain: 'onam-pookalam-quiz.firebaseapp.com',
  databaseURL: 'https://onam-pookalam-quiz-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'onam-pookalam-quiz',
  storageBucket: 'onam-pookalam-quiz.firebasestorage.app',
  messagingSenderId: '383201932745',
  appId: '1:383201932745:web:201577a9dbb7d0cbd0e418'
};

/* Set this to the Firebase Hosting URL before production deployment, then
   regenerate img/join-qr.svg with the same URL plus `/#join`. */
window.QUIZ_PUBLIC_URL = 'https://onam-pookalam-quiz.web.app';

/* `firebase emulators:start` serves Hosting on localhost. Production always
   connects to the databaseURL above after it has been replaced. */
window.FIREBASE_EMULATOR = ['localhost', '127.0.0.1'].includes(location.hostname);
