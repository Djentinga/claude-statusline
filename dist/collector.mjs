process.env.FORCE_COLOR='1';import{createRequire}from'module';const require=createRequire(import.meta.url);

// src/collector.ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
var CREDS_PATH = path.join(os.homedir(), ".claude", ".credentials.json");
var CACHE_PATH = path.join(os.homedir(), ".claude", ".statusline-cache.json");
var LOCK_PATH = path.join(os.homedir(), ".claude", ".statusline-data.lock");
function acquireLock() {
  try {
    fs.writeFileSync(LOCK_PATH, String(process.pid), { flag: "wx" });
    return true;
  } catch {
  }
  try {
    const pid = Number(fs.readFileSync(LOCK_PATH, "utf-8").trim());
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
    fs.unlinkSync(LOCK_PATH);
    fs.writeFileSync(LOCK_PATH, String(process.pid), { flag: "wx" });
    return true;
  } catch {
    return false;
  }
}
function checkProcess(pattern) {
  try {
    execSync(`pgrep -fi "${pattern}"`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}
function getClaudeVersion() {
  try {
    return execSync("claude --version", { encoding: "utf-8", timeout: 2e3 }).trim() || "unknown";
  } catch {
    return "unknown";
  }
}
async function fetchUsage() {
  try {
    const creds = JSON.parse(fs.readFileSync(CREDS_PATH, "utf-8"));
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
    const [usage, incident] = await Promise.all([fetchUsage(), fetchIncident()]);
    const result = {
      ts: Date.now() / 1e3,
      rider_running: checkProcess("rider"),
      serena_running: checkProcess("serena start-mcp-server"),
      usage,
      incident
    };
    const dir = path.dirname(CACHE_PATH);
    const tmp = path.join(dir, `.statusline-cache-${process.pid}.tmp`);
    fs.writeFileSync(tmp, JSON.stringify(result));
    fs.renameSync(tmp, CACHE_PATH);
  } finally {
    try {
      fs.unlinkSync(LOCK_PATH);
    } catch {
    }
  }
}
main().catch(() => process.exit(1));
