import chalk from "chalk";
import type { PromptCache } from "../lib/types.js";
import { CACHE_WARN_SECS } from "../lib/format.js";

function formatLeft(secs: number): string {
  return secs >= 60 ? `${Math.floor(secs / 60)}m` : `${secs}s`;
}

// Prompt cache state comes straight from Claude's stdin — per session, no
// shared files, so multiple windows can't conflict. Freshness relies on
// `refreshInterval` in settings plus Claude re-rendering at cache expiry.
export function cacheIndicator(pc: PromptCache | undefined, now = Date.now()): string {
  if (!pc || typeof pc.expires_at !== "number") return "";
  const left = Math.floor(pc.expires_at - now / 1000);
  if (pc.warm === false || left <= 0) return chalk.red("✗ Cache");
  if (left <= CACHE_WARN_SECS) return chalk.yellow(`⚠ Cache ${formatLeft(left)}`);
  return chalk.green(`✓ Cache ${formatLeft(left)}`);
}
