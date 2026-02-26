import chalk from "chalk";
import type { CacheData } from "../lib/types.js";
import { COMPACT_AT, formatTokens } from "../lib/format.js";
import { isCacheVeryStale } from "../lib/cache.js";
import { getGitInfo } from "../lib/git.js";
import { bar, ctxColor } from "./Bar.js";
import { serviceBadge } from "./ServiceBadge.js";
import { usageDisplay } from "./UsageDisplay.js";

const SEP = chalk.dim(" │ ");

export function formatStatusLine(model: string, tokensUsed: number, cache: CacheData | null): string {
  const ctxPct = Math.min(Math.round((tokensUsed / COMPACT_AT) * 100), 100);
  const git = getGitInfo();
  const riderUp = cache?.rider_running ?? false;
  const serenaUp = cache?.serena_running ?? false;
  const stale = isCacheVeryStale(cache);
  const DIVIDER_W = 80;

  // Line 1: Model, Git, Services
  const line1Parts = [chalk.cyan.bold(`⚡ ${model}`)];
  if (git) line1Parts.push(chalk.cyan(` ${git}`));
  line1Parts.push(serviceBadge("Rider", riderUp));
  line1Parts.push(serviceBadge("Serena", serenaUp));
  const line1 = line1Parts.join(SEP);

  // Divider
  const divider = chalk.dim("─".repeat(DIVIDER_W));

  // Line 2: Context bar, Usage bars
  const ctxC = ctxColor(ctxPct);
  const line2 = `Ctx ${bar(ctxPct, ctxC)} ${formatTokens(tokensUsed)}${SEP}${usageDisplay(cache?.usage, stale)}`;

  return `${line1}\n${divider}\n${line2}\n${divider}`;
}
