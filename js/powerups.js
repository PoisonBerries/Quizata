// Pure helpers for the two power-ups — no DOM access, so the tricky math (log-scale
// range narrowing, picking the better of two guesses) is easy to reason about and test
// in isolation from game.js's UI wiring.

import { scoreQuestion } from "./scoring.js";

// Narrows a question's slider range to 1/3 of its width, centered on the player's
// current slider value, clamped to the question's real [min, max]. Works in log space
// for log-scale questions. Scoring always uses the original question's full min/max,
// never these narrowed bounds — narrowing only changes what the slider covers.
//
// The narrowed window is guaranteed to always contain the real answer. Without that
// guarantee, a bad initial guess could narrow the answer entirely out of reach, making
// the question unwinnable for the rest of that guess — a punishment far harsher than
// "the power-up didn't help." When the naive centered window would exclude the answer,
// it's shifted just past it — not glued to it, since stopping exactly at the answer
// would make that boundary number reveal the answer outright. The shift overshoots by a
// randomized margin so the window's edges never pinpoint the exact value.
export function narrowedRange(question, currentValue) {
  const isLog = question.scale === "log";
  const toSpace = (v) => (isLog ? Math.log10(v) : v);
  const fromSpace = (v) => (isLog ? Math.pow(10, v) : v);

  const loSpace = toSpace(question.min);
  const hiSpace = toSpace(question.max);
  const narrowWidth = (hiSpace - loSpace) / 3;
  const answerSpace = toSpace(question.answer);
  const center = toSpace(currentValue);

  let newLo = center - narrowWidth / 2;
  let newHi = center + narrowWidth / 2;

  const clampToBounds = () => {
    if (newLo < loSpace) {
      newHi += loSpace - newLo;
      newLo = loSpace;
    }
    if (newHi > hiSpace) {
      newLo -= newHi - hiSpace;
      newHi = hiSpace;
    }
    newLo = Math.max(newLo, loSpace);
    newHi = Math.min(newHi, hiSpace);
  };

  clampToBounds();

  if (answerSpace < newLo) {
    const margin = narrowWidth * (0.1 + Math.random() * 0.15);
    const shift = newLo - (answerSpace - margin);
    newLo -= shift;
    newHi -= shift;
  } else if (answerSpace > newHi) {
    const margin = narrowWidth * (0.1 + Math.random() * 0.15);
    const shift = answerSpace + margin - newHi;
    newLo += shift;
    newHi += shift;
  }

  // Re-clamp in case the answer-inclusion shift pushed past the question's real bounds
  // (only possible right at the edges) — safe to tighten here since the answer is by
  // definition within [loSpace, hiSpace], so this can never re-exclude it.
  clampToBounds();

  return { min: fromSpace(newLo), max: fromSpace(newHi) };
}

// Scores both guess attempts against the real question and keeps the better one. The
// real answer is never shown between the two guesses, so this only insures against a
// single bad commit, not a way to reverse-engineer the answer.
export function pickBetterGuess(question, valueA, valueB) {
  const scoreA = scoreQuestion(question, valueA);
  const scoreB = scoreQuestion(question, valueB);
  return scoreA >= scoreB ? { value: valueA, accuracyScore: scoreA } : { value: valueB, accuracyScore: scoreB };
}
