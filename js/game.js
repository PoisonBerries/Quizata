import { sliderPositionToValue, valueToSliderPosition, scoreQuestion, tierForScore, emojiForQuestionScore } from "./scoring.js";
import { formatValue } from "./format.js";

const SLIDER_MAX = 1000;

const els = {
  progressDots: document.getElementById("progress-dots"),
  gameScreen: document.getElementById("game-screen"),
  qCategory: document.getElementById("q-category"),
  qPrompt: document.getElementById("q-prompt"),
  qReadout: document.getElementById("q-readout"),
  qSlider: document.getElementById("q-slider"),
  qMinLabel: document.getElementById("q-min-label"),
  qMaxLabel: document.getElementById("q-max-label"),
  lockBtn: document.getElementById("lock-guess-btn"),

  revealScreen: document.getElementById("reveal-screen"),
  rCategory: document.getElementById("r-category"),
  rPrompt: document.getElementById("r-prompt"),
  rTrack: document.getElementById("r-track"),
  rGuessMarker: document.getElementById("r-guess-marker"),
  rGuessLabel: document.getElementById("r-guess-label"),
  rActualMarker: document.getElementById("r-actual-marker"),
  rActualLabel: document.getElementById("r-actual-label"),
  rEmoji: document.getElementById("r-emoji"),
  rScore: document.getElementById("r-score"),
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

export function runGame(puzzle, { onComplete }) {
  const questions = puzzle.questions;
  const state = { index: 0, guesses: [] };

  function renderQuestion() {
    const q = questions[state.index];
    show(els.gameScreen);
    renderProgressDots(questions.length, state.index, state.guesses.length);
    els.qCategory.textContent = q.category;
    els.qPrompt.textContent = q.prompt;
    els.qMinLabel.textContent = formatValue(q, q.min);
    els.qMaxLabel.textContent = formatValue(q, q.max);

    const startPosition = Math.round(SLIDER_MAX / 2);
    els.qSlider.value = String(startPosition);
    els.qSlider.max = String(SLIDER_MAX);
    updateReadout(q, startPosition);

    els.qSlider.oninput = () => updateReadout(q, Number(els.qSlider.value));
    els.lockBtn.onclick = () => lockGuess(q);
  }

  function updateReadout(question, position) {
    const value = sliderPositionToValue(question, position, SLIDER_MAX);
    els.qReadout.textContent = formatValue(question, value);
  }

  function lockGuess(question) {
    const position = Number(els.qSlider.value);
    const guessValue = sliderPositionToValue(question, position, SLIDER_MAX);
    const score = scoreQuestion(question, guessValue);
    state.guesses.push({ questionId: question.id, guess: guessValue, score });
    renderReveal(question, guessValue, score);
  }

  function renderReveal(question, guessValue, score) {
    show(els.revealScreen);
    els.rCategory.textContent = question.category;
    els.rPrompt.textContent = question.prompt;

    const guessPct = valueToSliderPosition(question, guessValue, 100);
    const actualPct = valueToSliderPosition(question, question.answer, 100);
    els.rGuessMarker.style.left = `${guessPct}%`;
    els.rActualMarker.style.left = `${actualPct}%`;
    els.rGuessLabel.textContent = `You: ${formatValue(question, guessValue)}`;
    els.rActualLabel.textContent = `Actual: ${formatValue(question, question.answer)}`;

    els.rEmoji.textContent = emojiForQuestionScore(score);
    els.rScore.textContent = String(score);
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
  const total = guesses.reduce((sum, g) => sum + g.score, 0);
  return { total, tier: tierForScore(total) };
}
