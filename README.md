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

Every stat must cite a real, reputable, primary source — no number ships without one — and a day's five questions must draw on at least 3 different publishers (`npm run validate` enforces it), so no single organization's framing dominates a day. See [about.html](about.html) for the full sourcing standard.

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

## Scoring and power-ups

Each question's final score is half accuracy and half how you compare to the crowd's average accuracy that day (from the crowd backend below), capped lower if you used a power-up on that question. Accuracy is `100 × (1 − miss ÷ 0.6)²`, floored at 0, where miss is the distance from the answer as a fraction of the slider's range. If you change that curve, bump `SCORING_VERSION` in `js/scoring.js` — crowd stats are stored per version so old-curve scores never get averaged against new-curve ones. See [about.html](about.html) for the player-facing explanation. The math lives in `js/scoring.js` (`scoreQuestion`, `combineScore`) and `js/powerups.js` (narrow-range and second-guess helpers) — both are plain functions with no DOM dependency.

## Crowd backend (Firestore)

`js/crowd.js` records an aggregate-only per-question stat (`count`, `scoreSum`, `valueSum`, a 20-bucket score histogram — never individual guesses) to Firebase Firestore, in documents named `<questionId>_s<SCORING_VERSION>`, and returns the crowd's average accuracy comparison plus average guess. It's written to fail soft: with `js/firebase-config.js` left at its placeholder values, or if the network call fails or times out, every question just scores on accuracy alone and the game plays normally.

To turn it on:

1. In the [Firebase console](https://console.firebase.google.com/), for the project: enable **Firestore** (production mode, any region) and enable **Anonymous** sign-in under Authentication → Sign-in method.
2. Project settings → General → "Your apps" → add a Web app if none exists → copy the `firebaseConfig` object into `js/firebase-config.js`.
3. Firestore → Rules → paste in the contents of [firestore.rules](firestore.rules) → Publish.

No `firebase`/`gcloud` CLI is required — everything above is a few clicks in the console, and the app talks to Firestore directly from the browser via the CDN-hosted modular SDK (no build step needed there either).

## Roadmap

- **Now**: crowd-scored, power-ups, streak/history in localStorage.
- **Later**: archive/practice mode for past puzzles, category filters, social-share image generation.
