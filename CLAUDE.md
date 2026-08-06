# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Claude Code statusline plugin — TypeScript CLI formatter using chalk. Displays context usage, API rate limits, service status, and git info in the Claude Code statusline. Version tracked in `.claude-plugin/plugin.json`.

## Architecture

Two bundled entry points (`dist/`) built from `src/`, plus a hook:

1. **`src/command.ts`** → `dist/command.mjs` — Entry point. Reads JSON from stdin (Claude provides `{"model": {"display_name": ...}, "context_window": {"used_percentage": N, "context_window_size": N}}`), checks cache freshness, spawns background collector if stale *and no collector holds the lock*, formats the statusline to stdout, exits.

2. **`src/collector.ts`** → `dist/collector.mjs` — Background data collector. Acquires PID-based lock, skips fetching while the cache is fresh, backs off longer after cached usage API rate-limit errors, fetches API usage from `api.anthropic.com/api/oauth/usage` using OAuth token from `~/.claude/.credentials.json` (path: `claudeAiOauth.accessToken`), and writes cache atomically via temp file + `fs.renameSync()`.

### Performance: subprocess spawns are the enemy

`command.mjs` runs on *every* statusline render, in *every* open session. On Windows each process spawn costs ~60–130ms and degrades sharply under concurrency (measured: 60ms → 1000ms+ `git` timeouts with several sessions rendering at once). Three rules follow:

- **Never shell out from `command.ts`.** Git info comes from reading `.git/HEAD` and walking up for the repo root (`src/lib/git.ts`), not `git rev-parse` — ~0.3ms instead of ~120ms, and it can't time out. Handles worktrees (`.git` as a file with `gitdir:`) and detached HEAD.
- **Don't spawn collectors that will immediately exit.** All sessions go stale at the same instant, so `command.ts` checks the lock first (`src/lib/lock.ts`) and claims it with the child's PID *synchronously at spawn time* — the collector takes ~80ms to boot and grab the lock itself, and every render in that window would otherwise spawn a duplicate. `acquireLock()` in the collector treats a lock already holding its own PID as owned.
- **`claude --version` is a ~270MB binary spawn (~450ms).** It's cached in the cache file with a 24h TTL (`version` / `versionTs`), not re-run every collector cycle.

3. **`scripts/ensure-settings.mjs`** — SessionStart hook (registered in `hooks/hooks.json`). Patches `~/.claude/settings.json` to register `node .../dist/command.mjs`. Idempotent. Node (not Python) for cross-platform support — Windows has no `python3`.

### Component hierarchy

```
StatusLine          — main formatter
├── Line 1          — model, git info
├── Divider
├── Line 2          — context bar, usage bars
│   ├── Bar         — reusable progress bar with optional cutoff marker
│   └── UsageDisplay — 5h + 7d usage (or enterprise credit spend)
└── Divider
```

### Context bar rescaling

The context bar does NOT use the raw `used_percentage` from stdin. It rescales: `ctx_pct = tokens_used / COMPACT_AT * 100`, so 100% on the bar = the auto-compact threshold (967k tokens), not the full context window.

### 7-day expected usage

Uses daily granularity (`Math.ceil(elapsed / 86400)` days), not continuous time. ~14% per day.

### Enterprise mode

When the usage API returns `five_hour` AND `seven_day` both `null` and `extra_usage.is_enabled`, the account has no rolling 5h/7d windows. `UsageDisplay` swaps the two bars for a single credit-spend bar: `💳 [bar] $used / $limit (util%)`. `extra_usage` credits are in cents (`/100` → currency units).

## Key constants (in `src/lib/format.ts`)

- `COMPACT_AT = 967_000` — auto-compact token threshold (100% on context bar)
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
