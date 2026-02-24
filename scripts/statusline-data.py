#!/usr/bin/env python3
"""Background data collector for statusline. Writes to cache file atomically."""
import json, subprocess, os, sys, time, tempfile, fcntl
import urllib.request

CREDS_PATH = os.path.expanduser("~/.claude/.credentials.json")
CACHE_PATH = os.path.expanduser("~/.claude/.statusline-cache.json")
LOCK_PATH = os.path.expanduser("~/.claude/.statusline-data.lock")


def get_claude_version():
    """Get Claude CLI version string. Returns 'unknown' on failure."""
    try:
        result = subprocess.run(
            ["claude", "--version"],
            capture_output=True, timeout=2, text=True,
        )
        version = result.stdout.strip()
        # Output is typically just the version number like "2.3.0"
        if version:
            return version
    except Exception:
        pass
    return "unknown"


_claude_version = None


def claude_user_agent():
    global _claude_version
    if _claude_version is None:
        _claude_version = get_claude_version()
    return f"claude-code/{_claude_version}"


def check_process(pattern):
    try:
        subprocess.run(["pgrep", "-fi", pattern], capture_output=True, check=True)
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
                "User-Agent": claude_user_agent(),
            },
        )
        resp = urllib.request.urlopen(req, timeout=3)
        return json.loads(resp.read().decode())
    except Exception:
        return None


def main():
    # Acquire exclusive lock — exit if another collector is already running
    lock_fd = os.open(LOCK_PATH, os.O_CREAT | os.O_WRONLY)
    try:
        fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        os.close(lock_fd)
        sys.exit(0)

    try:
        result = {
            "ts": time.time(),
            "rider_running": check_process("rider"),
            "serena_running": check_process("serena start-mcp-server"),
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
    finally:
        os.close(lock_fd)


if __name__ == "__main__":
    main()
