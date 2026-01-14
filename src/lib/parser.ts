import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

export interface EnvLine {
  type: "comment" | "empty" | "variable" | "section";
  raw: string;
  key?: string;
  value?: string;
  section?: string;
  isSecretSection?: boolean;
  isVariableSection?: boolean;
}

export interface SectionInfo {
  isSecret: boolean;
  isVariable: boolean;
  variables: string[];
}

export interface ParsedEnv {
  secrets: string[];
  variables: string[];
  untagged: string[]; // Variables in sections without @secrets or @variables
  lines: EnvLine[];
  sections: Map<string, SectionInfo>;
}

/**
 * Detect if a line is a section header
 * Matches patterns like:
 * - # === SECTION NAME ===          (inline with = decorators)
 * - # SECTION NAME                  (standalone, ALL CAPS)
 * - # SECTION NAME (description)    (with parenthetical note)
 * - # SECTION NAME @secrets         (with annotation)
 *
 * NOTE: --- sub-headers are NOT treated as sections (they're just comments)
 * This prevents "# --- Database ---" from resetting @secrets flags
 *
 * Also detects @secrets and @variables annotations
 */
function parseSectionHeader(
  line: string
): { name: string; isSecret: boolean; isVariable: boolean } | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("#")) return null;

  // Check for annotations
  const isSecret = /@secrets\b/i.test(trimmed);
  const isVariable = /@variables\b/i.test(trimmed);

  // Remove # and any annotations
  let content = trimmed
    .replace(/^#\s*/, "")
    .replace(/@secrets\b/gi, "")
    .replace(/@variables\b/gi, "")
    .trim();

  // Skip pure decorator lines (just === or ---)
  if (/^[=\-─]+$/.test(content)) {
    return null;
  }

  // Skip --- sub-headers (e.g., "# --- Database ---")
  // These are NOT sections, just visual separators within a section
  if (/^-{2,}\s*.+?\s*-{0,}$/.test(content)) {
    return null;
  }

  // Pattern 1: Inline with === decorators - === TITLE === (NOT ---)
  const inlineMatch = content.match(/^={2,}\s*(.+?)\s*=*$/);
  if (inlineMatch && inlineMatch[1]) {
    const name = inlineMatch[1].replace(/[=]/g, "").trim();
    if (name.length > 0) {
      return { name, isSecret, isVariable };
    }
  }

  // Pattern 2: Standalone section title - must be mostly UPPERCASE
  // Matches: "SECTION NAME" or "SECTION NAME (description)"
  // Remove parenthetical descriptions for the uppercase check
  const withoutParens = content.replace(/\s*\([^)]*\)\s*$/, "").trim();

  // Check if it's mostly uppercase (allowing spaces, &, numbers)
  // Must have at least 2 uppercase letters and be predominantly uppercase
  const uppercaseLetters = (withoutParens.match(/[A-Z]/g) || []).length;
  const lowercaseLetters = (withoutParens.match(/[a-z]/g) || []).length;

  if (uppercaseLetters >= 2 && uppercaseLetters > lowercaseLetters) {
    // Extract just the title part (without parenthetical description)
    return { name: withoutParens, isSecret, isVariable };
  }

  return null;
}

/**
 * Parse a single line from an env file
 */
function parseLine(
  line: string,
  currentSection: string | null,
  isSecretSection: boolean
): EnvLine {
  const trimmed = line.trim();

  // Empty line
  if (trimmed === "") {
    return { type: "empty", raw: line };
  }

  // Check for section header
  const sectionHeader = parseSectionHeader(line);
  if (sectionHeader) {
    return {
      type: "section",
      raw: line,
      section: sectionHeader.name,
      isSecretSection: sectionHeader.isSecret,
      isVariableSection: sectionHeader.isVariable,
    };
  }

  // Comment line (starts with #)
  if (trimmed.startsWith("#")) {
    return { type: "comment", raw: line };
  }

  // Variable line (KEY=value or KEY="value")
  const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (match) {
    return {
      type: "variable",
      raw: line,
      key: match[1],
      value: match[2],
      section: currentSection ?? undefined,
      isSecretSection,
    };
  }

  // Continuation of previous line or malformed - treat as comment
  return { type: "comment", raw: line };
}

/**
 * Parse an env file and extract structured data
 */
export function parseEnvFile(content: string): ParsedEnv {
  const lines: EnvLine[] = [];
  const secrets: string[] = [];
  const variables: string[] = [];
  const untagged: string[] = [];
  const sections = new Map<string, SectionInfo>();

  let currentSection: string | null = null;
  let isSecretSection = false;
  let isVariableSection = false;

  for (const rawLine of content.split("\n")) {
    const line = parseLine(rawLine, currentSection, isSecretSection);
    lines.push(line);

    if (line.type === "section" && line.section) {
      currentSection = line.section;
      isSecretSection = line.isSecretSection ?? false;
      isVariableSection = line.isVariableSection ?? false;
      sections.set(currentSection, {
        isSecret: isSecretSection,
        isVariable: isVariableSection,
        variables: [],
      });
    } else if (line.type === "variable" && line.key) {
      if (isSecretSection) {
        secrets.push(line.key);
      } else if (isVariableSection) {
        variables.push(line.key);
      } else {
        // No tag - track separately
        untagged.push(line.key);
      }

      // Add to section tracking
      if (currentSection) {
        const sectionData = sections.get(currentSection);
        if (sectionData) {
          sectionData.variables.push(line.key);
        }
      }
    }
  }

  return { secrets, variables, untagged, lines, sections };
}

/**
 * Load and parse .env.example from a directory
 */
export function loadEnvExample(rootDir: string): ParsedEnv {
  const examplePath = resolve(rootDir, ".env.example");

  if (!existsSync(examplePath)) {
    throw new Error(".env.example not found");
  }

  const content = readFileSync(examplePath, "utf-8");
  return parseEnvFile(content);
}

/**
 * Get a map of variable names to their values from .env
 */
export function getEnvVariables(lines: EnvLine[]): Map<string, string> {
  const vars = new Map<string, string>();
  for (const line of lines) {
    if (line.type === "variable" && line.key) {
      vars.set(line.key, line.value ?? "");
    }
  }
  return vars;
}

/**
 * Check if .env.example exists
 */
export function envExampleExists(rootDir: string): boolean {
  return existsSync(resolve(rootDir, ".env.example"));
}

/**
 * Check if .env.example has any @secrets or @variables annotations
 */
export function hasAnnotations(rootDir: string): {
  hasSecrets: boolean;
  hasVariables: boolean;
} {
  const examplePath = resolve(rootDir, ".env.example");
  if (!existsSync(examplePath))
    return { hasSecrets: false, hasVariables: false };

  const content = readFileSync(examplePath, "utf-8");
  return {
    hasSecrets: /@secrets\b/i.test(content),
    hasVariables: /@variables\b/i.test(content),
  };
}

/**
 * Get sections from .env.example that could be marked as secrets
 */
export function getSectionNames(rootDir: string): string[] {
  const examplePath = resolve(rootDir, ".env.example");
  if (!existsSync(examplePath)) return [];

  const content = readFileSync(examplePath, "utf-8");
  const parsed = parseEnvFile(content);
  return Array.from(parsed.sections.keys());
}

const ENV_EXAMPLE_TEMPLATE = `# =============================================================================
# Application Configuration
# =============================================================================
# Copy to .env and fill in your values
#
# Use annotations on section headers:
#   @secrets   → pushed as GitHub Secrets (hidden in logs)
#   @variables → pushed as GitHub Variables (visible in logs)

# =============================================================================
# SECRETS @secrets
# =============================================================================

API_KEY=""
DATABASE_URL=""

# =============================================================================
# VARIABLES @variables
# =============================================================================

APP_NAME="My App"
LOG_LEVEL="info"
DEBUG="false"
`;

/**
 * Create a template .env.example file
 */
export function createEnvExampleTemplate(rootDir: string): void {
  const examplePath = resolve(rootDir, ".env.example");
  writeFileSync(examplePath, ENV_EXAMPLE_TEMPLATE);
}

export interface EnvExampleStatus {
  exists: boolean;
  hasSecrets: boolean;
  hasVariables: boolean;
  hasAnyAnnotation: boolean;
  sections: string[];
  untaggedCount: number;
}

/**
 * Check the status of .env.example
 */
export function checkEnvExample(rootDir: string): EnvExampleStatus {
  const exists = envExampleExists(rootDir);
  if (!exists) {
    return {
      exists: false,
      hasSecrets: false,
      hasVariables: false,
      hasAnyAnnotation: false,
      sections: [],
      untaggedCount: 0,
    };
  }

  const annotations = hasAnnotations(rootDir);
  const parsed = loadEnvExample(rootDir);

  return {
    exists: true,
    hasSecrets: annotations.hasSecrets,
    hasVariables: annotations.hasVariables,
    hasAnyAnnotation: annotations.hasSecrets || annotations.hasVariables,
    sections: Array.from(parsed.sections.keys()),
    untaggedCount: parsed.untagged.length,
  };
}
