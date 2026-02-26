import chalk from "chalk";
import type { UsageData } from "../lib/types.js";
import { calcExpected, resetTimeLocal } from "../lib/format.js";
import { bar, budgetColor } from "./Bar.js";

const WINDOW_5H = 5 * 3600;
const WINDOW_7D = 7 * 24 * 3600;
const SEP = chalk.dim(" │ ");

export function usageDisplay(usage: UsageData | undefined, stale: boolean): string {
  const stalePrefix = stale ? chalk.dim("~") : "";

  if (!usage) {
    return `${stalePrefix}🕐 ?${SEP}📅 ?`;
  }

  const h5 = usage.five_hour;
  const d7 = usage.seven_day;
  const h5v = h5?.utilization != null ? Math.floor(h5.utilization) : null;
  const d7v = d7?.utilization != null ? Math.floor(d7.utilization) : null;

  if (h5v === null && d7v === null) {
    return `${stalePrefix}🕐 ?${SEP}📅 ?`;
  }

  const h5Exp = calcExpected(h5?.resets_at, WINDOW_5H);
  const d7Exp = calcExpected(d7?.resets_at, WINDOW_7D, true);
  const resetTime = resetTimeLocal(h5?.resets_at);

  const parts: string[] = [stalePrefix];

  // 5-hour
  if (h5v !== null) {
    const c = budgetColor(h5v, h5Exp);
    const expStr = h5Exp !== null ? String(Math.floor(h5Exp)) : "?";
    parts.push(`🕐 ${bar(h5v, c, h5Exp)} ${chalk[c](String(h5v))} (${expStr})`);
  } else {
    parts.push("🕐 ?");
  }

  if (resetTime) parts.push(` → ${resetTime}`);

  parts.push(SEP);

  // 7-day
  if (d7v !== null) {
    const c = budgetColor(d7v, d7Exp);
    const expStr = d7Exp !== null ? String(Math.floor(d7Exp)) : "?";
    parts.push(`📅 ${bar(d7v, c, d7Exp)} ${chalk[c](String(d7v))} (${expStr})`);
  } else {
    parts.push("📅 ?");
  }

  return parts.join("");
}
