export const COMPACT_AT = 967_000;
export const BAR_W = 8;

export function formatTokens(tokens: number): string {
  if (tokens < 1000) return String(tokens);
  return Math.floor(tokens / 1000) + "k";
}

export function calcExpected(
  resetsAt: string | undefined,
  windowSecs: number,
  daily = false,
): number | null {
  if (!resetsAt) return null;
  try {
    const resets = new Date(resetsAt).getTime();
    const now = Date.now();
    const elapsed = windowSecs - (resets - now) / 1000;
    if (daily) {
      const daysElapsed = Math.ceil(Math.max(0, elapsed) / 86400);
      const totalDays = Math.round(windowSecs / 86400);
      return Math.max(0, Math.min((daysElapsed / totalDays) * 100, 100));
    }
    return Math.max(0, Math.min((elapsed / windowSecs) * 100, 100));
  } catch {
    return null;
  }
}

// Input rates per 1M tokens ($) — base and cached (90% discount)
const MODEL_RATES: Record<string, number> = { opus: 15, sonnet: 3, haiku: 0.8 };
const CACHE_HIT_RATE = 0.75; // typical Claude Code session after initial turns

export function estimateCost(model: string, tokens: number): number {
  const key = model.toLowerCase();
  let base = 3; // default sonnet
  for (const [name, r] of Object.entries(MODEL_RATES)) {
    if (key.includes(name)) { base = r; break; }
  }
  const effective = base * (1 - CACHE_HIT_RATE) + (base * 0.1) * CACHE_HIT_RATE;
  return (tokens / 1_000_000) * effective;
}

export function resetTimeLocal(resetsAt: string | undefined): string {
  if (!resetsAt) return "";
  try {
    const d = new Date(resetsAt);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return "";
  }
}
