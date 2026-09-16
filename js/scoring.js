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

// 0-100 per question, based on normalized distance on the question's own scale.
export function scoreQuestion(question, guess) {
  const { lo, hi } = questionBounds(question);
  const g = question.scale === "log" ? Math.log10(Math.max(guess, question.min > 0 ? question.min : LOG_FLOOR)) : guess;
  const a = question.scale === "log" ? Math.log10(question.answer) : question.answer;
  const dist = Math.abs(g - a) / (hi - lo);
  return Math.round(Math.max(0, 100 * (1 - dist)));
}

// Half accuracy, half how you compare to everyone else who answered this question today
// (percentile, 0-100) — falls back to accuracy alone when there isn't enough crowd data
// yet (percentile is null). A power-up used on this question caps the ceiling: 90 for
// one used, 80 for both, so precision help is a real tradeoff rather than a free win.
export function combineScore(accuracyScore, percentile, powerUpsUsedCount = 0) {
  const raw = percentile == null ? accuracyScore : Math.round(0.5 * accuracyScore + 0.5 * percentile);
  const cap = 100 - 10 * powerUpsUsedCount;
  return Math.min(raw, cap);
}

// Guesses saved before the crowd-scoring update stored a single accuracy-only "score"
// field; current guesses store "finalScore". A previously-completed result read back
// from localStorage must never show NaN/undefined just because the schema grew a field.
export function finalScoreOf(guess) {
  return guess.finalScore ?? guess.score ?? 0;
}

export function tierForScore(totalScore) {
  if (totalScore >= 450) return "Reality Master";
  if (totalScore >= 350) return "Sharp Eye";
  if (totalScore >= 250) return "Well Calibrated";
  if (totalScore >= 150) return "Getting There";
  return "Keep Guessing";
}

export function emojiForQuestionScore(score) {
  if (score >= 90) return "🟩";
  if (score >= 70) return "🟨";
  if (score >= 40) return "🟧";
  return "🟥";
}
