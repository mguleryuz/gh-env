import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { parseEnvFile, getEnvVariables } from "./parser";

/**
 * Load .env file values as a map
 */
export function loadEnvValues(rootDir: string): Map<string, string> {
  const envPath = resolve(rootDir, ".env");

  if (!existsSync(envPath)) {
    return new Map();
  }

  const content = readFileSync(envPath, "utf-8");
  const parsed = parseEnvFile(content);
  return getEnvVariables(parsed.lines);
}

/**
 * Load .env file as a record (for pushing to GitHub)
 */
export function loadEnvRecord(rootDir: string): Record<string, string> {
  const envPath = resolve(rootDir, ".env");

  if (!existsSync(envPath)) {
    throw new Error(".env file not found");
  }

  const content = readFileSync(envPath, "utf-8");
  const env: Record<string, string> = {};

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && match[1]) {
      let value = match[2] || "";

      // Handle quoted values
      if (value.startsWith('"')) {
        const endQuote = value.indexOf('"', 1);
        if (endQuote > 0) value = value.slice(1, endQuote);
      } else if (value.startsWith("'")) {
        const endQuote = value.indexOf("'", 1);
        if (endQuote > 0) value = value.slice(1, endQuote);
      } else {
        // Remove inline comments
        const commentIndex = value.indexOf(" #");
        if (commentIndex > 0) value = value.slice(0, commentIndex);
        value = value.trim();
      }

      if (value) env[match[1]] = value;
    }
  }

  return env;
}

export interface SyncResult {
  added: string[];
  removed: string[];
  preserved: string[];
  structureUpdated: boolean;
}

/**
 * Sync .env with .env.example template
 * - Preserves existing values
 * - Adds new fields from template
 * - Removes deprecated fields not in template
 * - Updates structure (comments, annotations) from template
 */
export function syncEnvFile(rootDir: string): SyncResult {
  const examplePath = resolve(rootDir, ".env.example");
  const envPath = resolve(rootDir, ".env");

  if (!existsSync(examplePath)) {
    throw new Error(".env.example not found");
  }

  // Parse template
  const exampleContent = readFileSync(examplePath, "utf-8");
  const exampleParsed = parseEnvFile(exampleContent);
  const exampleVars = getEnvVariables(exampleParsed.lines);

  // Read existing .env content (if exists)
  let existingContent = "";
  let envVars = new Map<string, string>();
  if (existsSync(envPath)) {
    existingContent = readFileSync(envPath, "utf-8");
    const envParsed = parseEnvFile(existingContent);
    envVars = getEnvVariables(envParsed.lines);
  }

  // Calculate differences
  const added: string[] = [];
  const removed: string[] = [];
  const preserved: string[] = [];

  for (const key of exampleVars.keys()) {
    if (!envVars.has(key)) {
      added.push(key);
    } else {
      preserved.push(key);
    }
  }

  for (const key of envVars.keys()) {
    if (!exampleVars.has(key)) {
      removed.push(key);
    }
  }

  // Build new content using template structure but preserving existing values
  const outputLines: string[] = [];

  for (const line of exampleParsed.lines) {
    if (line.type === "variable" && line.key) {
      const existingValue = envVars.get(line.key);
      if (existingValue !== undefined) {
        outputLines.push(`${line.key}=${existingValue}`);
      } else {
        outputLines.push(line.raw);
      }
    } else {
      outputLines.push(line.raw);
    }
  }

  const newContent = outputLines.join("\n");

  // Check if structure changed (comments, annotations, order)
  const structureUpdated = existingContent !== newContent;

  // Write updated .env
  writeFileSync(envPath, newContent);

  return { added, removed, preserved, structureUpdated };
}

/**
 * Update a single variable in .env file
 */
export function updateEnvVariable(
  rootDir: string,
  key: string,
  value: string
): void {
  const envPath = resolve(rootDir, ".env");
  let content = existsSync(envPath) ? readFileSync(envPath, "utf-8") : "";

  const escapedValue =
    value.includes(" ") || value.includes('"')
      ? `"${value.replace(/"/g, '\\"')}"`
      : value;
  const newLine = `${key}=${escapedValue}`;

  const regex = new RegExp(`^${key}=.*$`, "m");
  if (regex.test(content)) {
    content = content.replace(regex, newLine);
  } else {
    content += (content.endsWith("\n") ? "" : "\n") + newLine + "\n";
  }

  writeFileSync(envPath, content);
}
