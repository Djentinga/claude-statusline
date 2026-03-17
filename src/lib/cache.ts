import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CacheData, HitRateData } from "./types.js";

export const CACHE_PATH = path.join(os.homedir(), ".claude", ".statusline-cache.json");
export const HITRATE_PATH = path.join(os.homedir(), ".claude", ".statusline-hitrate.json");
export const CACHE_TTL = 120;
export const STALE_THRESHOLD = 2 * CACHE_TTL;
const SESSION_GAP = 600; // 10 min gap = new session

export function readCache(): CacheData | null {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));
  } catch {
    return null;
  }
}

export function isCacheStale(cache: CacheData | null): boolean {
  if (!cache) return true;
  return Date.now() / 1000 - cache.ts > CACHE_TTL;
}

export function isCacheVeryStale(cache: CacheData | null): boolean {
  if (!cache?.ts) return true;
  return Date.now() / 1000 - cache.ts > STALE_THRESHOLD;
}

export function recordCacheHit(hit: boolean): void {
  const now = Date.now() / 1000;
  let data: HitRateData = { hits: 0, total: 0, last_ts: now };
  try {
    const raw = JSON.parse(fs.readFileSync(HITRATE_PATH, "utf-8")) as HitRateData;
    if (now - raw.last_ts < SESSION_GAP) {
      data = raw;
    }
  } catch {}
  data.total++;
  if (hit) data.hits++;
  data.last_ts = now;
  try {
    fs.writeFileSync(HITRATE_PATH, JSON.stringify(data));
  } catch {}
}

export function readHitRate(): number | null {
  try {
    const data = JSON.parse(fs.readFileSync(HITRATE_PATH, "utf-8")) as HitRateData;
    if (Date.now() / 1000 - data.last_ts > SESSION_GAP) return null;
    if (data.total === 0) return null;
    return Math.round((data.hits / data.total) * 100);
  } catch {
    return null;
  }
}
