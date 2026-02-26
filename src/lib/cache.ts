import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CacheData } from "./types.js";

export const CACHE_PATH = path.join(os.homedir(), ".claude", ".statusline-cache.json");
export const CACHE_TTL = 120;
export const STALE_THRESHOLD = 2 * CACHE_TTL;

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
