import type { StoredProspectPreviewSnapshot } from "../types";
import {
  buildCompositionDigest,
  buildCompositionFingerprint,
  type ProspectPreviewComposition,
} from "./types";

type ProspectPreviewFamily = ProspectPreviewComposition["family"];

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
      reason: "unsupported_sector" | "missing_experience_brief" | "no_unique_variant";
    };

const EXTRA_VARIANTS: readonly CompositionVariant[] = [
  {
    visualDirection: "precision-dark",
    heroTreatment: "ledger-grid",
    sectionOrder: [
      "hero",
      "proof",
      "case-for-change",
      "services",
      "journey",
      "owner-cta",
    ],
  },
  {
    visualDirection: "warm-editorial",
    heroTreatment: "workshop-geometry",
    sectionOrder: [
      "hero",
      "locality",
      "proof",
      "services",
      "journey",
      "owner-cta",
    ],
  },
  {
    visualDirection: "calm-architectural",
    heroTreatment: "crafted-table",
    sectionOrder: [
      "hero",
      "services",
      "case-for-change",
      "proof",
      "journey",
      "owner-cta",
    ],
  },
  {
    visualDirection: "local-service",
    heroTreatment: "property-frame",
    sectionOrder: [
      "hero",
      "proof",
      "locality",
      "services",
      "journey",
      "owner-cta",
    ],
  },
  {
    visualDirection: "considered-ledger",
    heroTreatment: "service-map",
    sectionOrder: [
      "hero",
      "services",
      "proof",
      "case-for-change",
      "journey",
      "owner-cta",
    ],
  },
  {
    visualDirection: "precision-dark",
    heroTreatment: "property-frame",
    sectionOrder: [
      "hero",
      "locality",
      "services",
      "case-for-change",
      "journey",
      "owner-cta",
    ],
  },
  {
    visualDirection: "warm-editorial",
    heroTreatment: "service-map",
    sectionOrder: [
      "hero",
      "proof",
      "services",
      "locality",
      "journey",
      "owner-cta",
    ],
  },
];

const FAMILY_VARIANTS: Record<
  ProspectPreviewFamily,
  readonly CompositionVariant[]
> = {
  automotive: [
    {
      visualDirection: "precision-dark",
      heroTreatment: "workshop-geometry",
      sectionOrder: [
        "hero",
        "proof",
        "services",
        "journey",
        "locality",
        "owner-cta",
      ],
    },
    {
      visualDirection: "calm-architectural",
      heroTreatment: "service-map",
      sectionOrder: [
        "hero",
        "services",
        "proof",
        "locality",
        "journey",
        "owner-cta",
      ],
    },
    {
      visualDirection: "local-service",
      heroTreatment: "local-silhouette",
      sectionOrder: [
        "hero",
        "locality",
        "proof",
        "services",
        "journey",
        "owner-cta",
      ],
    },
    ...EXTRA_VARIANTS,
  ],
  "property-trades": [
    {
      visualDirection: "local-service",
      heroTreatment: "service-map",
      sectionOrder: [
        "hero",
        "services",
        "journey",
        "proof",
        "locality",
        "owner-cta",
      ],
    },
    {
      visualDirection: "warm-editorial",
      heroTreatment: "crafted-table",
      sectionOrder: [
        "hero",
        "proof",
        "case-for-change",
        "journey",
        "locality",
        "owner-cta",
      ],
    },
    {
      visualDirection: "precision-dark",
      heroTreatment: "local-silhouette",
      sectionOrder: [
        "hero",
        "locality",
        "services",
        "proof",
        "journey",
        "owner-cta",
      ],
    },
    ...EXTRA_VARIANTS,
  ],
  hospitality: [
    {
      visualDirection: "warm-editorial",
      heroTreatment: "crafted-table",
      sectionOrder: [
        "hero",
        "proof",
        "services",
        "journey",
        "locality",
        "owner-cta",
      ],
    },
    {
      visualDirection: "calm-architectural",
      heroTreatment: "property-frame",
      sectionOrder: [
        "hero",
        "locality",
        "services",
        "proof",
        "journey",
        "owner-cta",
      ],
    },
    {
      visualDirection: "local-service",
      heroTreatment: "local-silhouette",
      sectionOrder: [
        "hero",
        "services",
        "journey",
        "proof",
        "locality",
        "owner-cta",
      ],
    },
    ...EXTRA_VARIANTS,
  ],
  property: [
    {
      visualDirection: "calm-architectural",
      heroTreatment: "property-frame",
      sectionOrder: [
        "hero",
        "locality",
        "proof",
        "journey",
        "services",
        "owner-cta",
      ],
    },
    {
      visualDirection: "considered-ledger",
      heroTreatment: "ledger-grid",
      sectionOrder: [
        "hero",
        "services",
        "case-for-change",
        "journey",
        "proof",
        "owner-cta",
      ],
    },
    {
      visualDirection: "warm-editorial",
      heroTreatment: "local-silhouette",
      sectionOrder: [
        "hero",
        "proof",
        "locality",
        "services",
        "journey",
        "owner-cta",
      ],
    },
    ...EXTRA_VARIANTS,
  ],
  "professional-services": [
    {
      visualDirection: "considered-ledger",
      heroTreatment: "ledger-grid",
      sectionOrder: [
        "hero",
        "proof",
        "case-for-change",
        "journey",
        "services",
        "owner-cta",
      ],
    },
    {
      visualDirection: "calm-architectural",
      heroTreatment: "property-frame",
      sectionOrder: [
        "hero",
        "services",
        "proof",
        "locality",
        "journey",
        "owner-cta",
      ],
    },
    {
      visualDirection: "precision-dark",
      heroTreatment: "local-silhouette",
      sectionOrder: [
        "hero",
        "locality",
        "case-for-change",
        "proof",
        "journey",
        "owner-cta",
      ],
    },
    ...EXTRA_VARIANTS,
  ],
};

function resolveProspectPreviewFamily(
  sector: string,
): ProspectPreviewFamily | null {
  const value = sector.toLocaleLowerCase("en-GB");

  if (/garage|mot|vehicle|automotive|car/.test(value)) return "automotive";
  if (/roof|plumb|heating|electrical|builder|repair|trade/.test(value)) {
    return "property-trades";
  }
  if (/cafe|restaurant|hospitality|beer|pub|food/.test(value)) {
    return "hospitality";
  }
  if (/estate|letting|property/.test(value)) return "property";
  if (
    /account|legal|law|consult|financial|professional|business services/.test(
      value,
    )
  ) {
    return "professional-services";
  }

  return null;
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
  return variants.map(
    (_, index) => variants[(start + index) % variants.length]!,
  );
}

function createComposition(
  input: CompileProspectPreviewCompositionInput,
  family: ProspectPreviewFamily,
  variant: CompositionVariant,
): ProspectPreviewComposition {
  if (input.snapshot.schemaVersion !== "1.1") {
    throw new TypeError("Evidence-backed preview composition requires schema version 1.1.");
  }

  const experienceBrief = input.snapshot.experienceBrief;
  const draft = {
    schemaVersion: "1.1" as const,
    prospectId: input.prospectId,
    slug: input.slug,
    family,
    visualDirection: variant.visualDirection,
    heroTreatment: variant.heroTreatment,
    sectionOrder: variant.sectionOrder,
    journey: {
      type: "evidence-backed" as const,
      ...experienceBrief.journey,
    },
    copy: {
      businessName: input.snapshot.businessName,
      locality: input.snapshot.locality,
      headline: experienceBrief.hero.statement,
      primaryCta: experienceBrief.journey.primaryCta,
    },
    content: {
      businessGoal: input.snapshot.businessGoal,
      homepageSections: input.snapshot.homepageSections,
      conversionPlan: input.snapshot.conversionPlan,
      trustSignals: input.snapshot.trustSignals,
    },
    hero: experienceBrief.hero,
    visual: experienceBrief.visual,
  };
  const digest = buildCompositionDigest(draft);
  return { ...draft, digest };
}

export function compileProspectPreviewComposition(
  input: CompileProspectPreviewCompositionInput,
): CompileProspectPreviewCompositionResult {
  const family = resolveProspectPreviewFamily(input.snapshot.sector);
  if (family === null)
    return { status: "unavailable", reason: "unsupported_sector" };
  if (input.snapshot.schemaVersion !== "1.1") {
    return { status: "unavailable", reason: "missing_experience_brief" };
  }

  for (const variant of orderedVariants(family, input.prospectId)) {
    const composition = createComposition(input, family, variant);
    if (
      !input.existingFingerprints.has(buildCompositionFingerprint(composition))
    ) {
      return { status: "compiled", composition };
    }
  }

  return { status: "unavailable", reason: "no_unique_variant" };
}
