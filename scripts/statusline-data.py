#!/usr/bin/env python3
"""Background data collector for statusline. Writes to cache file atomically."""
import json, subprocess, os, time, tempfile
import urllib.request

CREDS_PATH = os.path.expanduser("~/.claude/.credentials.json")
CACHE_PATH = os.path.expanduser("~/.claude/.statusline-cache.json")


def check_rider():
    try:
        subprocess.run(["pgrep", "-fi", "rider"], capture_output=True, check=True)
        return True
    except Exception:
        return False


def fetch_usage():
    try:
        with open(CREDS_PATH) as f:
            creds = json.load(f)
        token = creds["claudeAiOauth"]["accessToken"]
        req = urllib.request.Request(
            "https://api.anthropic.com/api/oauth/usage",
            headers={
                "Authorization": f"Bearer {token}",
                "anthropic-beta": "oauth-2025-04-20",
                "User-Agent": "claude-code/2.1.47",
            },
        )
        resp = urllib.request.urlopen(req, timeout=3)
        return json.loads(resp.read().decode())
    except Exception:
        return None


def main():
    result = {
        "ts": time.time(),
        "rider_running": check_rider(),
        "usage": fetch_usage(),
    }
    # Atomic write: temp file + rename prevents partial reads
    dir_path = os.path.dirname(CACHE_PATH)
    fd, tmp_path = tempfile.mkstemp(dir=dir_path, suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(result, f)
        os.replace(tmp_path, CACHE_PATH)
    except Exception:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


if __name__ == "__main__":
    main()
