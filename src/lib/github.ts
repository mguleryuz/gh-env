import { $ } from "bun";
import { red, dim } from "../utils";

/**
 * Check if GitHub CLI is installed
 */
export async function checkGitHubCLI(): Promise<void> {
  try {
    await $`gh --version`.quiet();
  } catch {
    console.error(red("\n✗ GitHub CLI (gh) not found"));
    console.error(dim("  Install from: https://cli.github.com/"));
    process.exit(1);
  }
}

/**
 * Check if user is authenticated with GitHub CLI
 */
export async function checkGitHubAuth(): Promise<void> {
  try {
    await $`gh auth status`.quiet();
  } catch {
    console.error(red("\n✗ Not authenticated with GitHub CLI"));
    console.error(dim("  Run: gh auth login"));
    process.exit(1);
  }
}

/**
 * Set a GitHub secret
 */
export async function setSecret(name: string, value: string): Promise<void> {
  await $`gh secret set ${name} --body ${value}`.quiet();
}

/**
 * Set a GitHub variable
 */
export async function setVariable(name: string, value: string): Promise<void> {
  await $`gh variable set ${name} --body ${value}`.quiet();
}

/**
 * Get a GitHub variable value
 */
export async function getVariable(name: string): Promise<string | null> {
  try {
    const result = await $`gh variable get ${name}`.quiet();
    return result.stdout.toString().trim() || null;
  } catch {
    return null;
  }
}

/**
 * Push items to GitHub (secrets or variables)
 */
export async function pushItems(
  items: string[],
  env: Record<string, string>,
  type: "secret" | "variable",
  log: (msg: string) => void = console.log
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const name of items) {
    const value = env[name];
    if (!value) continue;

    try {
      if (type === "secret") {
        await setSecret(name, value);
      } else {
        await setVariable(name, value);
      }
      log(`  \x1b[32m✓\x1b[0m ${name}`);
      success++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log(`  \x1b[31m✗\x1b[0m ${name} ${dim(msg)}`);
      failed++;
    }
  }

  return { success, failed };
}
