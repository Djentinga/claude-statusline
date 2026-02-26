import chalk from "chalk";
import { BAR_W } from "../lib/format.js";

type Color = "green" | "yellow" | "red" | "redBright";

export function ctxColor(val: number): Color {
  if (val < 50) return "green";
  if (val < 75) return "yellow";
  if (val < 90) return "red";
  return "redBright";
}

export function budgetColor(actual: number, expected: number | null): Color {
  if (expected === null) {
    if (actual < 50) return "green";
    if (actual < 75) return "yellow";
    if (actual < 90) return "red";
    return "redBright";
  }
  const over = actual - expected;
  if (over <= 0) return "green";
  if (over <= 10) return "yellow";
  if (over <= 25) return "red";
  return "redBright";
}

export function bar(value: number, color: Color, cutoff?: number | null, width = BAR_W): string {
  const clamped = Math.max(0, Math.min(value, 100));
  const filled = Math.round((clamped * width) / 100);
  const mpos =
    cutoff != null
      ? Math.max(0, Math.min(Math.round((Math.max(0, Math.min(cutoff, 100)) * width) / 100), width - 1))
      : -1;

  const chars: string[] = [];
  for (let i = 0; i < width; i++) {
    if (i === mpos) {
      chars.push(i < filled ? "▒" : "▓");
    } else if (i < filled) {
      chars.push("█");
    } else {
      chars.push("░");
    }
  }

  return chalk[color](chars.join(""));
}
