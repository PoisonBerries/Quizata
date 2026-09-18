import { loadState } from "./storage.js";
import { computeStats } from "./stats.js";
import { BANDS } from "./scoring.js";
import { todayString } from "./dates.js";

const dialog = document.getElementById("stats-dialog");
const body = document.getElementById("stats-body");

// Puzzle files are only needed to map a saved guess back to its question's category.
// Only successful fetches are cached, so a transient failure gets retried next time.
const puzzleCache = new Map();

async function loadPuzzles(dates) {
  await Promise.all(
    dates
      .filter((d) => !puzzleCache.has(d))
      .map(async (d) => {
        try {
          const res = await fetch(`data/puzzles/${d}.json`);
          if (res.ok) puzzleCache.set(d, await res.json());
        } catch {
          // leave uncached; that day just won't contribute to the category breakdown
        }
      })
  );
  return Object.fromEntries(dates.filter((d) => puzzleCache.has(d)).map((d) => [d, puzzleCache.get(d)]));
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function section(title, subtitle) {
  const wrap = el("section", "stats-section");
  wrap.appendChild(el("h3", "stats-heading", title));
  if (subtitle) wrap.appendChild(el("p", "stats-sub", subtitle));
  return wrap;
}

function renderTiles(stats) {
  const tiles = el("div", "stats-tiles");
  [
    [stats.played, "Played"],
    [stats.average, "Avg score"],
    [stats.best, "Best"],
    [stats.currentStreak, "Streak"],
    [stats.longestStreak, "Best streak"],
  ].forEach(([value, label]) => {
    const tile = el("div", "stat");
    tile.appendChild(el("span", "num", String(value)));
    tile.appendChild(el("span", "lbl", label));
    tiles.appendChild(tile);
  });
  return tiles;
}

function renderTierDistribution(stats) {
  const wrap = section("Score distribution", "Your daily totals, out of 500");
  const maxCount = Math.max(1, ...stats.tierBuckets.map((b) => b.count));
  stats.tierBuckets.forEach((bucket) => {
    const row = el("div", "dist-row");
    if (bucket.name === stats.highlightTier) row.classList.add("is-current");

    const label = el("div", "dist-label");
    label.appendChild(el("span", "dist-name", bucket.name));
    label.appendChild(el("span", "dist-range", `${bucket.min}–${bucket.max}`));

    const track = el("div", "bar-track");
    const fill = el("div", "bar-fill");
    fill.style.width = bucket.count === 0 ? "0" : `${Math.max(4, (bucket.count / maxCount) * 100)}%`;
    track.appendChild(fill);

    row.append(label, track, el("div", "dist-count", String(bucket.count)));
    wrap.appendChild(row);
  });
  return wrap;
}

function bandRangeText(index) {
  const band = BANDS[index];
  return index === 0 ? `${band.min}+` : `${band.min}–${BANDS[index - 1].min - 1}`;
}

function renderCategories(stats) {
  const wrap = section("By category", "Average score per question, and how your answers spread");
  if (stats.categories.length === 0) {
    wrap.appendChild(el("p", "stats-sub", "Category breakdown isn't available right now."));
    return wrap;
  }

  const legend = el("div", "band-legend");
  BANDS.forEach((band, i) => {
    const item = el("span", "band-legend-item");
    item.appendChild(el("span", `swatch seg-${band.key}`));
    item.appendChild(document.createTextNode(bandRangeText(i)));
    legend.appendChild(item);
  });
  wrap.appendChild(legend);

  stats.categories.forEach((cat) => {
    const row = el("div", "cat-row");

    const label = el("div", "dist-label");
    label.appendChild(el("span", "dist-name cat-name", cat.category));
    label.appendChild(el("span", "dist-range", `${cat.questions} question${cat.questions === 1 ? "" : "s"}`));

    const stack = el("div", "bar-track stack-bar");
    BANDS.forEach((band) => {
      const count = cat.bands[band.key];
      if (count === 0) return;
      const seg = el("div", `seg seg-${band.key}`);
      seg.style.flexGrow = String(count);
      stack.appendChild(seg);
    });

    row.append(label, stack, el("div", "dist-count", String(cat.average)));
    wrap.appendChild(row);
  });
  return wrap;
}

async function render(highlightDate) {
  body.replaceChildren(el("p", "stats-sub", "Loading…"));

  const { results } = loadState();
  const dates = Object.keys(results);
  if (dates.length === 0) {
    body.replaceChildren(el("p", "stats-sub", "Finish a Quizata to start building your stats."));
    return;
  }

  const puzzlesByDate = await loadPuzzles(dates);
  const stats = computeStats(results, puzzlesByDate, { today: todayString(), highlightDate });
  body.replaceChildren(renderTiles(stats), renderTierDistribution(stats), renderCategories(stats));
}

let wired = false;
function wireOnce() {
  if (wired) return;
  wired = true;
  document.getElementById("stats-close").addEventListener("click", () => dialog.close());
  // Clicks on the backdrop land on the <dialog> element itself, not its contents.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}

export function openStatsDialog({ highlightDate } = {}) {
  wireOnce();
  dialog.showModal();
  render(highlightDate);
}
