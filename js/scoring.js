// Scoring and log/linear slider math live together because both need to agree on
// what "distance" means for a given question's scale.

const LOG_FLOOR = 1e-6; // used only when a log-scale question's min is <= 0, which validation disallows anyway

export function questionBounds(question) {
  if (question.scale === "log") {
    const lo = Math.log10(question.min > 0 ? question.min : LOG_FLOOR);
    const hi = Math.log10(question.max);
    return { lo, hi };
  }
  return { lo: question.min, hi: question.max };
}

// Maps a slider's raw 0..sliderMax position to a real-world value for the question.
export function sliderPositionToValue(question, position, sliderMax) {
  const t = position / sliderMax;
  const { lo, hi } = questionBounds(question);
  const v = lo + t * (hi - lo);
  return question.scale === "log" ? Math.pow(10, v) : v;
}

// Inverse of the above — used to place the "actual answer" marker on the track.
export function valueToSliderPosition(question, value, sliderMax) {
  const { lo, hi } = questionBounds(question);
  const v = question.scale === "log" ? Math.log10(Math.max(value, question.min > 0 ? question.min : LOG_FLOOR)) : value;
  const t = (v - lo) / (hi - lo);
  return Math.round(Math.min(1, Math.max(0, t)) * sliderMax);
}

// Bump whenever scoreQuestion's curve changes. Crowd stats are stored per scoring version
// (see crowd.js) so scores from one curve are never averaged against another's.
export const SCORING_VERSION = 2;

// A miss this large (as a fraction of the slider's range) scores 0.
export const ACCURACY_ZERO_AT = 0.6;

// 0-100 per question. "Miss" is the distance from the answer as a fraction of the
// slider's range, measured on the question's own scale (log for log questions).
// Accuracy is linear closeness, squared: small misses cost a little, bigger ones cost
// disproportionately more, and anything ACCURACY_ZERO_AT or further away is worth 0.
// A plain linear falloff was too generous — locking the default midpoint on every
// question, without touching the slider, landed a "Sharp Eye" day.
export function scoreQuestion(question, guess) {
  const { lo, hi } = questionBounds(question);
  const g = question.scale === "log" ? Math.log10(Math.max(guess, question.min > 0 ? question.min : LOG_FLOOR)) : guess;
  const a = question.scale === "log" ? Math.log10(question.answer) : question.answer;
  const miss = Math.abs(g - a) / (hi - lo);
  const closeness = Math.max(0, 1 - miss / ACCURACY_ZERO_AT);
  return Math.round(100 * closeness * closeness);
}

// Half accuracy, half how you compare to the crowd's average accuracy on this question
// today (vsCrowdScore, 0-100 — see crowd.js for why this is a gap from the average
// rather than a percentile rank) — falls back to accuracy alone when there isn't enough
// crowd data yet (vsCrowdScore is null). A power-up used on this question caps the
// ceiling: 90 for one used, 80 for both, so precision help is a real tradeoff rather
// than a free win.
export function combineScore(accuracyScore, vsCrowdScore, powerUpsUsedCount = 0) {
  const raw = vsCrowdScore == null ? accuracyScore : Math.round(0.5 * accuracyScore + 0.5 * vsCrowdScore);
  const cap = 100 - 10 * powerUpsUsedCount;
  return Math.min(raw, cap);
}

// Guesses saved before the crowd-scoring update stored a single accuracy-only "score"
// field; current guesses store "finalScore". A previously-completed result read back
// from localStorage must never show NaN/undefined just because the schema grew a field.
export function finalScoreOf(guess) {
  return guess.finalScore ?? guess.score ?? 0;
}

// Daily-total tiers, highest first. Exported so the stats screen buckets scores with the
// exact same thresholds the results screen labels them with.
export const MAX_DAILY_SCORE = 500;
export const TIERS = [
  { name: "Reality Master", min: 450 },
  { name: "Sharp Eye", min: 350 },
  { name: "Well Calibrated", min: 250 },
  { name: "Getting There", min: 150 },
  { name: "Keep Guessing", min: 0 },
];

export function tierForScore(totalScore) {
  return (TIERS.find((t) => totalScore >= t.min) ?? TIERS[TIERS.length - 1]).name;
}

// Per-question score bands, best first. "key" names the matching --good/--ok/--meh/--bad
// color in styles.css; "emoji" is what the share grid uses.
export const BANDS = [
  { key: "good", min: 90, emoji: "🟩" },
  { key: "ok", min: 70, emoji: "🟨" },
  { key: "meh", min: 40, emoji: "🟧" },
  { key: "bad", min: 0, emoji: "🟥" },
];

export function bandForScore(score) {
  return BANDS.find((b) => score >= b.min) ?? BANDS[BANDS.length - 1];
}

export function emojiForQuestionScore(score) {
  return bandForScore(score).emoji;
}
