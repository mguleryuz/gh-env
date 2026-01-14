import { loadEnvExample } from "../lib/parser";
import { updateEnvVariable } from "../lib/env";
import { checkGitHubCLI, checkGitHubAuth, getVariable } from "../lib/github";
import { bold, dim, green, yellow } from "../utils";

export interface PullOptions {
  cwd?: string;
}

export async function pullCommand(options: PullOptions = {}): Promise<void> {
  const rootDir = options.cwd ?? process.cwd();

  console.log(bold("\n📥 Pulling variables from GitHub\n"));
  console.log(dim("  Note: Secrets cannot be pulled (GitHub security)\n"));

  try {
    // Check GitHub CLI
    await checkGitHubCLI();
    await checkGitHubAuth();

    // Load configuration
    const template = loadEnvExample(rootDir);
    let pulled = 0;

    // Only pull variables (not secrets)
    for (const variable of template.variables) {
      const value = await getVariable(variable);

      if (value) {
        updateEnvVariable(rootDir, variable, value);
        console.log(`  ${green("✓")} ${variable}`);
        pulled++;
      } else {
        console.log(`  ${dim("–")} ${dim(variable)}`);
      }
    }

    if (pulled > 0) {
      console.log(dim(`\n  Updated .env with ${pulled} variable(s)`));
    } else {
      console.log(yellow("\n  No variables found in GitHub"));
    }

    console.log(green("\n✓ Done\n"));
  } catch (error) {
    if (error instanceof Error) {
      console.error(`\n❌ ${error.message}`);
    }
    process.exit(1);
  }
}
