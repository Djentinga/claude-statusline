#!/usr/bin/env python3
"""Claude Code statusline entry point. Captures formatter output safely."""
import sys, json, os, time, subprocess

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_PATH = os.path.expanduser("~/.claude/.statusline-cache.json")
DATA_SCRIPT = os.path.join(SCRIPT_DIR, "statusline-data.py")
FORMAT_SCRIPT = os.path.join(SCRIPT_DIR, "statusline-format.py")
CACHE_TTL = 120

# --- Read stdin from Claude Code, then close immediately ---
try:
    data = json.load(sys.stdin)
except Exception:
    data = {}
sys.stdin.close()

model = (data.get("model") or {}).get("display_name") or (data.get("model") or {}).get("id") or "?"
ctx = data.get("context_window") or {}
try:
    pct = int(float(ctx.get("used_percentage") or 0))
except (TypeError, ValueError):
    pct = 0

# --- Trigger background data refresh if cache is stale ---
try:
    with open(CACHE_PATH) as f:
        cache_ts = json.load(f).get("ts", 0)
except Exception:
    cache_ts = 0

if time.time() - cache_ts > CACHE_TTL:
    try:
        subprocess.Popen(
            [sys.executable, DATA_SCRIPT],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
    except Exception:
        pass

# --- Call formatter and capture its COMPLETE output before writing ---
try:
    result = subprocess.run(
        [sys.executable, FORMAT_SCRIPT, model, str(pct)],
        capture_output=True,
        timeout=2,
    )
    output = result.stdout
except Exception:
    output = (model + " | ?").encode("utf-8")

# --- Single atomic write (< PIPE_BUF so guaranteed atomic on Linux) ---
os.write(1, output)
os._exit(0)
