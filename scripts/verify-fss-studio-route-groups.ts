import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const commonLayoutPath = "app/(portal)/layout.tsx";
const legacyLayoutPath = "app/(portal)/portal/layout.tsx";
const requiredPersonaLayouts = [
  ["authentication", "app/(portal)/(auth)/portal/layout.tsx"],
  ["client", "app/(portal)/(client)/portal/layout.tsx"],
  ["Studio", "app/(portal)/(studio)/portal/admin/layout.tsx"],
] as const;

export function verifyPortalRouteGroups(repositoryRoot: string): string[] {
  const violations: string[] = [];
  const commonLayout = join(repositoryRoot, commonLayoutPath);

  if (existsSync(join(repositoryRoot, legacyLayoutPath))) {
    violations.push("Legacy portal layout must not exist.");
  }

  if (!existsSync(commonLayout)) {
    violations.push("Common portal provider layout is missing.");
  } else {
    verifyCommonLayout(readFileSync(commonLayout, "utf8"), violations);
  }

  for (const [persona, layoutPath] of requiredPersonaLayouts) {
    if (!existsSync(join(repositoryRoot, layoutPath))) {
      violations.push(`${persona} portal layout is missing.`);
    }
  }

  return violations;
}

function verifyCommonLayout(source: string, violations: string[]): void {
  if (!source.includes("ClerkProvider")) {
    violations.push("Common portal provider layout must include ClerkProvider.");
  }

  if (
    source.includes("components/portal/auth/portal.module.css") ||
    source.includes("styles.shell") ||
    source.includes("ClientShell") ||
    source.includes("StudioShell")
  ) {
    violations.push(
      "Common portal provider layout must not include a client or Studio shell.",
    );
  }
}

function main(): void {
  const violations = verifyPortalRouteGroups(process.cwd());

  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }

    process.exitCode = 1;
    return;
  }

  console.log("FSS Studio portal route groups verified.");
}

if (require.main === module) {
  main();
}
