#!/usr/bin/env python3
"""Formatter for Claude Code statusline. Called by statusline-command.py."""
import sys, json, os
from datetime import datetime

R   = "\x1b[0m"
CYN = "\x1b[1;36m"
GRN = "\x1b[32m"
YEL = "\x1b[33m"
RED = "\x1b[31m"
BRD = "\x1b[1;31m"

CACHE_PATH = os.path.expanduser("~/.claude/.statusline-cache.json")
BAR_W = 8
WINDOW_5H = 5 * 3600
WINDOW_7D = 7 * 24 * 3600
SEP = " │ "

# --- Args ---
model = sys.argv[1] if len(sys.argv) > 1 else "?"
try:
    pct = int(sys.argv[2]) if len(sys.argv) > 2 else 0
except (TypeError, ValueError):
    pct = 0
try:
    tokens_used = int(sys.argv[3]) if len(sys.argv) > 3 else 0
except (TypeError, ValueError):
    tokens_used = 0

# --- Cache ---
cache = None
try:
    with open(CACHE_PATH) as f:
        cache = json.load(f)
except Exception:
    pass

# --- Helpers ---
COMPACT_AT = 95  # auto-compact threshold

def budget_color(actual, expected):
    """Color based on how far over/under budget. Green=under, Yellow=slightly over, Red=over, BoldRed=way over."""
    if expected is None:
        return GRN if actual < 50 else YEL if actual < 75 else RED if actual < 90 else BRD
    over = actual - expected
    if over <= 0: return GRN
    if over <= 10: return YEL
    if over <= 25: return RED
    return BRD

def ctx_color(val):
    """val is 0-100 where 100 = auto-compact threshold."""
    if val < 50: return GRN
    if val < 75: return YEL
    if val < 90: return RED
    return BRD

def calc_expected(resets_at_str, window_secs):
    try:
        resets_at = datetime.fromisoformat(resets_at_str)
        now = datetime.now(resets_at.tzinfo)
        elapsed = window_secs - (resets_at - now).total_seconds()
        return max(0, min(elapsed / window_secs * 100, 100))
    except Exception:
        return None

def bar(val, cutoff=None, width=BAR_W):
    clamped = max(0, min(val, 100))
    filled = round(clamped * width / 100)
    if cutoff is not None:
        mpos = round(max(0, min(cutoff, 100)) * width / 100)
        mpos = max(0, min(mpos, width - 1))
    else:
        mpos = -1
    chars = []
    for i in range(width):
        if i == mpos:
            chars.append("▒" if i < filled else "▓")
        elif i < filled:
            chars.append("█")
        else:
            chars.append("░")
    return "".join(chars)

def format_usage(usage):
    if not usage:
        return "🕐 ?" + SEP + "📅 ?"
    h5_data = usage.get("five_hour", {})
    d7_data = usage.get("seven_day", {})
    h5 = h5_data.get("utilization")
    d7 = d7_data.get("utilization")
    if h5 is None and d7 is None:
        return "🕐 ?" + SEP + "📅 ?"
    h5_resets = h5_data.get("resets_at")
    d7_resets = d7_data.get("resets_at")
    h5_exp = calc_expected(h5_resets, WINDOW_5H)
    d7_exp = calc_expected(d7_resets, WINDOW_7D)
    # 5-hour
    if h5 is not None:
        h5v = int(h5)
        c = budget_color(h5v, h5_exp)
        exp_str = str(int(h5_exp)) if h5_exp is not None else "?"
        h5s = "🕐 " + c + bar(h5v, h5_exp) + " " + str(h5v) + " (" + exp_str + ")" + R
    else:
        h5s = "🕐 ?"
    # Reset time
    resets = ""
    if h5_resets:
        try:
            utc = datetime.fromisoformat(h5_resets)
            local = utc.astimezone()
            resets = " → " + local.strftime("%H:%M")
        except Exception:
            pass
    # 7-day
    if d7 is not None:
        d7v = int(d7)
        c = budget_color(d7v, d7_exp)
        exp_str = str(int(d7_exp)) if d7_exp is not None else "?"
        d7s = "📅 " + c + bar(d7v, d7_exp) + " " + str(d7v) + " (" + exp_str + ")" + R
    else:
        d7s = "📅 ?"
    return h5s + resets + SEP + d7s

# --- Assemble ---
rider_running = cache.get("rider_running", False) if cache else False
rider = (GRN + "⌨ Connected" + R) if rider_running else "⌨ Disconnected"
usage = cache.get("usage") if cache else None
clamped_pct = max(0, min(pct, 100))
ctx_pct = min(round(clamped_pct / COMPACT_AT * 100), 100)
clr = ctx_color(ctx_pct)
tokens_k = str(tokens_used // 1000) + "k" if tokens_used else "?"

parts = [
    CYN + "⚡ " + model + R,
    "Ctx " + clr + bar(ctx_pct) + " " + tokens_k + R,
    format_usage(usage),
    rider,
]

os.write(1, SEP.join(parts).encode("utf-8"))
os._exit(0)
