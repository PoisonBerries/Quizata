// Local, per-browser progress: streak, per-day results, running totals.
// Nothing here is shared across players — that's Phase 2 (see README).

const STORAGE_KEY = "quizata:v1";

function defaultState() {
  return {
    streak: 0,
    lastPlayedDate: null,
    results: {}, // dateString -> { score, tier, guesses: [{questionId, guess, score}], playedAt }
    inProgress: {}, // dateString -> { guesses: [{questionId, guess, score}] } — cleared once that day is completed
    gamesPlayed: 0,
    totalScore: 0,
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
  } catch {
    return defaultState();
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable (private mode, quota, etc.) — game still works, just doesn't persist.
  }
}

export function getResultFor(dateString) {
  return loadState().results[dateString] || null;
}

export function getProgressFor(dateString) {
  return loadState().inProgress[dateString] || null;
}

export function saveProgress(dateString, { guesses }) {
  const state = loadState();
  state.inProgress[dateString] = { guesses };
  saveState(state);
}

function clearProgress(state, dateString) {
  delete state.inProgress[dateString];
}

function isConsecutiveDay(prevDateString, dateString) {
  if (!prevDateString) return false;
  const prev = new Date(`${prevDateString}T00:00:00`);
  const cur = new Date(`${dateString}T00:00:00`);
  const diffDays = Math.round((cur - prev) / 86400000);
  return diffDays === 1;
}

export function recordResult(dateString, { score, tier, guesses }) {
  const state = loadState();
  if (state.results[dateString]) return state; // already recorded, don't double-count streak/totals

  if (isConsecutiveDay(state.lastPlayedDate, dateString)) {
    state.streak += 1;
  } else if (state.lastPlayedDate !== dateString) {
    state.streak = 1;
  }
  state.lastPlayedDate = dateString;
  state.results[dateString] = { score, tier, guesses, playedAt: new Date().toISOString() };
  clearProgress(state, dateString);
  state.gamesPlayed += 1;
  state.totalScore += score;

  saveState(state);
  return state;
}

export function getStats() {
  const state = loadState();
  const avg = state.gamesPlayed ? Math.round(state.totalScore / state.gamesPlayed) : 0;
  return { streak: state.streak, gamesPlayed: state.gamesPlayed, averageScore: avg };
}
