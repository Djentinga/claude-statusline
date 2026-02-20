# claude-statusline

Custom Claude Code statusline plugin with context-to-compact progress bar, API usage tracking, and Rider connection status.

## Features

- **Context bar** — rescaled so 100 = auto-compact threshold (~95% actual context). `Ctx 63/100` means 37% left until auto-compact.
- **5-hour / 7-day usage bars** — with expected-usage markers based on time elapsed in window
- **5-hour reset time** — shows when your rate limit window resets
- **Rider status** — shows whether JetBrains Rider is running

## Install

```bash
git clone git@github.com:Djentinga/claude-statusline.git ~/claude-statusline
```

Then start Claude Code with the plugin:

```bash
claude --plugin-dir ~/claude-statusline
```

On first launch, the `SessionStart` hook patches `~/.claude/settings.json` to point the statusline at the plugin's scripts. Subsequent sessions pick it up automatically — the hook no-ops if already configured.

## Structure

```
scripts/
  statusline-command.py   # Entry point — reads stdin from Claude, triggers cache refresh, calls formatter
  statusline-format.py    # Renders bars, colors, and layout
  statusline-data.py      # Background collector — Rider status, API usage (runs every 2 min)
  ensure-settings.py      # SessionStart hook — patches settings.json once
hooks/
  hooks.json              # Registers the SessionStart hook
```

Runtime cache is written to `~/.claude/.statusline-cache.json` (not part of the plugin).
