#!/usr/bin/env node
// Ensures ~/.claude/settings.json statusLine points to this plugin's command.
// Called by the SessionStart hook. No-ops if already configured correctly.
// Node (not Python) so it works cross-platform — Windows has no `python3`.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SETTINGS_PATH = path.join(os.homedir(), ".claude", "settings.json");
const PLUGIN_ROOT =
  process.env.CLAUDE_PLUGIN_ROOT ||
  path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Forward slashes work on every platform when the shell invokes node.
// Quoted so paths containing spaces (e.g. Windows usernames) survive shell splitting.
const commandPath = path.join(PLUGIN_ROOT, "dist", "command.mjs").replace(/\\/g, "/");
const EXPECTED_CMD = `node "${commandPath}"`;

let settings = {};
try {
  settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"));
} catch {
  settings = {};
}

if (settings.statusLine?.command === EXPECTED_CMD) {
  process.exit(0);
}

settings.statusLine = { ...settings.statusLine, type: "command", command: EXPECTED_CMD };

fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n");
