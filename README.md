<img width="834" height="165" alt="image" src="https://github.com/user-attachments/assets/b294d988-e34f-4c11-a699-8611fb2098c2" />


# claude-statusline

Custom Claude Code statusline plugin with context-to-compact progress bar and API usage tracking.

## Features

- **Context bar** — rescaled so 100% = auto-compact threshold (~967k tokens). Shows 0–967k range, not the full context window.
- **5-hour / 7-day usage bars** — with expected-usage markers based on time elapsed in window
- **5-hour reset time** — shows when your rate limit window resets
- **Prompt cache indicator** — green ✓ while the cache is warm, yellow ⚠ in the last 30s, red ✗ once expired (next prompt re-caches)
- **Git branch** and **Claude service status**

## Install

In Claude Code:

```
/plugin marketplace add Djentinga/claude-marketplace
/plugin install statusline@djentinga
```

Or run `/plugin` and pick it from the menu.

Then start a new session. The `SessionStart` hook points `statusLine` in `~/.claude/settings.json` at the plugin. After a plugin update, start a new session to switch to the new version.
