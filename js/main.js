import { resolveRequestedDate, puzzleNumber } from "./dates.js";
import { getResultFor, recordResult, getStats, getProgressFor, saveProgress } from "./storage.js";
import { runGame, computeTotal } from "./game.js";
import { emojiForQuestionScore, finalScoreOf } from "./scoring.js";
import { formatValue } from "./format.js";
import { buildShareText, copyShareText } from "./share.js";
import { openStatsDialog } from "./statsView.js";

const screens = {
  intro: document.getElementById("intro-screen"),
  alreadyPlayed: document.getElementById("already-played-screen"),
  game: document.getElementById("game-screen"),
  reveal: document.getElementById("reveal-screen"),
  summary: document.getElementById("summary-screen"),
};

function showOnly(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.hidden = key !== name;
  });
}

function updateStreakBadge() {
  const stats = getStats();
  const badge = document.getElementById("streak-badge");
  if (stats.streak > 0) {
    document.getElementById("streak-count").textContent = String(stats.streak);
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

async function fetchPuzzleFor(date) {
  const manifestRes = await fetch("data/manifest.json");
  const manifest = await manifestRes.json();
  const available = manifest.dates.filter((d) => d <= date).sort();
  if (available.length === 0) return null;
  const useDate = available[available.length - 1];
  const res = await fetch(`data/puzzles/${useDate}.json`);
  if (!res.ok) return null;
  const puzzle = await res.json();
  return { puzzle, actualDate: useDate };
}

function renderSummary(puzzle, guesses, actualDate) {
  const { total, tier } = computeTotal(guesses);
  document.getElementById("s-total").textContent = String(total);
  document.getElementById("s-tier").textContent = tier;

  const list = document.getElementById("s-breakdown");
  list.innerHTML = "";
  guesses.forEach((g, i) => {
    const q = puzzle.questions[i];
    const score = finalScoreOf(g);
    const li = document.createElement("li");
    li.innerHTML = `<span class="q-label">${q.category}</span><span>${emojiForQuestionScore(score)} ${score}/100</span>`;
    list.appendChild(li);
  });

  const stats = getStats();
  document.getElementById("s-streak").textContent = String(stats.streak);
  document.getElementById("s-played").textContent = String(stats.gamesPlayed);
  document.getElementById("s-avg").textContent = String(stats.averageScore);

  document.getElementById("share-btn").onclick = async () => {
    const text = buildShareText({
      puzzleNum: puzzleNumber(actualDate),
      totalScore: total,
      questionScores: guesses.map(finalScoreOf),
      url: window.location.origin + window.location.pathname,
    });
    const ok = await copyShareText(text);
    showToast(ok ? "Copied to clipboard!" : "Couldn't copy — try again");
  };

  document.getElementById("stats-btn").onclick = () => openStatsDialog({ highlightDate: actualDate });

  showOnly("summary");
  updateStreakBadge();
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

async function main() {
  const requestedDate = resolveRequestedDate();
  const loaded = await fetchPuzzleFor(requestedDate);

  if (!loaded) {
    document.getElementById("intro-screen").querySelector("p.tagline").textContent =
      "No puzzle is available yet — check back soon.";
    document.getElementById("start-btn").disabled = true;
    showOnly("intro");
    return;
  }

  const { puzzle, actualDate } = loaded;
  document.getElementById("puzzle-label").textContent = `Quizata #${puzzleNumber(actualDate)}`;
  document.getElementById("date-label").textContent = new Date(`${actualDate}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  updateStreakBadge();

  const existingResult = getResultFor(actualDate);
  if (existingResult) {
    document.getElementById("view-results-btn").onclick = () => renderSummary(puzzle, existingResult.guesses, actualDate);
    showOnly("alreadyPlayed");
    return;
  }

  const progress = getProgressFor(actualDate);
  const resumeFrom = progress && progress.guesses.length > 0 && progress.guesses.length < puzzle.questions.length ? progress : null;

  const startBtn = document.getElementById("start-btn");
  startBtn.textContent = resumeFrom ? `Continue (${resumeFrom.guesses.length}/${puzzle.questions.length})` : "Play today's Quizata";

  startBtn.onclick = () => {
    showOnly("game");
    runGame(puzzle, {
      date: actualDate,
      resumeFrom,
      onProgress: (guesses) => saveProgress(actualDate, { guesses }),
      onComplete: (guesses) => {
        const { total, tier } = computeTotal(guesses);
        recordResult(actualDate, { score: total, tier, guesses });
        renderSummary(puzzle, guesses, actualDate);
      },
    });
  };
  showOnly("intro");
}

main();
