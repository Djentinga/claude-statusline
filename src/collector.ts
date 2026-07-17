import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { CACHE_PATH, CACHE_TTL, readCache } from "./lib/cache.js";
import type { CacheData } from "./lib/types.js";

const CREDS_PATH = path.join(os.homedir(), ".claude", ".credentials.json");
const LOCK_PATH = path.join(os.homedir(), ".claude", ".statusline-data.lock");
const RATE_LIMIT_BACKOFF = 10 * 60;

function acquireLock(): boolean {
  // Atomic create-if-not-exists
  try {
    fs.writeFileSync(LOCK_PATH, String(process.pid), { flag: "wx" });
    return true;
  } catch {}
  // Lock exists — check if holder is alive
  try {
    const pid = Number(fs.readFileSync(LOCK_PATH, "utf-8").trim());
    if (pid > 0) {
      try {
        process.kill(pid, 0);
        return false; // still running
      } catch {
        // stale — fall through to reclaim
      }
    }
  } catch {}
  // Reclaim stale lock
  try {
    fs.unlinkSync(LOCK_PATH);
    fs.writeFileSync(LOCK_PATH, String(process.pid), { flag: "wx" });
    return true;
  } catch {
    return false;
  }
}

function getClaudeVersion(): string {
  try {
    return execSync("claude --version", { encoding: "utf-8", timeout: 2000, windowsHide: true }).trim() || "unknown";
  } catch {
    return "unknown";
  }
}

async function fetchUsage(): Promise<unknown | null> {
  try {
    const creds = JSON.parse(fs.readFileSync(CREDS_PATH, "utf-8"));
    const token = creds.claudeAiOauth.accessToken;
    const version = getClaudeVersion();
    const resp = await fetch("https://api.anthropic.com/api/oauth/usage", {
      headers: {
        Authorization: `Bearer ${token}`,
        "anthropic-beta": "oauth-2025-04-20",
        "User-Agent": `claude-code/${version}`,
      },
      signal: AbortSignal.timeout(3000),
    });
    return await resp.json();
  } catch {
    return null;
  }
}

function cacheAge(cache: CacheData): number {
  return Date.now() / 1000 - cache.ts;
}

function isRateLimitError(cache: CacheData): boolean {
  return cache.usage?.error?.type === "rate_limit_error";
}

function shouldSkipFetch(cache: CacheData | null): boolean {
  if (!cache?.ts) return false;

  const retryAfter = isRateLimitError(cache) ? RATE_LIMIT_BACKOFF : CACHE_TTL;
  return cacheAge(cache) < retryAfter;
}

const IMPACT_RANK: Record<string, number> = { critical: 3, major: 2, minor: 1, none: 0 };

async function fetchIncident(): Promise<{ name: string; status: string; impact: string } | null> {
  try {
    const resp = await fetch("https://status.claude.com/api/v2/incidents/unresolved.json", {
      signal: AbortSignal.timeout(3000),
    });
    const data = (await resp.json()) as { incidents: Array<{ name: string; status: string; impact: string }> };
    if (!data.incidents?.length) return null;
    // Return highest-impact incident
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
      ts: Date.now() / 1000,
      usage,
      incident,
    };

    // Atomic write: temp file + rename
    const dir = path.dirname(CACHE_PATH);
    const tmp = path.join(dir, `.statusline-cache-${process.pid}.tmp`);
    fs.writeFileSync(tmp, JSON.stringify(result));
    fs.renameSync(tmp, CACHE_PATH);
  } finally {
    try {
      fs.unlinkSync(LOCK_PATH);
    } catch {}
  }
}

main().catch(() => process.exit(1));
