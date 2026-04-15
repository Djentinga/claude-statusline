/**
 * Convert a cwd path to the project-dir slug used by Claude under
 * `~/.claude/projects/`.
 *
 * Observed rules from existing project dirs:
 *   `/` and `.` → `-`
 *   all other non-alphanumeric (spaces, special chars) are stripped
 *
 * Examples:
 *   `/home/joachimarting/claude-statusline`
 *     → `-home-joachimarting-claude-statusline`
 *   `/mnt/c/Users/JoachimArting/source/Barkfors/T5.Aspire`
 *     → `-mnt-c-Users-JoachimArting-source-Barkfors-T5-Aspire`
 *   `/mnt/c/Users/JoachimArting/source/Djentinga/Spaceport Architect`
 *     → `-mnt-c-Users-JoachimArting-source-Djentinga-SpaceportArchitect`
 *   `/home/joachimarting/.claude`
 *     → `-home-joachimarting--claude`
 */
export function cwdToSlug(cwd: string): string {
  return cwd
    .replace(/[\/.]/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "");
}
