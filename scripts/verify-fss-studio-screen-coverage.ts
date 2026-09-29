import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import {
  parseCoverageCsv,
  type ScreenCoverageViolation,
  type ScreenManifestEntry,
  validateScreenCoverage,
} from "../lib/operations/design/screen-coverage";

const designDirectory = "docs/design/fss-studio-experience";
const expectedScreenCount = 95;
const portalRouteAliases = new Map([["/portal/team", "/portal/settings/team"]]);

export async function verifyFssStudioScreenCoverage(
  repositoryRoot: string,
): Promise<ScreenCoverageViolation[]> {
  const sourceDirectory = join(repositoryRoot, designDirectory);
  const [manifestSource, coverageSource] = await Promise.all([
    readFile(join(sourceDirectory, "screen-manifest.json"), "utf8"),
    readFile(join(sourceDirectory, "screen-coverage.csv"), "utf8"),
  ]);

  const manifest = parseScreenManifest(manifestSource);
  const coverage = parseCoverageCsv(coverageSource);
  const violations = validateScreenCoverage(manifest, coverage);

  if (manifest.length !== expectedScreenCount) {
    violations.unshift(
      `FSS Studio screen manifest must contain ${expectedScreenCount} screens.`,
    );
  }

  if (manifest.length === expectedScreenCount) {
    const portalRoot = join(repositoryRoot, "app/(portal)");
    const pagePaths = await readPortalPagePaths(portalRoot, portalRoot);
    violations.push(
      ...findUncoveredPortalRoutes(
        pagePaths,
        coverage.map((row) => row.route),
      ),
    );
  }

  return violations;
}

export function findUncoveredPortalRoutes(
  pagePaths: readonly string[],
  coveredRoutes: readonly string[],
): ScreenCoverageViolation[] {
  const covered = new Set(coveredRoutes.map(normalizeRoute));

  return pagePaths
    .map((route) => normalizeRoute(route))
    .filter((route) => {
      const target = portalRouteAliases.get(route);
      return !covered.has(route) && !(target && covered.has(target));
    })
    .map((route) => `Active portal route ${route} has no screen coverage row.`);
}

async function readPortalPagePaths(
  directory: string,
  portalRoot: string,
): Promise<string[]> {
  let entries;

  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (isMissingDirectory(error)) return [];
    throw error;
  }

  const routes = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);

      if (entry.isDirectory()) return readPortalPagePaths(path, portalRoot);
      if (entry.name !== "page.tsx") return [];

      const relativePath = relative(portalRoot, path)
        .split(sep)
        .slice(0, -1)
        .join("/");
      const segments = relativePath
        .split("/")
        .filter((segment) => !/^\(.*\)$/.test(segment))
        .map((segment) => {
          const parameter = /^\[(.+)\]$/.exec(segment);
          return parameter ? `:${parameter[1]}` : segment;
        });

      return [`/${segments.join("/")}`.replace(/\/$/, "") || "/"];
    }),
  );

  return routes.flat();
}

function normalizeRoute(route: string): string {
  return (
    route
      .split("?", 1)[0]
      .replace(/:[^/]+/g, ":parameter")
      .replace(/\/$/, "") || "/"
  );
}

function isMissingDirectory(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
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

    console.log(
      "FSS Studio screen coverage verified: 95 screens and active portal routes.",
    );
  } catch {
    console.error("FSS Studio screen coverage verification failed.");
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}
