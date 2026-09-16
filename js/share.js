import { emojiForQuestionScore } from "./scoring.js";

export function buildShareText({ puzzleNum, totalScore, questionScores, url }) {
  const row = questionScores.map(emojiForQuestionScore).join("");
  return `Quizata #${puzzleNum} — ${totalScore}/500\n${row}\n${url}`;
}

export async function copyShareText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // permission denied or unavailable — fall through to the execCommand fallback below
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}
