// Crowd-wisdom backend: records each player's accuracy score AND guessed value per
// question in an aggregate-only Firestore doc (no per-player rows — just running sums
// and a score histogram), and returns both a "vs. crowd" score and the crowd's average
// guessed value against everyone who answered that question today so far.
//
// The "vs. crowd" score is a GAP from the crowd's average accuracy, not a percentile
// rank. Rank-based percentile actively feels bad in practice: once a cluster of players
// sits at a similar accuracy, a tiny difference in your own score can swing your rank by
// a lot, so a near-miss gets punished as if it were a real miss (this happened for real —
// a 100-accuracy guess only "beat 71%" of players because several others had also scored
// near-perfect). Comparing to the average instead means the size of the actual gap is
// what matters: a few points behind the crowd costs a few points of score, not a cliff.
//
// Every call here fails soft: if Firebase isn't configured, the network is down, or
// anything else goes wrong, submitAndGetPercentile resolves { vsCrowdScore: null,
// reason: "unavailable" } (never rejects, never hangs past FIREBASE_TIMEOUT_MS) and the
// caller falls back to accuracy-only scoring. A required-but-unreliable network step
// must never block gameplay. "unavailable" is kept distinct from "insufficient" (a
// confirmed too-small sample, known for certain from the same transaction that
// succeeded) so the UI never claims "not enough players" when the real cause was a
// dropped request — that would itself be a misleading number, which is the one thing
// this game is built to avoid.

import { firebaseConfig, isConfigured } from "./firebase-config.js";
import { SCORING_VERSION } from "./scoring.js";

const FIREBASE_SDK_VERSION = "12.19.0";
const FIREBASE_TIMEOUT_MS = 3000;
const MIN_SAMPLE_SIZE = 5;
const BUCKET_COUNT = 20;
const BUCKET_WIDTH = 100 / BUCKET_COUNT;
// How many accuracy-score points behind the crowd's average you can be before the
// vs.-crowd component bottoms out at 0. At or above the average scores 100. A gap of a
// few points — "you were within 5, the average was within 2" — should barely register;
// 50 is generous enough that it does, while a genuinely large gap still costs real score.
const MAX_GAP_SCALE = 50;

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

const UNAVAILABLE = { vsCrowdScore: null, crowdAverageGuess: null, reason: "unavailable" };

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
  // Keyed by scoring version: scoreSum only means something against scores from the same
  // accuracy curve, so a curve change starts fresh documents instead of mixing scales.
  // (The security rules' {questionId} wildcard accepts this without changes.)
  const ref = doc(db, "dailyStats", date, "questions", `${questionId}_s${SCORING_VERSION}`);
  const myBucket = bucketFor(accuracyScore);

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : {};
    const priorCount = data.count || 0;

    let vsCrowdScore = null;
    let crowdAverageGuess = null;
    if (priorCount >= MIN_SAMPLE_SIZE) {
      const crowdAverageAccuracy = (data.scoreSum || 0) / priorCount;
      const gap = Math.max(0, crowdAverageAccuracy - accuracyScore); // 0 if you're at/above average
      vsCrowdScore = Math.round(100 * (1 - Math.min(1, gap / MAX_GAP_SCALE)));
      crowdAverageGuess = (data.valueSum || 0) / priorCount;
    }

    tx.set(
      ref,
      {
        count: increment(1),
        scoreSum: increment(accuracyScore),
        valueSum: increment(guessValue),
        // Not used for scoring anymore (see the gap-based comparison above), kept only
        // in case a future distribution view wants it.
        scoreBuckets: { [String(myBucket)]: increment(1) },
      },
      { merge: true }
    );

    return { vsCrowdScore, crowdAverageGuess, reason: vsCrowdScore == null ? "insufficient" : "ok" };
  });
}

// Resolves { vsCrowdScore, crowdAverageGuess, reason }. vsCrowdScore (0-100, 100 meaning
// at-or-above the crowd's average accuracy) and crowdAverageGuess (in the question's own
// units) are both against everyone who answered this question today before this player,
// present only when reason is "ok". reason is "insufficient" (confirmed too few prior
// answers), or "unavailable" (unconfigured, offline, or timed out — genuinely unknown,
// not to be confused with a confirmed small sample).
export async function submitAndGetPercentile(date, questionId, accuracyScore, guessValue) {
  return withTimeout(doSubmit(date, questionId, accuracyScore, guessValue), FIREBASE_TIMEOUT_MS);
}
