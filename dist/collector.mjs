process.env.FORCE_COLOR='1';import{createRequire}from'module';const require=createRequire(import.meta.url);

// src/collector.ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";

// src/lib/slug.ts
function cwdToSlug(cwd) {
  return cwd.replace(/[\/.]/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
}

// src/collector.ts
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
  return cwdToSlug(process.cwd());
}
var RECENT_SESSION_WINDOW_MS = 24 * 60 * 60 * 1e3;
function findSessionsWithSubagents(slug) {
  const projectDir = path.join(os.homedir(), ".claude", "projects", slug);
  if (!fs.existsSync(projectDir)) return [];
  const now = Date.now();
  return fs.readdirSync(projectDir).filter((d) => {
    const full = path.join(projectDir, d);
    if (!fs.statSync(full).isDirectory() || d === "memory") return false;
    if (!fs.existsSync(path.join(full, "subagents"))) return false;
    return now - fs.statSync(full).mtimeMs <= RECENT_SESSION_WINDOW_MS;
  }).sort((a, b) => {
    return fs.statSync(path.join(projectDir, b)).mtimeMs - fs.statSync(path.join(projectDir, a)).mtimeMs;
  });
}
function scanSubagentUsage(slug) {
  try {
    const sessions = findSessionsWithSubagents(slug);
    if (!sessions.length) return { tokens: 0, cost: 0 };
    const projectDir = path.join(os.homedir(), ".claude", "projects", slug);
    let totalTokens = 0;
    let totalCost = 0;
    for (const sessionId of sessions) {
      const subagentsDir = path.join(projectDir, sessionId, "subagents");
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
function readExistingCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));
  } catch {
    return {};
  }
}
async function main() {
  if (!acquireLock()) process.exit(0);
  try {
    const slug = findProjectSlug();
    const [usage, incident] = await Promise.all([fetchUsage(), fetchIncident()]);
    const subagent = scanSubagentUsage(slug);
    const existing = readExistingCache();
    const subagentMap = existing.subagent_usage && typeof existing.subagent_usage === "object" && !Array.isArray(existing.subagent_usage) && !("tokens" in existing.subagent_usage) ? existing.subagent_usage : {};
    if (subagent.tokens > 0) {
      subagentMap[slug] = subagent;
    } else {
      delete subagentMap[slug];
    }
    const result = {
      ts: Date.now() / 1e3,
      rider_running: checkProcess("rider"),
      serena_running: checkProcess("serena start-mcp-server"),
      usage,
      incident,
      subagent_usage: Object.keys(subagentMap).length > 0 ? subagentMap : void 0
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
