process.env.FORCE_COLOR='1';import{createRequire}from'module';const require=createRequire(import.meta.url);

// src/collector.ts
import fs2 from "node:fs";
import os2 from "node:os";
import path2 from "node:path";
import { execSync } from "node:child_process";

// src/lib/cache.ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
var CACHE_PATH = path.join(os.homedir(), ".claude", ".statusline-cache.json");
var CACHE_TTL = 120;
var STALE_THRESHOLD = 2 * CACHE_TTL;
function readCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));
  } catch {
    return null;
  }
}

// src/collector.ts
var CREDS_PATH = path2.join(os2.homedir(), ".claude", ".credentials.json");
var LOCK_PATH = path2.join(os2.homedir(), ".claude", ".statusline-data.lock");
var RATE_LIMIT_BACKOFF = 10 * 60;
function acquireLock() {
  try {
    fs2.writeFileSync(LOCK_PATH, String(process.pid), { flag: "wx" });
    return true;
  } catch {
  }
  try {
    const pid = Number(fs2.readFileSync(LOCK_PATH, "utf-8").trim());
    if (pid > 0) {
      try {
        process.kill(pid, 0);
        return false;
      } catch {
      }
    }
  } catch {
  }
  try {
    fs2.unlinkSync(LOCK_PATH);
    fs2.writeFileSync(LOCK_PATH, String(process.pid), { flag: "wx" });
    return true;
  } catch {
    return false;
  }
}
function getClaudeVersion() {
  try {
    return execSync("claude --version", { encoding: "utf-8", timeout: 2e3, windowsHide: true }).trim() || "unknown";
  } catch {
    return "unknown";
  }
}
async function fetchUsage() {
  try {
    const creds = JSON.parse(fs2.readFileSync(CREDS_PATH, "utf-8"));
    const token = creds.claudeAiOauth.accessToken;
    const version = getClaudeVersion();
    const resp = await fetch("https://api.anthropic.com/api/oauth/usage", {
      headers: {
        Authorization: `Bearer ${token}`,
        "anthropic-beta": "oauth-2025-04-20",
        "User-Agent": `claude-code/${version}`
      },
      signal: AbortSignal.timeout(3e3)
    });
    return await resp.json();
  } catch {
    return null;
  }
}
function cacheAge(cache) {
  return Date.now() / 1e3 - cache.ts;
}
function isRateLimitError(cache) {
  return cache.usage?.error?.type === "rate_limit_error";
}
function shouldSkipFetch(cache) {
  if (!cache?.ts) return false;
  const retryAfter = isRateLimitError(cache) ? RATE_LIMIT_BACKOFF : CACHE_TTL;
  return cacheAge(cache) < retryAfter;
}
var IMPACT_RANK = { critical: 3, major: 2, minor: 1, none: 0 };
async function fetchIncident() {
  try {
    const resp = await fetch("https://status.claude.com/api/v2/incidents/unresolved.json", {
      signal: AbortSignal.timeout(3e3)
    });
    const data = await resp.json();
    if (!data.incidents?.length) return null;
    return data.incidents.sort((a, b) => (IMPACT_RANK[b.impact] ?? 0) - (IMPACT_RANK[a.impact] ?? 0))[0];
  } catch {
    return null;
  }
}
async function main() {
  if (!acquireLock()) process.exit(0);
  try {
    const cache = readCache();
    if (shouldSkipFetch(cache)) {
      return;
    }
    const [usage, incident] = await Promise.all([fetchUsage(), fetchIncident()]);
    const result = {
      ts: Date.now() / 1e3,
      usage,
      incident
    };
    const dir = path2.dirname(CACHE_PATH);
    const tmp = path2.join(dir, `.statusline-cache-${process.pid}.tmp`);
    fs2.writeFileSync(tmp, JSON.stringify(result));
    fs2.renameSync(tmp, CACHE_PATH);
  } finally {
    try {
      fs2.unlinkSync(LOCK_PATH);
    } catch {
    }
  }
}
main().catch(() => process.exit(1));
