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

// --- Sub-agent token scanning ---
const MODEL_INPUT_RATES: Record<string, number> = { opus: 15, sonnet: 3, haiku: 0.8 };
const OUTPUT_MULTIPLIER = 5; // output rate = input rate * 5 for all Claude models

function getModelRate(model: string): number {
  const key = model.toLowerCase();
  for (const [name, rate] of Object.entries(MODEL_INPUT_RATES)) {
    if (key.includes(name)) return rate;
  }
  return 3; // default sonnet
}

function findActiveSession(): { slug: string; sessionId: string } | null {
  const sessionsDir = path.join(os.homedir(), ".claude", "sessions");
  try {
    // Find most recent session file by mtime
    const sessions = fs.readdirSync(sessionsDir)
      .filter(f => f.endsWith(".json"))
      .map(f => ({ file: f, mtime: fs.statSync(path.join(sessionsDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);

    for (const s of sessions) {
      const data = JSON.parse(fs.readFileSync(path.join(sessionsDir, s.file), "utf-8"));
      if (data.cwd && data.sessionId) {
        return { slug: data.cwd.replace(/\//g, "-"), sessionId: data.sessionId };
      }
    }
  } catch {}
  return null;
}

function scanSubagentUsage(): { tokens: number; cost: number } {
  try {
    const session = findActiveSession();
    if (!session) return { tokens: 0, cost: 0 };

    const projectDir = path.join(os.homedir(), ".claude", "projects", session.slug);
    const subagentsDir = path.join(projectDir, session.sessionId, "subagents");
    if (!fs.existsSync(subagentsDir)) return { tokens: 0, cost: 0 };

    let totalTokens = 0;
    let totalCost = 0;

    for (const file of fs.readdirSync(subagentsDir).filter(f => f.endsWith(".jsonl"))) {
      const content = fs.readFileSync(path.join(subagentsDir, file), "utf-8");
      for (const line of content.split("\n")) {
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line);
          const msg = obj.message;
          const u = msg?.usage;
          if (!u) continue;
          const input = u.input_tokens || 0;
          const output = u.output_tokens || 0;
          const cacheRead = u.cache_read_input_tokens || 0;
          const cacheCreation = u.cache_creation_input_tokens || 0;
          const uncached = Math.max(0, input - cacheRead - cacheCreation);
          const base = getModelRate(msg.model || "");

          totalTokens += input + output;
          totalCost += (uncached * base +
            cacheRead * base * 0.1 +
            cacheCreation * base * 1.25 +
            output * base * OUTPUT_MULTIPLIER) / 1_000_000;
        } catch {}
      }
    }

    return { tokens: totalTokens, cost: totalCost };
  } catch {
    return { tokens: 0, cost: 0 };
  }
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
  const lockFd = acquireLock();
  if (lockFd === null) process.exit(0);

  try {
    const [usage, incident] = await Promise.all([fetchUsage(), fetchIncident()]);
    const subagent_usage = scanSubagentUsage();
    const result = {
      ts: Date.now() / 1000,
      rider_running: checkProcess("rider"),
      serena_running: checkProcess("serena start-mcp-server"),
      usage,
      incident,
      subagent_usage: subagent_usage.tokens > 0 ? subagent_usage : undefined,
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
