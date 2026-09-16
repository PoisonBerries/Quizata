#!/usr/bin/env node
// Validates every data/puzzles/*.json file against Quizata's content schema.
// No dependencies — run with `node scripts/validate-content.js`.

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const puzzlesDir = join(__dirname, "..", "data", "puzzles");
const manifestPath = join(__dirname, "..", "data", "manifest.json");

const REQUIRED_QUESTION_FIELDS = ["id", "category", "prompt", "unit", "scale", "min", "max", "answer", "source", "insight"];
let errors = [];

function fail(file, message) {
  errors.push(`${file}: ${message}`);
}

function validatePuzzleFile(filename) {
  const path = join(puzzlesDir, filename);
  const dateFromFilename = filename.replace(/\.json$/, "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFromFilename)) {
    fail(filename, `filename must be YYYY-MM-DD.json`);
    return;
  }

  let data;
  try {
    data = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    fail(filename, `invalid JSON: ${e.message}`);
    return;
  }

  if (data.date !== dateFromFilename) {
    fail(filename, `"date" field (${data.date}) does not match filename`);
  }
  if (!Array.isArray(data.questions) || data.questions.length !== 5) {
    fail(filename, `must have exactly 5 questions, found ${data.questions?.length ?? 0}`);
    return;
  }

  const seenIds = new Set();
  data.questions.forEach((q, i) => {
    const where = `${filename} question[${i}]`;
    for (const field of REQUIRED_QUESTION_FIELDS) {
      if (q[field] === undefined || q[field] === null || q[field] === "") {
        fail(where, `missing required field "${field}"`);
      }
    }
    if (q.id) {
      if (seenIds.has(q.id)) fail(where, `duplicate question id "${q.id}"`);
      seenIds.add(q.id);
    }
    if (!["linear", "log"].includes(q.scale)) {
      fail(where, `"scale" must be "linear" or "log", got "${q.scale}"`);
    }
    if (typeof q.min === "number" && typeof q.max === "number" && q.min >= q.max) {
      fail(where, `"min" (${q.min}) must be less than "max" (${q.max})`);
    }
    if (q.scale === "log" && typeof q.min === "number" && q.min <= 0) {
      fail(where, `log-scale questions require "min" > 0 (got ${q.min})`);
    }
    if (typeof q.answer === "number" && typeof q.min === "number" && typeof q.max === "number") {
      if (q.answer < q.min || q.answer > q.max) {
        fail(where, `"answer" (${q.answer}) must fall within [min, max] = [${q.min}, ${q.max}]`);
      }
    }
    if (q.source) {
      if (!q.source.name) fail(where, `source.name is required`);
      if (!q.source.url || !/^https?:\/\//.test(q.source.url)) fail(where, `source.url must be a real http(s) URL`);
      if (!q.source.asOf) fail(where, `source.asOf is required`);
    }
    if (typeof q.insight === "string" && q.insight.length > 320) {
      fail(where, `insight is too long (${q.insight.length} chars, keep it under ~320)`);
    }
  });
}

function validateManifest() {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (e) {
    fail("manifest.json", `invalid JSON: ${e.message}`);
    return;
  }
  if (!Array.isArray(manifest.dates)) {
    fail("manifest.json", `must have a "dates" array`);
    return;
  }
  const puzzleDates = new Set(
    readdirSync(puzzlesDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""))
  );
  for (const date of manifest.dates) {
    if (!puzzleDates.has(date)) {
      fail("manifest.json", `lists "${date}" but data/puzzles/${date}.json does not exist`);
    }
  }
  for (const date of puzzleDates) {
    if (!manifest.dates.includes(date)) {
      fail("manifest.json", `data/puzzles/${date}.json exists but is not listed in "dates"`);
    }
  }
}

const files = readdirSync(puzzlesDir).filter((f) => f.endsWith(".json"));
if (files.length === 0) {
  console.error("No puzzle files found in data/puzzles/");
  process.exit(1);
}
files.forEach(validatePuzzleFile);
validateManifest();

if (errors.length > 0) {
  console.error(`Found ${errors.length} content issue(s):\n`);
  errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
} else {
  console.log(`✓ ${files.length} puzzle file(s) valid.`);
}
