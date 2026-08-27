import {
  compileProspectPreviewComposition,
  type CompileProspectPreviewCompositionResult,
} from "../compositions/compiler";
import {
  buildCompositionFingerprint,
  type ProspectPreviewComposition,
} from "../compositions/types";
import {
  getCompositionExportName,
  serializeGeneratedComposition,
} from "../compositions/serialize";
import type { PreviewGenerationCandidate } from "../composition-repository";

export type GeneratedPreviewFile = {
  path: string;
  content: string;
};

export type GeneratedPreviewPackage = {
  previewId: string;
  prospectId: string;
  slug: string;
  composition: ProspectPreviewComposition;
};

export type UnavailablePreviewPackage = {
  previewId: string;
  prospectId: string;
  reason: Extract<
    CompileProspectPreviewCompositionResult,
    { status: "unavailable" }
  >["reason"];
};

export type GeneratedPreviewFiles = {
  packages: readonly GeneratedPreviewPackage[];
  unavailable: readonly UnavailablePreviewPackage[];
  files: readonly GeneratedPreviewFile[];
};

const GENERATED_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugifyBusinessName(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-GB")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "prospect";
}

function assignSlugs(
  candidates: readonly PreviewGenerationCandidate[],
): ReadonlyMap<string, string> {
  const used = new Set<string>();
  const slugs = new Map<string, string>();

  for (const candidate of [...candidates].sort((left, right) =>
    left.prospectId.localeCompare(right.prospectId),
  )) {
    const base = slugifyBusinessName(candidate.snapshot.businessName);
    let slug = base;
    if (used.has(slug)) {
      slug = `${base}-${candidate.prospectId.slice(0, 8)}`;
    }
    used.add(slug);
    slugs.set(candidate.prospectId, slug);
  }

  return slugs;
}

export function serializeGeneratedPreviewManifest(
  slugs: readonly string[],
): string {
  const uniqueSlugs = [...new Set(slugs)].sort((left, right) =>
    left.localeCompare(right),
  );
  if (!uniqueSlugs.every((slug) => GENERATED_SLUG_PATTERN.test(slug))) {
    throw new TypeError("Generated prospect preview manifest slug is invalid.");
  }

  const imports = uniqueSlugs.map(
    (slug) =>
      `import { ${getCompositionExportName(slug)} } from "./generated/${slug}";`,
  );
  const values = uniqueSlugs
    .map((slug) => `  ${getCompositionExportName(slug)},`)
    .join("\n");
  const manifestValues = values ? `[\n${values}\n]` : "[]";

  return [
    'import { createProspectPreviewCompositionManifest } from "./manifest-core";',
    'import type { ProspectPreviewComposition } from "./types";',
    ...imports,
    "",
    'export { createProspectPreviewCompositionManifest } from "./manifest-core";',
    "",
    `const mergedProspectPreviewManifest = createProspectPreviewCompositionManifest(${manifestValues});`,
    "",
    "export function getMergedProspectPreviewCompositionBySlug(slug: string): ProspectPreviewComposition | null {",
    "  return mergedProspectPreviewManifest.getBySlug(slug);",
    "}",
    "",
    "export function getMergedProspectPreviewCompositionByProspectId(prospectId: string): ProspectPreviewComposition | null {",
    "  return mergedProspectPreviewManifest.getByProspectId(prospectId);",
    "}",
    "",
  ].join("\n");
}

export function buildGeneratedPreviewFiles(
  candidates: readonly PreviewGenerationCandidate[],
): GeneratedPreviewFiles {
  const slugs = assignSlugs(candidates);
  const fingerprints = new Set<string>();
  const packages: GeneratedPreviewPackage[] = [];
  const unavailable: UnavailablePreviewPackage[] = [];

  for (const candidate of [...candidates].sort((left, right) => {
    const leftSlug = slugs.get(left.prospectId) ?? "";
    const rightSlug = slugs.get(right.prospectId) ?? "";
    return leftSlug.localeCompare(rightSlug);
  })) {
    const slug = slugs.get(candidate.prospectId);
    if (!slug) throw new TypeError("Preview composition slug is missing.");

    const result = compileProspectPreviewComposition({
      prospectId: candidate.prospectId,
      slug,
      snapshot: candidate.snapshot,
      existingFingerprints: fingerprints,
    });
    if (result.status === "unavailable") {
      unavailable.push({
        previewId: candidate.previewId,
        prospectId: candidate.prospectId,
        reason: result.reason,
      });
      continue;
    }

    fingerprints.add(buildCompositionFingerprint(result.composition));
    packages.push({
      previewId: candidate.previewId,
      prospectId: candidate.prospectId,
      slug,
      composition: result.composition,
    });
  }

  const files = [
    ...packages.map(({ slug, composition }) => ({
      path: `lib/growth/prospect-previews/compositions/generated/${slug}.ts`,
      content: serializeGeneratedComposition(composition),
    })),
    {
      path: "lib/growth/prospect-previews/compositions/manifest.ts",
      content: serializeGeneratedPreviewManifest(
        packages.map(({ slug }) => slug),
      ),
    },
  ];

  return { packages, unavailable, files };
}
