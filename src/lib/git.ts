import fs from "node:fs";
import path from "node:path";

// Resolve the repo root by walking up for a .git entry. Cheaper than
// `git rev-parse` — subprocess spawns are the dominant statusline cost on
// Windows, and they degrade badly when several sessions render at once.
function findGitDir(start: string): { toplevel: string; gitDir: string } | null {
  let dir = path.resolve(start);
  for (;;) {
    const dotGit = path.join(dir, ".git");
    let st: fs.Stats;
    try {
      st = fs.statSync(dotGit);
    } catch {
      const parent = path.dirname(dir);
      if (parent === dir) return null;
      dir = parent;
      continue;
    }
    if (st.isDirectory()) return { toplevel: dir, gitDir: dotGit };
    // Worktree / submodule: .git is a file containing "gitdir: <path>"
    try {
      const line = fs.readFileSync(dotGit, "utf-8").trim();
      const m = /^gitdir:\s*(.+)$/.exec(line);
      if (m) return { toplevel: dir, gitDir: path.resolve(dir, m[1].trim()) };
    } catch {}
    return { toplevel: dir, gitDir: dotGit };
  }
}

function readBranch(gitDir: string): string {
  const head = fs.readFileSync(path.join(gitDir, "HEAD"), "utf-8").trim();
  const ref = /^ref:\s*refs\/heads\/(.+)$/.exec(head);
  if (ref) return ref[1];
  // Detached HEAD — show the short SHA
  return head.slice(0, 7);
}

export function getGitInfo(cwd: string = process.cwd()): string {
  try {
    const found = findGitDir(cwd);
    if (!found) return "";
    return `${path.basename(found.toplevel)}:${readBranch(found.gitDir)}`;
  } catch {
    return "";
  }
}
