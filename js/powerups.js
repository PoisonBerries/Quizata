// Pure helpers for the two power-ups — no DOM access, so the tricky math (log-scale
// range narrowing, picking the better of two guesses) is easy to reason about and test
// in isolation from game.js's UI wiring.

import { scoreQuestion } from "./scoring.js";

// Narrows a question's slider range to 1/3 of its width, centered on the player's
// current slider value, clamped to the question's real [min, max]. Works in log space
// for log-scale questions. This only changes what the slider covers for finer control —
// it never nudges toward the real answer, and scoring always uses the original
// question's full min/max, never these narrowed bounds.
export function narrowedRange(question, currentValue) {
  const isLog = question.scale === "log";
  const toSpace = (v) => (isLog ? Math.log10(v) : v);
  const fromSpace = (v) => (isLog ? Math.pow(10, v) : v);

  const loSpace = toSpace(question.min);
  const hiSpace = toSpace(question.max);
  const narrowWidth = (hiSpace - loSpace) / 3;
  const center = toSpace(currentValue);

  let newLo = center - narrowWidth / 2;
  let newHi = center + narrowWidth / 2;
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
