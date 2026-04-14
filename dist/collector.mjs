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
    const fd = fs.openSync(LOCK_PATH, "w");
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
        fs.closeSync(fd);
        return null;
      } catch {
      }
    }
    fs.writeFileSync(LOCK_PATH, String(process.pid));
    return fd;
  } catch {
    return null;
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
var MODEL_INPUT_RATES = { opus: 15, sonnet: 3, haiku: 0.8 };
var OUTPUT_MULTIPLIER = 5;
function getModelRate(model) {
  const key = model.toLowerCase();
  for (const [name, rate] of Object.entries(MODEL_INPUT_RATES)) {
    if (key.includes(name)) return rate;
  }
  return 3;
}
function findProjectSlug() {
  const sessionsDir = path.join(os.homedir(), ".claude", "sessions");
  try {
    const sessions = fs.readdirSync(sessionsDir).filter((f) => f.endsWith(".json")).map((f) => ({ file: f, mtime: fs.statSync(path.join(sessionsDir, f)).mtimeMs })).sort((a, b) => b.mtime - a.mtime);
    for (const s of sessions) {
      const data = JSON.parse(fs.readFileSync(path.join(sessionsDir, s.file), "utf-8"));
      if (data.cwd) return data.cwd.replace(/\//g, "-");
    }
  } catch {
  }
  return process.cwd().replace(/\//g, "-");
}
function findSessionsWithSubagents(slug) {
  const projectDir = path.join(os.homedir(), ".claude", "projects", slug);
  if (!fs.existsSync(projectDir)) return [];
  return fs.readdirSync(projectDir).filter((d) => {
    const full = path.join(projectDir, d);
    return fs.statSync(full).isDirectory() && d !== "memory" && fs.existsSync(path.join(full, "subagents"));
  }).sort((a, b) => {
    return fs.statSync(path.join(projectDir, b)).mtimeMs - fs.statSync(path.join(projectDir, a)).mtimeMs;
  });
}
function scanSubagentUsage() {
  try {
    const slug = findProjectSlug();
    const sessions = findSessionsWithSubagents(slug);
    if (!sessions.length) return { tokens: 0, cost: 0 };
    const projectDir = path.join(os.homedir(), ".claude", "projects", slug);
    const subagentsDir = path.join(projectDir, sessions[0], "subagents");
    let totalTokens = 0;
    let totalCost = 0;
    for (const file of fs.readdirSync(subagentsDir).filter((f) => f.endsWith(".jsonl"))) {
      const content = fs.readFileSync(path.join(subagentsDir, file), "utf-8");
      let lastContextSize = 0;
      let agentCost = 0;
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
          const base = getModelRate(msg.model || "");
          lastContextSize = input + cacheRead + cacheCreation + output;
          agentCost += (input * base + cacheRead * base * 0.1 + cacheCreation * base * 1.25 + output * base * OUTPUT_MULTIPLIER) / 1e6;
        } catch {
        }
      }
      totalTokens += lastContextSize;
      totalCost += agentCost;
    }
    return { tokens: totalTokens, cost: totalCost };
  } catch {
    return { tokens: 0, cost: 0 };
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
  const lockFd = acquireLock();
  if (lockFd === null) process.exit(0);
  try {
    const [usage, incident] = await Promise.all([fetchUsage(), fetchIncident()]);
    const subagent_usage = scanSubagentUsage();
    const result = {
      ts: Date.now() / 1e3,
      rider_running: checkProcess("rider"),
      serena_running: checkProcess("serena start-mcp-server"),
      usage,
      incident,
      subagent_usage: subagent_usage.tokens > 0 ? subagent_usage : void 0
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
