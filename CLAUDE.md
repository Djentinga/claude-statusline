# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Claude Code statusline plugin (v1.6.1) — pure Python 3, zero external dependencies. Displays context usage, API rate limits, service status, and git info in the Claude Code statusline.

## Architecture

Three-script pipeline, all in `scripts/`:

1. **`statusline-command.py`** — Entry point. Reads JSON from stdin (model info, context window), checks cache freshness (120s TTL), spawns background collector if stale, calls formatter, writes UTF-8 bytes atomically to stdout, exits with `os._exit(0)`.

2. **`statusline-format.py`** — Renderer. Reads `~/.claude/.statusline-cache.json`, builds a multi-line ANSI-colored layout (model + git + services on line 1, context bar + usage bars on line 2, separated by dim dividers). Exports `format_statusline(model, pct, tokens_used) -> bytes`.

3. **`statusline-data.py`** — Background collector. Acquires exclusive `fcntl` lock, fetches Rider/Serena process status via `pgrep`, API usage from `api.anthropic.com/api/oauth/usage` using OAuth token from `~/.claude/.credentials.json`, writes cache atomically via temp file + `os.replace()`.

Supporting: **`ensure-settings.py`** — SessionStart hook that patches `~/.claude/settings.json` to register the statusline command. Idempotent.

## Key conventions

- **Hyphenated filenames** — scripts use hyphens (e.g. `statusline-format.py`); imported via `importlib.util.spec_from_file_location`
- **Atomic I/O everywhere** — cache: temp + `os.replace()`; stdout: single `os.write(1, bytes)` under PIPE_BUF; lock: `fcntl.LOCK_EX | LOCK_NB`
- **Graceful degradation** — all external data wrapped in try/except, fallback to `"?"` or defaults
- **Fast exit** — `os._exit(0)` to skip Python cleanup overhead
- **ANSI color codes** defined as module-level constants (`CYN`, `GRN`, `YEL`, `RED`, `BRD`, `DIM`, `R`)

## Key constants

- `COMPACT_AT = 166000` — auto-compact token threshold (100% on context bar)
- `CACHE_TTL = 120` — seconds before triggering background refresh
- `STALE_THRESHOLD = 240` — seconds before showing stale indicator (`~`)
- `BAR_W = 8` — bar width in characters

## Runtime files (not in repo)

- `~/.claude/.statusline-cache.json` — cached collector data
- `~/.claude/.statusline-data.lock` — exclusive lock for collector
- `~/.claude/settings.json` — patched by SessionStart hook

## Development

No build step, no test suite, no linter config. Scripts run directly via `python3`.

**Install**: `claude --plugin-dir ~/claude-statusline`

**Manual test**: run `echo '{"model":{"display_name":"Test"},"context_window":{"used_percentage":50,"context_window_size":200000}}' | python3 scripts/statusline-command.py`

**Debug cache**: `cat ~/.claude/.statusline-cache.json | python3 -m json.tool`

## Version bumps

Update version in `.claude-plugin/plugin.json`. Commit message format: `feat:` / `fix:` followed by `X.Y.Z - brief description`.
