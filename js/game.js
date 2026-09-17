import { sliderPositionToValue, valueToSliderPosition, scoreQuestion, combineScore, tierForScore, emojiForQuestionScore, finalScoreOf } from "./scoring.js";
import { formatValue } from "./format.js";
import { narrowedRange, pickBetterGuess } from "./powerups.js";
import { submitAndGetPercentile } from "./crowd.js";

const SLIDER_MAX = 1000;

const els = {
  progressDots: document.getElementById("progress-dots"),
  gameScreen: document.getElementById("game-screen"),
  qCategory: document.getElementById("q-category"),
  qPrompt: document.getElementById("q-prompt"),
  qReadout: document.getElementById("q-readout"),
  qSlider: document.getElementById("q-slider"),
  firstGuessMarker: document.getElementById("first-guess-marker"),
  qMinLabel: document.getElementById("q-min-label"),
  qMaxLabel: document.getElementById("q-max-label"),
  lockBtn: document.getElementById("lock-guess-btn"),
  narrowBtn: document.getElementById("narrow-btn"),
  narrowCharge: document.getElementById("narrow-charge"),
  secondGuessBtn: document.getElementById("second-guess-btn"),
  secondGuessCharge: document.getElementById("second-guess-charge"),
  powerupHint: document.getElementById("powerup-hint"),

  revealScreen: document.getElementById("reveal-screen"),
  rCategory: document.getElementById("r-category"),
  rPrompt: document.getElementById("r-prompt"),
  rTrack: document.getElementById("r-track"),
  rGuessMarker: document.getElementById("r-guess-marker"),
  rGuessLabel: document.getElementById("r-guess-label"),
  rActualMarker: document.getElementById("r-actual-marker"),
  rActualLabel: document.getElementById("r-actual-label"),
  rCrowdMarker: document.getElementById("r-crowd-marker"),
  rCrowdLabel: document.getElementById("r-crowd-label"),
  rEmoji: document.getElementById("r-emoji"),
  rScore: document.getElementById("r-score"),
  rScoreSubline: document.getElementById("r-score-subline"),
  rInsight: document.getElementById("r-insight"),
  rSourceLink: document.getElementById("r-source-link"),
  nextBtn: document.getElementById("next-question-btn"),
};

function show(screenEl) {
  ["game-screen", "reveal-screen"].forEach((id) => {
    document.getElementById(id).hidden = document.getElementById(id) !== screenEl;
  });
  screenEl.hidden = false;
}

// Both markers' labels are anchored to their own dot's x-position, so when the guess and
// actual value land close together on the track, the two dots (and their labels, one above
// the track and one below) can visually merge. Nudge them apart just enough to stay legible —
// the label text itself always shows the true, un-nudged value. A gap under
// NEAR_EXACT_GAP_PCT is left alone on purpose — a bullseye or near-bullseye guess should
// show as one overlapping dot, not get artificially pulled apart.
const NEAR_EXACT_GAP_PCT = 2;
const MIN_MARKER_GAP_PCT = 6;
const EDGE_ZONE_PCT = 8;

function positionRevealMarkers(question, guessValue, crowdAverageGuess) {
  let guessPct = valueToSliderPosition(question, guessValue, 100);
  let actualPct = valueToSliderPosition(question, question.answer, 100);

  const gap = Math.abs(guessPct - actualPct);
  if (gap >= NEAR_EXACT_GAP_PCT && gap < MIN_MARKER_GAP_PCT) {
    const shift = (MIN_MARKER_GAP_PCT - gap) / 2;
    if (guessPct <= actualPct) {
      guessPct = Math.max(0, guessPct - shift);
      actualPct = Math.min(100, actualPct + shift);
    } else {
      guessPct = Math.min(100, guessPct + shift);
      actualPct = Math.max(0, actualPct - shift);
    }
  }

  placeMarker(els.rGuessMarker, guessPct);
  placeMarker(els.rActualMarker, actualPct);

  if (crowdAverageGuess == null) {
    els.rCrowdMarker.hidden = true;
    return;
  }
  let crowdPct = valueToSliderPosition(question, crowdAverageGuess, 100);
  // The crowd marker only needs to dodge guess/actual (which may themselves overlap by
  // design) — a bullseye guess/actual pair shouldn't get pried apart just because the
  // crowd marker also wants space nearby. Same near-exact exception as above: if the
  // crowd average lands on (or right next to) your guess or the actual answer, that's a
  // genuinely interesting coincidence worth showing as a real overlap, not a smear.
  for (let iter = 0; iter < 4; iter++) {
    let moved = false;
    for (const other of [guessPct, actualPct]) {
      const crowdGap = crowdPct - other;
      if (Math.abs(crowdGap) >= NEAR_EXACT_GAP_PCT && Math.abs(crowdGap) < MIN_MARKER_GAP_PCT) {
        crowdPct = other + Math.sign(crowdGap || 1) * MIN_MARKER_GAP_PCT;
        moved = true;
      }
    }
    if (!moved) break;
  }
  crowdPct = Math.min(100, Math.max(0, crowdPct));
  els.rCrowdMarker.hidden = false;
  placeMarker(els.rCrowdMarker, crowdPct);
}

function placeMarker(markerEl, pct) {
  markerEl.style.left = `${pct}%`;
  markerEl.classList.remove("edge-low", "edge-high");
  if (pct < EDGE_ZONE_PCT) markerEl.classList.add("edge-low");
  else if (pct > 100 - EDGE_ZONE_PCT) markerEl.classList.add("edge-high");
}

// Spells out the actual arithmetic behind the score shown above it — half accuracy,
// half vs. the crowd, averaged together, with a plain note when a power-up capped it —
// rather than leaving the player to take the number on faith.
function sublineFor(guessRecord) {
  let basis;
  if (guessRecord.crowdReason === "ok") {
    basis = `${guessRecord.accuracyScore} accuracy + ${guessRecord.vsCrowdScore} vs. crowd, averaged`;
  } else if (guessRecord.crowdReason === "insufficient") {
    basis = `${guessRecord.accuracyScore} accuracy only — not enough players yet`;
  } else {
    // "unavailable": the comparison genuinely couldn't be confirmed (offline, unconfigured,
    // timed out) — never claim "not enough players" here, since that's a specific, false claim.
    basis = `${guessRecord.accuracyScore} accuracy only this time`;
  }

  if (guessRecord.powerUpsUsed.length === 0) return basis;
  const cap = 100 - 10 * guessRecord.powerUpsUsed.length;
  return `${basis} · capped at ${cap} for using a power-up`;
}

function renderProgressDots(total, currentIndex, completedCount) {
  els.progressDots.innerHTML = "";
  for (let i = 0; i < total; i++) {
    const dot = document.createElement("span");
    dot.className = "dot";
    if (i < completedCount) dot.classList.add("filled");
    if (i === currentIndex) dot.classList.add("current");
    els.progressDots.appendChild(dot);
  }
}

export function runGame(puzzle, { onComplete, onProgress, resumeFrom, date }) {
  const questions = puzzle.questions;
  const state = resumeFrom
    ? { index: resumeFrom.guesses.length, guesses: [...resumeFrom.guesses] }
    : { index: 0, guesses: [] };

  // Reset fresh at the start of each question; tracks this question's in-flight
  // power-up usage before it's committed to state.guesses.
  let qState = null;

  function dailyChargeUsed(kind) {
    return state.guesses.some((g) => g.powerUpsUsed.includes(kind)) || (qState && qState[`${kind}Used`]);
  }

  function updatePowerUpButtons() {
    const narrowSpent = dailyChargeUsed("narrow");
    els.narrowBtn.disabled = narrowSpent || qState.awaitingSecondGuess;
    els.narrowCharge.textContent = narrowSpent ? "0" : "1";

    const secondGuessSpent = dailyChargeUsed("secondGuess");
    els.secondGuessBtn.disabled = secondGuessSpent || qState.awaitingSecondGuess;
    els.secondGuessBtn.setAttribute("aria-pressed", String(qState.secondGuessArmed));
    els.secondGuessCharge.textContent = secondGuessSpent ? "0" : "1";

    if (qState.awaitingSecondGuess) {
      els.powerupHint.textContent = "First guess locked in — take your second guess. The better one counts.";
      els.powerupHint.hidden = false;
    } else if (qState.secondGuessArmed) {
      els.powerupHint.textContent = "Second guess armed: locking in now uses your first attempt, then you'll get one more try.";
      els.powerupHint.hidden = false;
    } else {
      els.powerupHint.hidden = true;
    }
  }

  function activeBoundsQuestion(question) {
    return { scale: question.scale, min: qState.activeBounds.min, max: qState.activeBounds.max };
  }

  function renderQuestion() {
    const q = questions[state.index];
    qState = {
      narrowUsed: false,
      secondGuessArmed: false,
      secondGuessUsed: false,
      awaitingSecondGuess: false,
      firstGuessValue: null,
      activeBounds: { min: q.min, max: q.max },
    };

    els.firstGuessMarker.hidden = true;

    show(els.gameScreen);
    renderProgressDots(questions.length, state.index, state.guesses.length);
    els.qCategory.textContent = q.category;
    els.qPrompt.textContent = q.prompt;
    renderSliderBounds(q);

    els.narrowBtn.onclick = () => onNarrowClick(q);
    els.secondGuessBtn.onclick = () => onSecondGuessClick();
    els.lockBtn.onclick = () => lockGuess(q);
    updatePowerUpButtons();
  }

  function renderSliderBounds(question, startValue) {
    els.qMinLabel.textContent = formatValue(question, qState.activeBounds.min);
    els.qMaxLabel.textContent = formatValue(question, qState.activeBounds.max);
    const startPosition =
      startValue === undefined ? Math.round(SLIDER_MAX / 2) : valueToSliderPosition(activeBoundsQuestion(question), startValue, SLIDER_MAX);
    els.qSlider.value = String(startPosition);
    els.qSlider.max = String(SLIDER_MAX);
    updateReadout(question, startPosition);
    els.qSlider.oninput = () => updateReadout(question, Number(els.qSlider.value));
  }

  function updateReadout(question, position) {
    const value = sliderPositionToValue(activeBoundsQuestion(question), position, SLIDER_MAX);
    els.qReadout.textContent = formatValue(question, value);
  }

  function showFirstGuessMarker(question, value) {
    const pct = valueToSliderPosition(activeBoundsQuestion(question), value, 100);
    els.firstGuessMarker.style.left = `${pct}%`;
    els.firstGuessMarker.hidden = false;
  }

  function onNarrowClick(question) {
    if (dailyChargeUsed("narrow") || qState.awaitingSecondGuess) return;
    const currentValue = sliderPositionToValue(activeBoundsQuestion(question), Number(els.qSlider.value), SLIDER_MAX);
    qState.activeBounds = narrowedRange(question, currentValue);
    qState.narrowUsed = true;
    renderSliderBounds(question, currentValue);
    updatePowerUpButtons();
  }

  function onSecondGuessClick() {
    if (dailyChargeUsed("secondGuess") || qState.awaitingSecondGuess) return;
    qState.secondGuessArmed = !qState.secondGuessArmed;
    updatePowerUpButtons();
  }

  async function lockGuess(question) {
    const position = Number(els.qSlider.value);
    const guessValue = sliderPositionToValue(activeBoundsQuestion(question), position, SLIDER_MAX);

    if (qState.secondGuessArmed && !qState.awaitingSecondGuess) {
      qState.firstGuessValue = guessValue;
      qState.awaitingSecondGuess = true;
      qState.secondGuessUsed = true;
      renderSliderBounds(question);
      showFirstGuessMarker(question, guessValue);
      updatePowerUpButtons();
      return;
    }

    const powerUpsUsed = [];
    if (qState.narrowUsed) powerUpsUsed.push("narrow");
    let finalGuessValue = guessValue;
    let accuracyScore;
    if (qState.secondGuessUsed) {
      powerUpsUsed.push("secondGuess");
      const better = pickBetterGuess(question, qState.firstGuessValue, guessValue);
      finalGuessValue = better.value;
      accuracyScore = better.accuracyScore;
    } else {
      accuracyScore = scoreQuestion(question, finalGuessValue);
    }

    els.lockBtn.disabled = true;
    els.lockBtn.textContent = "Comparing to other players…";
    const { vsCrowdScore, crowdAverageGuess, reason } = await submitAndGetPercentile(date, question.id, accuracyScore, finalGuessValue);
    els.lockBtn.disabled = false;
    els.lockBtn.textContent = "Lock in guess";

    const finalScore = combineScore(accuracyScore, vsCrowdScore, powerUpsUsed.length);
    const guessRecord = {
      questionId: question.id,
      guessValue: finalGuessValue,
      accuracyScore,
      vsCrowdScore,
      crowdAverageGuess,
      crowdReason: reason,
      powerUpsUsed,
      finalScore,
    };
    state.guesses.push(guessRecord);
    onProgress?.(state.guesses);
    renderReveal(question, guessRecord);
  }

  function renderReveal(question, guessRecord) {
    show(els.revealScreen);
    els.rCategory.textContent = question.category;
    els.rPrompt.textContent = question.prompt;

    positionRevealMarkers(question, guessRecord.guessValue, guessRecord.crowdAverageGuess);
    els.rGuessLabel.textContent = `You: ${formatValue(question, guessRecord.guessValue)}`;
    els.rActualLabel.textContent = `Actual: ${formatValue(question, question.answer)}`;
    if (guessRecord.crowdAverageGuess != null) {
      els.rCrowdLabel.textContent = `Crowd avg: ${formatValue(question, guessRecord.crowdAverageGuess)}`;
    }

    els.rEmoji.textContent = emojiForQuestionScore(guessRecord.finalScore);
    els.rScore.textContent = String(guessRecord.finalScore);
    els.rScoreSubline.textContent = sublineFor(guessRecord);
    els.rInsight.textContent = question.insight;
    els.rSourceLink.textContent = `${question.source.name} (${question.source.asOf})`;
    els.rSourceLink.href = question.source.url;

    els.nextBtn.textContent = state.index === questions.length - 1 ? "See results" : "Next";
    els.nextBtn.onclick = () => advance();
  }

  function advance() {
    state.index += 1;
    if (state.index < questions.length) {
      renderQuestion();
    } else {
      onComplete(state.guesses);
    }
  }

  renderQuestion();
}

export function computeTotal(guesses) {
  const total = guesses.reduce((sum, g) => sum + finalScoreOf(g), 0);
  return { total, tier: tierForScore(total) };
}
