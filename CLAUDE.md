# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Claude Code statusline plugin — TypeScript + Ink (React for CLIs). Displays context usage, API rate limits, service status, and git info in the Claude Code statusline. Version tracked in `.claude-plugin/plugin.json`.

## Architecture

Two bundled entry points (`dist/`) built from `src/`, plus a hook:

1. **`src/command.tsx`** → `dist/command.mjs` — Entry point. Reads JSON from stdin (Claude provides `{"model": {"display_name": ...}, "context_window": {"used_percentage": N, "context_window_size": N}}`), checks cache freshness, spawns background collector if stale, renders Ink components to stdout, exits.

2. **`src/collector.ts`** → `dist/collector.mjs` — Background data collector. Acquires PID-based lock, fetches Rider/Serena process status via `pgrep`, API usage from `api.anthropic.com/api/oauth/usage` using OAuth token from `~/.claude/.credentials.json` (path: `claudeAiOauth.accessToken`), writes cache atomically via temp file + `fs.renameSync()`.

3. **`scripts/ensure-settings.py`** — SessionStart hook (registered in `hooks/hooks.json`). Patches `~/.claude/settings.json` to register `node .../dist/command.mjs`. Idempotent.

### Component hierarchy

```
StatusLine          — main layout (Box flexDirection="column")
├── Line 1          — model, git info, service badges
│   ├── ServiceBadge — green/dim indicator per service
├── Divider
├── Line 2          — context bar, usage bars
│   ├── Bar         — reusable progress bar with optional cutoff marker
│   └── UsageDisplay — 5h + 7d usage with expected-usage markers
└── Divider
```

### Context bar rescaling

The context bar does NOT use the raw `used_percentage` from stdin. It rescales: `ctx_pct = tokens_used / COMPACT_AT * 100`, so 100% on the bar = the auto-compact threshold (166k tokens), not the full context window.

### 7-day expected usage

Uses daily granularity (`Math.ceil(elapsed / 86400)` days), not continuous time. ~14% per day.

## Key constants (in `src/lib/format.ts`)

- `COMPACT_AT = 166_000` — auto-compact token threshold (100% on context bar)
- `BAR_W = 8` — bar width in characters
- `CACHE_TTL = 120` — seconds before triggering background refresh
- `STALE_THRESHOLD = 240` — seconds before showing stale indicator (`~`)

## Runtime files (not in repo)

- `~/.claude/.statusline-cache.json` — cached collector data
- `~/.claude/.statusline-data.lock` — PID-based lock for collector
- `~/.claude/settings.json` — patched by SessionStart hook
- `~/.claude/.credentials.json` — OAuth token (read-only, managed by Claude)

## Development

**Install**: `npm install && npm run build`

**Plugin install**: `claude --plugin-dir ~/claude-statusline`

**Build**: `npm run build` (esbuild bundles `src/` → `dist/`)

**Manual test**: `echo '{"model":{"display_name":"Test"},"context_window":{"used_percentage":50,"context_window_size":200000}}' | node dist/command.mjs`

**Debug cache**: `cat ~/.claude/.statusline-cache.json | python3 -m json.tool`

## Version bumps

**Always bump the version in `.claude-plugin/plugin.json` before pushing.** Commit message format: `feat:` / `fix:` followed by `X.Y.Z - brief description`.
