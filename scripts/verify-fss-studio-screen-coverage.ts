import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  parseCoverageCsv,
  type ScreenCoverageViolation,
  type ScreenManifestEntry,
  validateScreenCoverage,
} from "../lib/operations/design/screen-coverage";

const designDirectory = "docs/design/fss-studio-experience";
const expectedScreenCount = 88;

export async function verifyFssStudioScreenCoverage(
  repositoryRoot: string,
): Promise<ScreenCoverageViolation[]> {
  const sourceDirectory = join(repositoryRoot, designDirectory);
  const [manifestSource, coverageSource] = await Promise.all([
    readFile(join(sourceDirectory, "screen-manifest.json"), "utf8"),
    readFile(join(sourceDirectory, "screen-coverage.csv"), "utf8"),
  ]);

  const manifest = parseScreenManifest(manifestSource);
  const violations = validateScreenCoverage(manifest, parseCoverageCsv(coverageSource));

  if (manifest.length !== expectedScreenCount) {
    violations.unshift(
      `FSS Studio screen manifest must contain ${expectedScreenCount} screens.`,
    );
  }

  return violations;
}

function parseScreenManifest(source: string): ScreenManifestEntry[] {
  let value: unknown;

  try {
    value = JSON.parse(source);
  } catch {
    throw new Error("FSS Studio screen manifest is invalid.");
  }

  if (!Array.isArray(value)) {
    throw new Error("FSS Studio screen manifest is invalid.");
  }

  return value.map((entry) => toScreenManifestEntry(entry));
}

function toScreenManifestEntry(value: unknown): ScreenManifestEntry {
  if (!isRecord(value)) {
    throw new Error("FSS Studio screen manifest is invalid.");
  }

  const route = optionalString(value.route);

  return {
    id: requiredString(value.id),
    role: requiredString(value.role),
    nav: requiredString(value.nav),
    title: requiredString(value.title),
    primary: nullableString(value.primary),
    ...(route === undefined ? {} : { route }),
  };
}

function requiredString(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("FSS Studio screen manifest is invalid.");
  }

  return value;
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return requiredString(value);
}

function nullableString(value: unknown): string | null {
  if (value === null) {
    return null;
  }

  return requiredString(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function main(): Promise<void> {
  try {
    const violations = await verifyFssStudioScreenCoverage(process.cwd());

    if (violations.length > 0) {
      for (const violation of violations) {
        console.error(`- ${violation}`);
      }

      process.exitCode = 1;
      return;
    }

    console.log("FSS Studio screen coverage verified: 88 screens.");
  } catch {
    console.error("FSS Studio screen coverage verification failed.");
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}
