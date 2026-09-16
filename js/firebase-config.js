// Firebase Web app config for the crowd-scoring backend (project: quizata-67786).
// These values are not secret — a Firebase web config is meant to be public; access
// control is enforced by Firestore security rules, not by hiding this file. See
// README.md for the setup steps and the rules text.
//
// Until real values are pasted in below, isConfigured stays false and js/crowd.js
// no-ops entirely, so the game runs fine (accuracy-only scoring) without a backend.

export const firebaseConfig = {
  apiKey: "AIzaSyCv3XO8MyshiDSr5slXUF_yhXDICYm4eZ8",
  authDomain: "quizata-67786.firebaseapp.com",
  projectId: "quizata-67786",
  storageBucket: "quizata-67786.firebasestorage.app",
  messagingSenderId: "16920741250",
  appId: "1:16920741250:web:591ad1d56a0a77b16dbb9b",
};

export const isConfigured = firebaseConfig.apiKey !== "REPLACE_ME";
