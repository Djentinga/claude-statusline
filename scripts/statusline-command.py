#!/usr/bin/env python3
"""Claude Code statusline entry point. Imports formatter directly."""
import sys, json, os, time, subprocess, importlib.util

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_PATH = os.path.expanduser("~/.claude/.statusline-cache.json")
DATA_SCRIPT = os.path.join(SCRIPT_DIR, "statusline-data.py")
CACHE_TTL = 120

# --- Import formatter from hyphenated filename ---
_spec = importlib.util.spec_from_file_location(
    "statusline_format", os.path.join(SCRIPT_DIR, "statusline-format.py")
)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
format_statusline = _mod.format_statusline

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
try:
    ctx_size = int(float(ctx.get("context_window_size") or 200000))
except (TypeError, ValueError):
    ctx_size = 200000
tokens_used = ctx_size * pct // 100

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

# --- Format and write output ---
try:
    output = format_statusline(model, pct, tokens_used)
    if not output:
        raise ValueError("empty output")
except Exception:
    output = (model + " | ?").encode("utf-8")

# --- Single atomic write (< PIPE_BUF so guaranteed atomic on Linux) ---
os.write(1, output)
os._exit(0)
