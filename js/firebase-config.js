// Firebase Web app config for the crowd-scoring backend (project: quizata-67786).
// These values are not secret — a Firebase web config is meant to be public; access
// control is enforced by Firestore security rules, not by hiding this file. See
// README.md for the setup steps and the rules text.
//
// Until real values are pasted in below, isConfigured stays false and js/crowd.js
// no-ops entirely, so the game runs fine (accuracy-only scoring) without a backend.

export const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME",
};

export const isConfigured = firebaseConfig.apiKey !== "REPLACE_ME";
