import type { StoredProspectPreviewSnapshot } from "../types";
import {
  buildCompositionDigest,
  buildCompositionFingerprint,
  type ProspectPreviewComposition,
} from "./types";

type ProspectPreviewFamily = ProspectPreviewComposition["family"];
type ProspectPreviewJourney = ProspectPreviewComposition["journey"];

type CompositionVariant = Pick<
  ProspectPreviewComposition,
  "visualDirection" | "heroTreatment" | "sectionOrder"
>;

export type CompileProspectPreviewCompositionInput = {
  prospectId: string;
  slug: string;
  snapshot: StoredProspectPreviewSnapshot;
  existingFingerprints: ReadonlySet<string>;
};

export type CompileProspectPreviewCompositionResult =
  | { status: "compiled"; composition: ProspectPreviewComposition }
  | {
      status: "unavailable";
      reason: "unsupported_sector" | "no_unique_variant";
    };

const FAMILY_VARIANTS: Record<
  ProspectPreviewFamily,
  readonly CompositionVariant[]
> = {
  automotive: [
    {
      visualDirection: "precision-dark",
      heroTreatment: "workshop-geometry",
      sectionOrder: ["hero", "proof", "services", "journey", "locality", "owner-cta"],
    },
    {
      visualDirection: "calm-architectural",
      heroTreatment: "service-map",
      sectionOrder: ["hero", "services", "proof", "locality", "journey", "owner-cta"],
    },
    {
      visualDirection: "local-service",
      heroTreatment: "local-silhouette",
      sectionOrder: ["hero", "locality", "proof", "services", "journey", "owner-cta"],
    },
  ],
  "property-trades": [
    {
      visualDirection: "local-service",
      heroTreatment: "service-map",
      sectionOrder: ["hero", "services", "journey", "proof", "locality", "owner-cta"],
    },
    {
      visualDirection: "warm-editorial",
      heroTreatment: "crafted-table",
      sectionOrder: ["hero", "proof", "case-for-change", "journey", "locality", "owner-cta"],
    },
    {
      visualDirection: "precision-dark",
      heroTreatment: "local-silhouette",
      sectionOrder: ["hero", "locality", "services", "proof", "journey", "owner-cta"],
    },
  ],
  hospitality: [
    {
      visualDirection: "warm-editorial",
      heroTreatment: "crafted-table",
      sectionOrder: ["hero", "proof", "services", "journey", "locality", "owner-cta"],
    },
    {
      visualDirection: "calm-architectural",
      heroTreatment: "property-frame",
      sectionOrder: ["hero", "locality", "services", "proof", "journey", "owner-cta"],
    },
    {
      visualDirection: "local-service",
      heroTreatment: "local-silhouette",
      sectionOrder: ["hero", "services", "journey", "proof", "locality", "owner-cta"],
    },
  ],
  property: [
    {
      visualDirection: "calm-architectural",
      heroTreatment: "property-frame",
      sectionOrder: ["hero", "locality", "proof", "journey", "services", "owner-cta"],
    },
    {
      visualDirection: "considered-ledger",
      heroTreatment: "ledger-grid",
      sectionOrder: ["hero", "services", "case-for-change", "journey", "proof", "owner-cta"],
    },
    {
      visualDirection: "warm-editorial",
      heroTreatment: "local-silhouette",
      sectionOrder: ["hero", "proof", "locality", "services", "journey", "owner-cta"],
    },
  ],
  "professional-services": [
    {
      visualDirection: "considered-ledger",
      heroTreatment: "ledger-grid",
      sectionOrder: ["hero", "proof", "case-for-change", "journey", "services", "owner-cta"],
    },
    {
      visualDirection: "calm-architectural",
      heroTreatment: "property-frame",
      sectionOrder: ["hero", "services", "proof", "locality", "journey", "owner-cta"],
    },
    {
      visualDirection: "precision-dark",
      heroTreatment: "local-silhouette",
      sectionOrder: ["hero", "locality", "case-for-change", "proof", "journey", "owner-cta"],
    },
  ],
};

function resolveProspectPreviewFamily(sector: string): ProspectPreviewFamily | null {
  const value = sector.toLocaleLowerCase("en-GB");

  if (/garage|mot|vehicle|automotive|car/.test(value)) return "automotive";
  if (/roof|plumb|heating|electrical|builder|repair|trade/.test(value)) {
    return "property-trades";
  }
  if (/cafe|restaurant|hospitality|beer|pub|food/.test(value)) {
    return "hospitality";
  }
  if (/estate|letting|property/.test(value)) return "property";
  if (/account|legal|law|consult|financial/.test(value)) {
    return "professional-services";
  }

  return null;
}

function journeyForFamily(family: ProspectPreviewFamily): ProspectPreviewJourney {
  switch (family) {
    case "automotive":
      return {
        type: "mot-request",
        completionMessage: "Your preferred time is ready for a follow-up.",
      };
    case "property-trades":
      return {
        type: "quote-request",
        completionMessage: "Your request is ready for a practical follow-up.",
      };
    case "hospitality":
      return {
        type: "table-enquiry",
        completionMessage: "Your table enquiry is ready for a considered reply.",
      };
    case "property":
      return {
        type: "valuation-request",
        completionMessage: "Your property enquiry is ready for a local follow-up.",
      };
    case "professional-services":
      return {
        type: "consultation-request",
        completionMessage: "Your consultation request is ready for a clear next step.",
      };
  }
}

function headlineForFamily(
  family: ProspectPreviewFamily,
  locality: string,
): string {
  switch (family) {
    case "automotive":
      return `Vehicle care made easier to book in ${locality}.`;
    case "property-trades":
      return `A clearer route to practical help in ${locality}.`;
    case "hospitality":
      return `A more considered first welcome in ${locality}.`;
    case "property":
      return `A clearer start for property decisions in ${locality}.`;
    case "professional-services":
      return `Professional advice with a clearer first step in ${locality}.`;
  }
}

function orderedVariants(
  family: ProspectPreviewFamily,
  prospectId: string,
): readonly CompositionVariant[] {
  const variants = FAMILY_VARIANTS[family];
  const seed = Array.from(prospectId).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
  const start = seed % variants.length;
  return variants.map((_, index) => variants[(start + index) % variants.length]!);
}

function createComposition(
  input: CompileProspectPreviewCompositionInput,
  family: ProspectPreviewFamily,
  variant: CompositionVariant,
): ProspectPreviewComposition {
  const draft = {
    schemaVersion: "1.0" as const,
    prospectId: input.prospectId,
    slug: input.slug,
    family,
    visualDirection: variant.visualDirection,
    heroTreatment: variant.heroTreatment,
    sectionOrder: variant.sectionOrder,
    journey: journeyForFamily(family),
    copy: {
      businessName: input.snapshot.businessName,
      locality: input.snapshot.locality,
      headline: headlineForFamily(family, input.snapshot.locality),
      primaryCta: input.snapshot.primaryCta,
    },
    content: {
      businessGoal: input.snapshot.businessGoal,
      homepageSections: input.snapshot.homepageSections,
      conversionPlan: input.snapshot.conversionPlan,
      trustSignals: input.snapshot.trustSignals,
    },
  };
  const digest = buildCompositionDigest(draft);
  return { ...draft, digest };
}

export function compileProspectPreviewComposition(
  input: CompileProspectPreviewCompositionInput,
): CompileProspectPreviewCompositionResult {
  const family = resolveProspectPreviewFamily(input.snapshot.sector);
  if (family === null) return { status: "unavailable", reason: "unsupported_sector" };

  for (const variant of orderedVariants(family, input.prospectId)) {
    const composition = createComposition(input, family, variant);
    if (!input.existingFingerprints.has(buildCompositionFingerprint(composition))) {
      return { status: "compiled", composition };
    }
  }

  return { status: "unavailable", reason: "no_unique_variant" };
}
