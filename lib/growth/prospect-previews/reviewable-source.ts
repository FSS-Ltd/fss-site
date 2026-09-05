import { createHash } from "node:crypto";

import { getMergedProspectPreviewCompositionByProspectId } from "./compositions/manifest";

const PROSPECT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type BespokePreviewSourceDefinition = {
  slug: string;
  sourceRevision: string;
  websiteHost: string;
};

export type ReviewableProspectPreviewSource = {
  digest: string;
  kind: "bespoke" | "composition";
  slug: string;
};

export type ReviewableBespokePreviewSource = ReviewableProspectPreviewSource & {
  kind: "bespoke";
  websiteHost: string;
};

const bespokePreviewSourceDefinitions = [
  {
    slug: "acckent-accountants",
    sourceRevision: "2026-09-05-v1",
    websiteHost: "acckent.com",
  },
  {
    slug: "legrys",
    sourceRevision: "2026-09-05-v1",
    websiteHost: "legrys.com",
  },
  {
    slug: "hosty-lets",
    sourceRevision: "2026-09-05-v1",
    websiteHost: "hostylets.co.uk",
  },
  {
    slug: "ete-electrical",
    sourceRevision: "2026-09-05-v1",
    websiteHost: "eteelectric.co.uk",
  },
  {
    slug: "jenkinson-estates",
    sourceRevision: "2026-09-05-v1",
    websiteHost: "jenkinsonestates.co.uk",
  },
  {
    slug: "th-electrical",
    sourceRevision: "2026-09-05-v1",
    websiteHost: "th-electrical.co.uk",
  },
] as const satisfies readonly BespokePreviewSourceDefinition[];

function buildBespokePreviewSourceDigest(
  source: BespokePreviewSourceDefinition,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        kind: "bespoke",
        slug: source.slug,
        sourceRevision: source.sourceRevision,
      }),
    )
    .digest("hex");
}

const reviewableBespokePreviewSources = bespokePreviewSourceDefinitions.map(
  (source) => ({
    digest: buildBespokePreviewSourceDigest(source),
    kind: "bespoke" as const,
    slug: source.slug,
    websiteHost: source.websiteHost,
  }),
);

export function getReviewableBespokePreviewSources(): readonly ReviewableBespokePreviewSource[] {
  return reviewableBespokePreviewSources;
}

export function getReviewableBespokePreviewSourceBySlug(
  slug: string,
): ReviewableBespokePreviewSource | null {
  return (
    reviewableBespokePreviewSources.find((source) => source.slug === slug) ??
    null
  );
}

type CompositionSource = Pick<
  NonNullable<
    ReturnType<typeof getMergedProspectPreviewCompositionByProspectId>
  >,
  "digest" | "prospectId" | "slug"
>;

export function resolveReviewableProspectPreviewSource(input: {
  digest: string | null;
  prospectId: string;
  slug: string | null;
  resolveComposition?: (prospectId: string) => CompositionSource | null;
}): ReviewableProspectPreviewSource | null {
  if (
    !PROSPECT_ID_PATTERN.test(input.prospectId) ||
    input.slug === null ||
    input.digest === null
  ) {
    return null;
  }

  const composition = (
    input.resolveComposition ?? getMergedProspectPreviewCompositionByProspectId
  )(input.prospectId);
  if (
    composition !== null &&
    composition.prospectId === input.prospectId &&
    composition.slug === input.slug &&
    composition.digest === input.digest
  ) {
    return {
      kind: "composition",
      slug: composition.slug,
      digest: composition.digest,
    };
  }

  const bespokeSource = getReviewableBespokePreviewSourceBySlug(input.slug);
  return bespokeSource?.digest === input.digest ? bespokeSource : null;
}
