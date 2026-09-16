// Crowd-wisdom backend: records each player's accuracy score AND guessed value per
// question in an aggregate-only Firestore doc (no per-player rows — just running sums
// and a score histogram), and returns both a percentile rank and the crowd's average
// guessed value against everyone who answered that question today so far.
//
// Every call here fails soft: if Firebase isn't configured, the network is down, or
// anything else goes wrong, submitAndGetPercentile resolves { percentile: null,
// reason: "unavailable" } (never rejects, never hangs past FIREBASE_TIMEOUT_MS) and the
// caller falls back to accuracy-only scoring. A required-but-unreliable network step
// must never block gameplay. "unavailable" is kept distinct from "insufficient" (a
// confirmed too-small sample, known for certain from the same transaction that
// succeeded) so the UI never claims "not enough players" when the real cause was a
// dropped request — that would itself be a misleading number, which is the one thing
// this game is built to avoid.

import { firebaseConfig, isConfigured } from "./firebase-config.js";

const FIREBASE_SDK_VERSION = "12.19.0";
const FIREBASE_TIMEOUT_MS = 3000;
const MIN_SAMPLE_SIZE = 5;
const BUCKET_COUNT = 20;
const BUCKET_WIDTH = 100 / BUCKET_COUNT;

let firebasePromise = null;

function loadFirebase() {
  if (!isConfigured) return Promise.resolve(null);
  if (!firebasePromise) {
    firebasePromise = (async () => {
      const base = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;
      const [{ initializeApp }, firestore, { getAuth, signInAnonymously }] = await Promise.all([
        import(/* @vite-ignore */ `${base}/firebase-app.js`),
        import(/* @vite-ignore */ `${base}/firebase-firestore.js`),
        import(/* @vite-ignore */ `${base}/firebase-auth.js`),
      ]);
      const app = initializeApp(firebaseConfig);
      await signInAnonymously(getAuth(app));
      const db = firestore.getFirestore(app);
      return { db, ...firestore };
    })().catch((err) => {
      console.warn("Quizata: crowd backend failed to initialize", err);
      return null;
    });
  }
  return firebasePromise;
}

function bucketFor(score) {
  return Math.min(BUCKET_COUNT - 1, Math.max(0, Math.floor(score / BUCKET_WIDTH)));
}

const UNAVAILABLE = { percentile: null, crowdAverageGuess: null, reason: "unavailable" };

function withTimeout(promise, ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(UNAVAILABLE), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(UNAVAILABLE);
      }
    );
  });
}

async function doSubmit(date, questionId, accuracyScore, guessValue) {
  const fb = await loadFirebase();
  if (!fb) return UNAVAILABLE;
  const { db, doc, runTransaction, increment } = fb;
  const ref = doc(db, "dailyStats", date, "questions", questionId);
  const myBucket = bucketFor(accuracyScore);

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : {};
    const priorCount = data.count || 0;
    const buckets = data.scoreBuckets || {};

    let percentile = null;
    let crowdAverageGuess = null;
    if (priorCount >= MIN_SAMPLE_SIZE) {
      let below = 0;
      for (let b = 0; b < myBucket; b++) below += buckets[String(b)] || 0;
      const inMine = buckets[String(myBucket)] || 0;
      percentile = Math.round((100 * (below + inMine / 2)) / priorCount);
      crowdAverageGuess = (data.valueSum || 0) / priorCount;
    }

    tx.set(
      ref,
      {
        count: increment(1),
        scoreSum: increment(accuracyScore),
        valueSum: increment(guessValue),
        scoreBuckets: { [String(myBucket)]: increment(1) },
      },
      { merge: true }
    );

    return { percentile, crowdAverageGuess, reason: percentile == null ? "insufficient" : "ok" };
  });
}

// Resolves { percentile, crowdAverageGuess, reason }. percentile (0-100) and
// crowdAverageGuess (in the question's own units) are both against everyone who
// answered this question today before this player, present only when reason is "ok".
// reason is "insufficient" (confirmed too few prior answers), or "unavailable"
// (unconfigured, offline, or timed out — genuinely unknown, not to be confused with a
// confirmed small sample).
export async function submitAndGetPercentile(date, questionId, accuracyScore, guessValue) {
  return withTimeout(doSubmit(date, questionId, accuracyScore, guessValue), FIREBASE_TIMEOUT_MS);
}
