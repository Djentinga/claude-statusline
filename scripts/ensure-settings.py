#!/usr/bin/env python3
"""Ensures ~/.claude/settings.json statusLine points to this plugin's scripts.
Called by SessionStart hook. No-ops if already configured correctly."""
import json, os, sys

SETTINGS_PATH = os.path.expanduser("~/.claude/settings.json")
PLUGIN_ROOT = os.environ.get(
    "CLAUDE_PLUGIN_ROOT",
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
)
EXPECTED_CMD = f"node {PLUGIN_ROOT}/dist/command.mjs"

try:
    with open(SETTINGS_PATH) as f:
        settings = json.load(f)
except Exception:
    settings = {}

current = settings.get("statusLine", {}).get("command", "")
if current == EXPECTED_CMD:
    sys.exit(0)

settings.setdefault("statusLine", {})["type"] = "command"
settings["statusLine"]["command"] = EXPECTED_CMD

with open(SETTINGS_PATH, "w") as f:
    json.dump(settings, f, indent=2)
    f.write("\n")
