import chalk from "chalk";

export function serviceBadge(name: string, up: boolean): string {
  return up ? chalk.green(`▣ ${name}`) : chalk.dim(`▣ ${name}`);
}
