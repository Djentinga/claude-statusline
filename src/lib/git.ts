import { execSync } from "node:child_process";
import path from "node:path";

export function getGitInfo(): string {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      timeout: 1000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    const toplevel = execSync("git rev-parse --show-toplevel", {
      timeout: 1000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    const repo = path.basename(toplevel);
    return `${repo}:${branch}`;
  } catch {
    return "";
  }
}
