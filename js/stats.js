// Personal stats derived purely from saved results (no DOM, no fetching), so the
// arithmetic — streaks, tier buckets, per-category breakdowns — can be tested in
// isolation from statsView.js.

import { BANDS, MAX_DAILY_SCORE, TIERS, bandForScore, finalScoreOf, tierForScore } from "./scoring.js";

function dayDiff(fromDate, toDate) {
  return Math.round((new Date(`${toDate}T00:00:00`) - new Date(`${fromDate}T00:00:00`)) / 86400000);
}

// Completed results always carry a stored total; recompute from the guesses only if a
// result somehow lacks one, so an old or partial save never turns into NaN.
function totalOf(result) {
  if (Number.isFinite(result.score)) return result.score;
  return (result.guesses ?? []).reduce((sum, g) => sum + finalScoreOf(g), 0);
}

export function longestStreak(sortedDates) {
  let best = 0;
  let run = 0;
  sortedDates.forEach((date, i) => {
    run = i > 0 && dayDiff(sortedDates[i - 1], date) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

// A streak is only "current" if it reaches today or yesterday — otherwise it already
// broke and the stored counter (which only updates when you next play) would overstate it.
export function currentStreak(sortedDates, today) {
  if (sortedDates.length === 0) return 0;
  const last = sortedDates[sortedDates.length - 1];
  if (dayDiff(last, today) > 1) return 0;
  let run = 1;
  for (let i = sortedDates.length - 1; i > 0; i--) {
    if (dayDiff(sortedDates[i - 1], sortedDates[i]) !== 1) break;
    run++;
  }
  return run;
}

// results: { [date]: { score, guesses: [{ questionId, finalScore | score, ... }] } }
// puzzlesByDate: { [date]: { questions: [{ id, category, ... }] } } — any date may be missing.
export function computeStats(results, puzzlesByDate, { today, highlightDate } = {}) {
  const dates = Object.keys(results).sort();
  const totals = dates.map((d) => totalOf(results[d]));

  const tierBuckets = TIERS.map((tier, i) => ({
    name: tier.name,
    min: tier.min,
    max: i === 0 ? MAX_DAILY_SCORE : TIERS[i - 1].min - 1,
    count: 0,
  }));
  totals.forEach((total) => {
    tierBuckets.find((b) => b.name === tierForScore(total)).count++;
  });

  const categories = new Map();
  dates.forEach((date) => {
    const puzzle = puzzlesByDate[date];
    if (!puzzle) return;
    (results[date].guesses ?? []).forEach((guess, i) => {
      const question = puzzle.questions.find((q) => q.id === guess.questionId) ?? puzzle.questions[i];
      if (!question) return;
      const score = finalScoreOf(guess);
      const entry = categories.get(question.category) ?? {
        category: question.category,
        questions: 0,
        sum: 0,
        bands: Object.fromEntries(BANDS.map((b) => [b.key, 0])),
      };
      entry.questions++;
      entry.sum += score;
      entry.bands[bandForScore(score).key]++;
      categories.set(question.category, entry);
    });
  });

  // Most-answered categories first: ranking by average alone would put a category you've
  // answered once at the top as if it were your strongest, which is just noise.
  const categoryStats = [...categories.values()]
    .map((c) => ({ ...c, average: Math.round(c.sum / c.questions) }))
    .sort((a, b) => b.questions - a.questions || b.average - a.average || a.category.localeCompare(b.category));

  const played = dates.length;
  return {
    played,
    average: played ? Math.round(totals.reduce((a, b) => a + b, 0) / played) : 0,
    best: played ? Math.max(...totals) : 0,
    currentStreak: today ? currentStreak(dates, today) : 0,
    longestStreak: longestStreak(dates),
    tierBuckets,
    highlightTier: highlightDate && results[highlightDate] ? tierForScore(totalOf(results[highlightDate])) : null,
    categories: categoryStats,
  };
}
