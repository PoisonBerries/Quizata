# Quizata

Five real, cited statistics a day. Guess each one on a slider; see how close your sense of the world really is.

No build step — plain HTML/CSS/JS, deployable straight to GitHub Pages.

## Run locally

```
npm run serve   # or: python3 -m http.server 8080
```

then open `http://localhost:8080/index.html`. Use `?date=YYYY-MM-DD` to preview a specific (non-future) puzzle date.

## Adding a new day's puzzle

1. Create `data/puzzles/YYYY-MM-DD.json` with exactly 5 questions, following the schema below.
2. Add that date to the `dates` array in `data/manifest.json`.
3. Run `npm run validate` (also runs automatically in CI on push/PR) to catch schema issues before they ship.

Every stat must cite a real, reputable, primary source — no number ships without one. See [about.html](about.html) for the full sourcing standard.

### Question schema

```json
{
  "id": "q1",
  "category": "health",
  "prompt": "Fully-specified question, including units, timeframe, and geographic scope.",
  "unit": "%",
  "scale": "linear",
  "min": 0,
  "max": 100,
  "answer": 92,
  "source": { "name": "World Bank", "url": "https://...", "asOf": "2023" },
  "insight": "One sentence of context on why this number is interesting.",
  "category": "health"
}
```

- `scale: "log"` is for quantities spanning orders of magnitude (population, dollar amounts, object counts) — `min` must be `> 0`. `scale: "linear"` is for percentages, rates, and narrow ranges.
- `min`/`max`/`answer` are always in real units (never pre-logged), even for `log` questions.

## Deploying to GitHub Pages

This is a static site with no build step, so Pages can serve it directly from the repo:

1. Push this repo to GitHub.
2. In the repo's Settings → Pages, set "Source" to "Deploy from a branch," branch `main`, folder `/ (root)`.
3. The site will be live at `https://<username>.github.io/<repo>/` within a few minutes.

## Roadmap

- **Now**: fully static, localStorage-only streak/history.
- **Next**: a lightweight shared backend (Firebase/Supabase) to record anonymized guesses and show what other players guessed on the reveal screen — the "wisdom of crowds vs. reality" comparison this game is ultimately built around.
- **Later**: archive/practice mode for past puzzles, category filters, social-share image generation.
