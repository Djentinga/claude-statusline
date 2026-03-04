# claude-statusline

Custom Claude Code statusline plugin with context-to-compact progress bar, API usage tracking, and service status.

## Features

- **Context bar** — rescaled so 100% = auto-compact threshold (~166k tokens). Shows 0–167k range, not the full context window.
- **5-hour / 7-day usage bars** — with expected-usage markers based on time elapsed in window
- **5-hour reset time** — shows when your rate limit window resets
- **Service status** — badges for JetBrains Rider and Serena

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
  command.tsx          # Entry point — reads stdin JSON, checks cache, spawns collector, renders Ink output
  collector.ts         # Background data collector — service status, API usage, writes cache
  components/
    StatusLine.ts      # Main layout — model, git, services, context bar, usage bars
    Bar.ts             # Reusable progress bar with optional cutoff marker
    UsageDisplay.ts    # 5h + 7d usage with expected-usage markers
    ServiceBadge.ts    # Green/dim indicator per service
  lib/
    format.ts          # Constants (COMPACT_AT, BAR_W, CACHE_TTL) and formatting helpers
    types.ts           # TypeScript interfaces
scripts/
  ensure-settings.py   # SessionStart hook — patches settings.json once
hooks/
  hooks.json           # Registers the SessionStart hook
dist/                  # Built output (esbuild bundles src/ → dist/)
```

Runtime cache is written to `~/.claude/.statusline-cache.json` (not part of the plugin).
