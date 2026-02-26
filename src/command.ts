import fs from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StdinData } from "./lib/types.js";
import { readCache, isCacheStale } from "./lib/cache.js";
import { formatStatusLine } from "./components/StatusLine.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read stdin synchronously
let data: StdinData = {};
try {
  const input = fs.readFileSync(0, "utf-8");
  data = JSON.parse(input);
} catch {}

const model = data.model?.display_name ?? data.model?.id ?? "?";
const ctxPct = Math.floor(Number(data.context_window?.used_percentage) || 0);
const ctxSize = Math.floor(Number(data.context_window?.context_window_size) || 200_000);
const tokensUsed = Math.floor((ctxSize * ctxPct) / 100);

// Read cache, spawn collector if stale
const cache = readCache();
if (isCacheStale(cache)) {
  try {
    const collector = path.join(__dirname, "collector.mjs");
    const child = spawn(process.execPath, [collector], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
  } catch {}
}

// Format and write output atomically
try {
  const output = formatStatusLine(model, tokensUsed, cache);
  fs.writeFileSync(1, output);
} catch {
  fs.writeFileSync(1, `${model} | ?`);
}

process.exit(0);
