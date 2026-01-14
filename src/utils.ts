// ANSI colors
export const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
export const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
export const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
export const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
export const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
export const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

export function truncate(s: string, len: number): string {
  return s.length > len ? s.slice(0, len - 1) + "…" : s;
}

export function printHeader(): void {
  console.log();
  console.log(bold(cyan("  ┌─────────────────────────────────────┐")));
  console.log(bold(cyan("  │       ghvars · Environment CLI     │")));
  console.log(bold(cyan("  └─────────────────────────────────────┘")));
  console.log();
}

// Graceful exit handler - catches Ctrl+C during prompts
export function isExitError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "ExitPromptError" || error.message.includes("force closed"))
  );
}

export function handleExit(error: unknown): never {
  if (isExitError(error)) {
    console.log("\n");
    process.exit(0);
  }
  throw error;
}
