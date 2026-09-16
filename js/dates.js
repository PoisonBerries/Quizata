// Date helpers: everything keys off the player's LOCAL calendar date (YYYY-MM-DD),
// matching how the daily puzzle filenames are named.

export const LAUNCH_DATE = "2026-09-16";

export function toDateString(d = new Date()) {
  const tzOffsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 10);
}

export function todayString() {
  return toDateString(new Date());
}

// Puzzle #1 is LAUNCH_DATE, #2 is the next day, etc. Used only for display ("Quizata #12").
export function puzzleNumber(dateString) {
  const start = new Date(`${LAUNCH_DATE}T00:00:00`);
  const day = new Date(`${dateString}T00:00:00`);
  const diffDays = Math.round((day - start) / 86400000);
  return diffDays + 1;
}

// The date actually being played: ?date=YYYY-MM-DD override (for testing/sharing a specific
// day) falls back to today. Never allows guessing a date past "today" via the URL.
export function resolveRequestedDate() {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("date");
  const today = todayString();
  if (requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) && requested <= today) {
    return requested;
  }
  return today;
}
