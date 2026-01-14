import { checkbox, select } from "@inquirer/prompts";
import { loadEnvExample, type SectionInfo } from "../lib/parser";
import { loadEnvRecord } from "../lib/env";
import { checkGitHubCLI, checkGitHubAuth, pushItems } from "../lib/github";
import { bold, dim, green, yellow, truncate, handleExit } from "../utils";

export interface PushOptions {
  cwd?: string;
  interactive?: boolean;
  secretsOnly?: boolean;
  variablesOnly?: boolean;
}

interface SelectChoice {
  name: string;
  value: string;
  checked: boolean;
  disabled?: string;
}

async function selectItemsInteractive(
  items: string[],
  env: Record<string, string>,
  type: "secret" | "variable",
  sections: Map<string, SectionInfo>
): Promise<string[]> {
  const choices: SelectChoice[] = [];

  // Group items by section
  const itemSet = new Set(items);

  for (const [sectionName, sectionData] of sections) {
    // Only show sections that match the type
    if (type === "secret" && !sectionData.isSecret) continue;
    if (type === "variable" && !sectionData.isVariable) continue;

    const sectionItems = sectionData.variables.filter((v) => itemSet.has(v));
    if (sectionItems.length === 0) continue;

    // Add separator for section
    choices.push({
      name: dim(`── ${sectionName} ──`),
      value: `__sep_${sectionName}`,
      checked: false,
      disabled: " ",
    });

    for (const item of sectionItems) {
      const value = env[item];
      const hasValue = !!value;
      const preview = hasValue ? truncate(value, 40) : "(not set)";

      choices.push({
        name: `${item} ${dim(preview)}`,
        value: item,
        checked: hasValue,
        disabled: hasValue ? undefined : dim("no value"),
      });
    }
  }

  if (choices.length === 0) {
    console.log(dim(`  No ${type}s found (add @${type}s to section headers)`));
    return [];
  }

  const selected = await checkbox({
    message: `Select ${type}s to push`,
    choices,
    pageSize: 15,
    loop: false,
    instructions: dim(
      "  ↑↓ navigate • space toggle • a toggle all • enter confirm"
    ),
  });

  // Filter out separators
  return selected.filter((s: string) => !s.startsWith("__sep_"));
}

async function pushSecretsAll(
  secrets: string[],
  env: Record<string, string>
): Promise<void> {
  console.log(bold("\n🔐 Secrets\n"));

  const items = secrets.filter((s) => env[s]);
  if (items.length === 0) {
    console.log(dim("  No secrets to push"));
    return;
  }

  await pushItems(items, env, "secret");
}

async function pushVariablesAll(
  variables: string[],
  env: Record<string, string>
): Promise<void> {
  console.log(bold("\n📋 Variables\n"));

  const items = variables.filter((v) => env[v]);
  if (items.length === 0) {
    console.log(dim("  No variables to push"));
    return;
  }

  await pushItems(items, env, "variable");
}

async function pushInteractive(
  secrets: string[],
  variables: string[],
  env: Record<string, string>,
  sections: Map<string, SectionInfo>
): Promise<void> {
  const what = await select({
    message: "What would you like to push?",
    choices: [
      { name: "🔐 Secrets only", value: "secrets" },
      { name: "📋 Variables only", value: "variables" },
      { name: "🔐📋 Both", value: "both" },
    ],
  });

  if (what === "secrets" || what === "both") {
    const selected = await selectItemsInteractive(
      secrets,
      env,
      "secret",
      sections
    );
    if (selected.length > 0) {
      console.log(bold("\n🔐 Pushing secrets...\n"));
      const { success, failed } = await pushItems(selected, env, "secret");
      console.log(
        dim(`\n  ${success} pushed${failed ? `, ${failed} failed` : ""}`)
      );
    }
  }

  if (what === "variables" || what === "both") {
    const selected = await selectItemsInteractive(
      variables,
      env,
      "variable",
      sections
    );
    if (selected.length > 0) {
      console.log(bold("\n📋 Pushing variables...\n"));
      const { success, failed } = await pushItems(selected, env, "variable");
      console.log(
        dim(`\n  ${success} pushed${failed ? `, ${failed} failed` : ""}`)
      );
    }
  }
}

export async function pushCommand(options: PushOptions = {}): Promise<void> {
  const rootDir = options.cwd ?? process.cwd();

  try {
    // Check GitHub CLI
    await checkGitHubCLI();
    await checkGitHubAuth();

    // Load configuration
    const template = loadEnvExample(rootDir);
    const env = loadEnvRecord(rootDir);

    // Warn about untagged variables
    if (template.untagged.length > 0) {
      console.log(
        yellow(
          `\n⚠️  ${template.untagged.length} variable(s) in untagged sections will be skipped`
        )
      );
      console.log(
        dim(
          "  Add @secrets or @variables to their section headers to include them.\n"
        )
      );
    }

    if (options.interactive) {
      await pushInteractive(
        template.secrets,
        template.variables,
        env,
        template.sections
      );
    } else {
      if (!options.variablesOnly) {
        await pushSecretsAll(template.secrets, env);
      }
      if (!options.secretsOnly) {
        await pushVariablesAll(template.variables, env);
      }
    }

    console.log(green("\n✓ Done\n"));
  } catch (error) {
    handleExit(error);
  }
}
