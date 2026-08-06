const t_boot = performance.now();
const chalk = (await import("chalk")).default;
const t_chalk = performance.now();
const fs = await import("node:fs");
try { JSON.parse(fs.readFileSync(process.env.HOME + "/.claude/.statusline-cache.json", "utf8")); } catch {}
const t_cache = performance.now();
const { getGitInfo } = await import("./src/lib/git.ts");
getGitInfo("C:/Code/claude-statusline");
const t_git = performance.now();
console.log(`node bootstrap -> our code: ${t_boot.toFixed(1)}ms   <-- fixed floor`);
console.log(`chalk import:               ${(t_chalk - t_boot).toFixed(1)}ms`);
console.log(`cache read+parse:           ${(t_cache - t_chalk).toFixed(1)}ms`);
console.log(`git (fs walk):              ${(t_git - t_cache).toFixed(1)}ms`);
console.log(`TOTAL:                      ${t_git.toFixed(1)}ms`);
