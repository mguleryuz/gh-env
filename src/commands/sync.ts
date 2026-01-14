import { syncEnvFile } from "../lib/env";
import { loadEnvExample } from "../lib/parser";
import { green, dim, yellow } from "../utils";

export interface SyncOptions {
  cwd?: string;
}

export async function syncCommand(options: SyncOptions = {}): Promise<void> {
  const rootDir = options.cwd ?? process.cwd();

  console.log("🔄 Syncing .env with .env.example...\n");

  try {
    // Get info about template
    const template = loadEnvExample(rootDir);
    const totalVars =
      template.secrets.length +
      template.variables.length +
      template.untagged.length;
    console.log(`📋 .env.example has ${totalVars} variables`);

    const parts: string[] = [];
    if (template.secrets.length > 0)
      parts.push(`${template.secrets.length} secrets`);
    if (template.variables.length > 0)
      parts.push(`${template.variables.length} variables`);
    if (template.untagged.length > 0)
      parts.push(`${template.untagged.length} untagged`);
    console.log(dim(`   (${parts.join(", ")})`));

    if (template.untagged.length > 0) {
      console.log(
        yellow(
          `\n⚠️  ${template.untagged.length} variable(s) in untagged sections`
        )
      );
      console.log(
        dim(
          "  These won't be pushed to GitHub. Add @secrets or @variables to include them."
        )
      );
    }

    // Sync the files
    const { added, removed, preserved, structureUpdated } =
      syncEnvFile(rootDir);

    // Report results
    if (added.length > 0) {
      console.log(`\n${green("✓")} Added ${added.length} new variable(s):`);
      added.forEach((k) => console.log(`   + ${k}`));
    }

    if (removed.length > 0) {
      console.log(`\n🗑️  Removed ${removed.length} deprecated variable(s):`);
      removed.forEach((k) => console.log(`   - ${k}`));
    }

    const hasVariableChanges = added.length > 0 || removed.length > 0;

    if (!hasVariableChanges && !structureUpdated) {
      console.log("\n✨ .env is already in sync with .env.example");
      return;
    }

    console.log(`\n📝 Updated .env`);

    if (hasVariableChanges) {
      console.log(
        `   ${preserved.length} preserved, ${added.length} added, ${removed.length} removed`
      );
    } else if (structureUpdated) {
      console.log(
        dim("   Structure updated (comments, sections, annotations)")
      );
    }

    console.log("\n✨ Done!");
  } catch (error) {
    if (error instanceof Error) {
      console.error(`\n❌ ${error.message}`);
      if (error.message.includes(".env.example")) {
        console.error(dim("   Create a .env.example file first."));
      }
    }
    process.exit(1);
  }
}
