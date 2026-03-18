import chalk from "chalk";
import type { CacheData, IncidentInfo } from "../lib/types.js";
import { COMPACT_AT, formatTokens } from "../lib/format.js";
import { isCacheVeryStale } from "../lib/cache.js";
import { getGitInfo } from "../lib/git.js";
import { bar, ctxColor } from "./Bar.js";
import { usageDisplay } from "./UsageDisplay.js";

const SEP = chalk.dim(" │ ");

function statusIcon(incident: IncidentInfo | null | undefined): string {
  if (!incident) return chalk.green("●");
  const label = `● ${incident.status}: ${incident.name}`;
  switch (incident.impact) {
    case "critical": return chalk.red(label);
    case "major": return chalk.hex("#FFA500")(label);
    case "minor": return chalk.yellow(label);
    default: return chalk.dim(label);
  }
}

export function formatStatusLine(model: string, tokensUsed: number, cache: CacheData | null, hitRate: number | null = null): string {
  const ctxPct = Math.min(Math.round((tokensUsed / COMPACT_AT) * 100), 100);
  const git = getGitInfo();
  const stale = isCacheVeryStale(cache);
  const DIVIDER_W = 80;

  // Line 1: Model, Git, Status, Cache hit-rate
  const line1Parts = [chalk.cyan.bold(`⚡ ${model}`)];
  if (git) line1Parts.push(chalk.cyan(` ${git}`));
  line1Parts.push(statusIcon(cache?.incident));
  if (hitRate !== null) line1Parts.push(chalk.dim(`Cache hit-rate: ${hitRate}%`));
  const line1 = line1Parts.join(SEP);

  // Divider
  const divider = chalk.dim("─".repeat(DIVIDER_W));

  // Line 2: Context bar, Usage bars
  const ctxC = ctxColor(ctxPct);
  const line2 = `Ctx ${bar(ctxPct, ctxC)} ${formatTokens(tokensUsed)}${SEP}${usageDisplay(cache?.usage, stale)}`;

  return `${line1}\n${divider}\n${line2}\n${divider}`;
}
