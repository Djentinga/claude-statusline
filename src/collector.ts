import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";

const CREDS_PATH = path.join(os.homedir(), ".claude", ".credentials.json");
const CACHE_PATH = path.join(os.homedir(), ".claude", ".statusline-cache.json");
const LOCK_PATH = path.join(os.homedir(), ".claude", ".statusline-data.lock");

function acquireLock(): number | null {
  try {
    const fd = fs.openSync(LOCK_PATH, "w");
    // flock via fs.flockSync not available in Node, use a simple lock file strategy
    // Write PID to lock file, check if process exists
    const existing = (() => {
      try {
        return fs.readFileSync(LOCK_PATH, "utf-8").trim();
      } catch {
        return "";
      }
    })();
    if (existing) {
      try {
        process.kill(Number(existing), 0);
        // Process exists, another collector is running
        fs.closeSync(fd);
        return null;
      } catch {
        // Process doesn't exist, stale lock
      }
    }
    fs.writeFileSync(LOCK_PATH, String(process.pid));
    return fd;
  } catch {
    return null;
  }
}

function checkProcess(pattern: string): boolean {
  try {
    execSync(`pgrep -fi "${pattern}"`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function getClaudeVersion(): string {
  try {
    return execSync("claude --version", { encoding: "utf-8", timeout: 2000 }).trim() || "unknown";
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

async function main() {
  const lockFd = acquireLock();
  if (lockFd === null) process.exit(0);

  try {
    const result = {
      ts: Date.now() / 1000,
      rider_running: checkProcess("rider"),
      serena_running: checkProcess("serena start-mcp-server"),
      usage: await fetchUsage(),
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
