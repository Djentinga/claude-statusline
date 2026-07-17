# claude-statusline

Custom Claude Code statusline plugin with context-to-compact progress bar and API usage tracking.

## Features

- **Context bar** — rescaled so 100% = auto-compact threshold (~967k tokens). Shows 0–967k range, not the full context window.
- **5-hour / 7-day usage bars** — with expected-usage markers based on time elapsed in window
- **5-hour reset time** — shows when your rate limit window resets

## Install

```bash
git clone git@github.com:Djentinga/claude-statusline.git ~/claude-statusline
npm install && npm run build
```

Then start Claude Code with the plugin:

```bash
claude --plugin-dir ~/claude-statusline
```

On first launch, the `SessionStart` hook patches `~/.claude/settings.json` to register the statusline command. Subsequent sessions pick it up automatically.

## Structure

```
src/
  command.ts           # Entry point — reads stdin JSON, checks cache, spawns collector, formats output
  collector.ts         # Background data collector — service status, API usage, writes cache with TTL/backoff
  components/
    StatusLine.ts      # Main layout — model, git, services, context bar, usage bars
    Bar.ts             # Reusable progress bar with optional cutoff marker
    UsageDisplay.ts    # 5h + 7d usage with expected-usage markers
  lib/
    format.ts          # Constants (COMPACT_AT, BAR_W) and formatting helpers
    cache.ts           # Cache path, TTL, stale checks, and cache reader
    types.ts           # TypeScript interfaces
scripts/
  ensure-settings.mjs  # SessionStart hook — patches settings.json once
hooks/
  hooks.json           # Registers the SessionStart hook
dist/                  # Built output (esbuild bundles src/ → dist/)
```

Runtime cache is written to `~/.claude/.statusline-cache.json` (not part of the plugin).
