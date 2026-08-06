import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const LOCK_PATH = path.join(os.homedir(), ".claude", ".statusline-data.lock");

/** True if a live collector already holds the lock. Lets `command` skip
 *  spawning a collector that would immediately exit — with several sessions
 *  open, every one of them goes stale at the same moment and would otherwise
 *  spawn a doomed process on every render. */
export function isCollectorRunning(): boolean {
  let pid: number;
  try {
    pid = Number(fs.readFileSync(LOCK_PATH, "utf-8").trim());
  } catch {
    return false; // no lock file
  }
  if (!(pid > 0)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false; // stale lock — collector died; let a new one reclaim it
  }
}

/** Atomically claim the lock for `pid`. Returns false if someone else holds it.
 *  A lock left behind by a collector that failed to start reads as dead on the
 *  next check, so this cannot wedge the refresh loop. */
export function claimLock(pid: number): boolean {
  try {
    fs.writeFileSync(LOCK_PATH, String(pid), { flag: "wx" });
    return true;
  } catch {
    return false;
  }
}
