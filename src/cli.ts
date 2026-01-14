#!/usr/bin/env bun
/**
 * git-env CLI
 *
 * Sync .env files and manage GitHub Actions secrets/variables
 *
 * Usage:
 *   git-env               # Interactive menu
 *   git-env sync          # Sync .env with .env.example
 *   git-env push          # Push all secrets & variables to GitHub
 *   git-env push -i       # Interactive selection
 *   git-env pull          # Pull variables from GitHub to .env
 */

import { Command } from "commander";
import { select, confirm } from "@inquirer/prompts";
import { syncCommand } from "./commands/sync";
import { pushCommand } from "./commands/push";
import { pullCommand } from "./commands/pull";
import { checkEnvExample, createEnvExampleTemplate } from "./lib/parser";
import {
  printHeader,
  handleExit,
  dim,
  yellow,
  cyan,
  bold,
  green,
} from "./utils";

const program = new Command();

/**
 * Check .env.example status and guide user if needed
 * Returns true if we can proceed, false if we should exit
 */
async function ensureEnvExample(): Promise<boolean> {
  const cwd = process.cwd();
  const status = checkEnvExample(cwd);

  // Case 1: .env.example doesn't exist
  if (!status.exists) {
    console.log(yellow("\n⚠️  No .env.example found in this directory.\n"));
    console.log(
      dim("  git-env uses .env.example as the template for your environment")
    );
    console.log(
      dim("  variables, with annotations to mark secrets and variables.\n")
    );

    const shouldCreate = await confirm({
      message: "Create a template .env.example?",
      default: true,
    });

    if (shouldCreate) {
      createEnvExampleTemplate(cwd);
      console.log(green("\n✓ Created .env.example with template sections\n"));
      console.log(
        dim("  Edit the file to add your variables, then run git-env again.")
      );
      console.log(dim("  Use annotations on section headers:\n"));
      console.log(cyan("    # CREDENTIALS @secrets"));
      console.log(cyan('    API_KEY=""'));
      console.log();
      console.log(cyan("    # SETTINGS @variables"));
      console.log(cyan('    LOG_LEVEL="info"'));
      console.log();
      return false;
    } else {
      console.log(
        dim("\n  Create a .env.example file manually with your variables.")
      );
      console.log(dim("  Use annotations on section headers:\n"));
      console.log(
        cyan("    # CREDENTIALS @secrets    → GitHub Secrets (hidden)")
      );
      console.log(
        cyan("    # SETTINGS @variables     → GitHub Variables (visible)")
      );
      console.log();
      return false;
    }
  }

  // Case 2: .env.example exists but has no annotations
  if (!status.hasAnyAnnotation) {
    console.log(
      yellow(
        "\n⚠️  No @secrets or @variables annotations found in .env.example\n"
      )
    );
    console.log(
      dim("  git-env uses annotations on section headers to determine how to")
    );
    console.log(dim("  push variables to GitHub:\n"));
    console.log(dim("    @secrets   → GitHub Secrets (hidden in logs)"));
    console.log(dim("    @variables → GitHub Variables (visible in logs)\n"));

    if (status.sections.length > 0) {
      console.log(bold("  Found sections:"));
      status.sections.forEach((s) => console.log(dim(`    • ${s}`)));
      console.log();
    }

    console.log(bold("  Add annotations to section headers:\n"));
    console.log(cyan("    # CREDENTIALS @secrets"));
    console.log(cyan('    API_KEY=""'));
    console.log();
    console.log(cyan("    # DEBUG @variables"));
    console.log(cyan('    LOG_LEVEL="info"'));
    console.log();

    const proceed = await confirm({
      message: "Continue anyway? (untagged variables will be skipped)",
      default: false,
    });

    return proceed;
  }

  // Case 3: Has annotations but some variables are untagged
  if (status.untaggedCount > 0) {
    console.log(
      yellow(`\n⚠️  ${status.untaggedCount} variable(s) in untagged sections\n`)
    );
    console.log(dim("  These variables won't be pushed to GitHub."));
    console.log(
      dim(
        "  Add @secrets or @variables to their section headers to include them.\n"
      )
    );
  }

  return true;
}

program
  .name("git-env")
  .description("Sync .env files and manage GitHub Actions secrets/variables")
  .version("1.0.0")
  .hook("preAction", () => {
    printHeader();
  });

// Init command - create template .env.example
program
  .command("init")
  .description("Create a template .env.example file")
  .action(async () => {
    const cwd = process.cwd();
    const status = checkEnvExample(cwd);

    if (status.exists) {
      console.log(yellow("⚠️  .env.example already exists\n"));

      if (!status.hasAnyAnnotation) {
        console.log(dim("  Tip: Add annotations to section headers:\n"));
        console.log(cyan("    # CREDENTIALS @secrets    → GitHub Secrets"));
        console.log(cyan("    # SETTINGS @variables     → GitHub Variables"));
        console.log();
      }
      return;
    }

    createEnvExampleTemplate(cwd);
    console.log(green("✓ Created .env.example\n"));
    console.log(dim("  Edit the file to add your variables."));
    console.log(dim("  Use annotations on section headers:\n"));
    console.log(cyan("    # CREDENTIALS @secrets"));
    console.log(cyan("    # SETTINGS @variables"));
    console.log();
  });

// Sync command
program
  .command("sync")
  .description(
    "Sync .env with .env.example (add new, remove deprecated, preserve values)"
  )
  .action(async () => {
    await syncCommand();
  });

// Push command
program
  .command("push")
  .description("Push secrets and/or variables from .env to GitHub")
  .option("-i, --interactive", "Interactively select items to push")
  .option("-s, --secrets-only", "Push only secrets")
  .option("-v, --variables-only", "Push only variables")
  .action(async (options) => {
    await pushCommand({
      interactive: options.interactive,
      secretsOnly: options.secretsOnly,
      variablesOnly: options.variablesOnly,
    });
  });

// Pull command
program
  .command("pull")
  .description("Pull variables from GitHub to .env (secrets cannot be pulled)")
  .action(async () => {
    await pullCommand();
  });

// Default action - interactive menu when no command provided
program.action(async () => {
  try {
    // Check .env.example status first
    const canProceed = await ensureEnvExample();
    if (!canProceed) {
      process.exit(0);
    }

    const action = await select({
      message: "What would you like to do?",
      choices: [
        { name: "🔄 Sync .env with .env.example", value: "sync" },
        {
          name: "⬆️  Push all secrets & variables to GitHub",
          value: "push-all",
        },
        { name: "🎯 Push selected items (interactive)", value: "push-pick" },
        { name: "⬇️  Pull variables from GitHub", value: "pull" },
      ],
    });

    switch (action) {
      case "sync":
        await syncCommand();
        break;
      case "push-all":
        await pushCommand();
        break;
      case "push-pick":
        await pushCommand({ interactive: true });
        break;
      case "pull":
        await pullCommand();
        break;
    }
  } catch (error) {
    handleExit(error);
  }
});

program.parse();
