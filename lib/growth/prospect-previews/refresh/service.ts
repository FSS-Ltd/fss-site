import { z } from "zod";

import {
  experienceBriefSchema,
  type ExperienceBrief,
} from "../experience-brief";
import type { StoredProspectPreviewSnapshot } from "../types";

const URL_PATTERN = /^https?:\/\//;
const GOOGLE_MAPS_HOSTS = new Set(["maps.google.com", "maps.app.goo.gl"]);

const brandEvidenceSchema = z
  .object({
    id: z.string().uuid(),
    kind: z.enum(["logo", "brand-colours", "service-language", "on-site-image"]),
    sourceUrl: z.string().url().max(2048).refine((value) => URL_PATTERN.test(value)),
    evidenceText: z.string().trim().min(1).max(2000),
    observedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

const previewRefreshInputSchema = z
  .object({
    prospectId: z.string().uuid(),
    brandEvidence: z.array(brandEvidenceSchema).min(2).max(16),
    experienceBrief: experienceBriefSchema,
  })
  .strict();

export type ProspectPreviewRefreshInput = z.infer<
  typeof previewRefreshInputSchema
>;

export type RefreshableProspectPreview = {
  status: "draft" | "published" | "withdrawn";
  generationStatus:
    | "pending_pr"
    | "pr_open"
    | "merged_draft"
    | "composition_unavailable"
    | "published"
    | "withdrawn";
  firstPartySourceUrl: string;
  snapshot: StoredProspectPreviewSnapshot;
};

export type ReplaceDraftPreviewInput = {
  prospectId: string;
  snapshot: StoredProspectPreviewSnapshot;
  experienceBrief: ExperienceBrief;
  brandEvidence: readonly ProspectPreviewRefreshInput["brandEvidence"][number][];
};

export type ProspectPreviewRefreshTransaction = {
  loadPreview: (prospectId: string) => Promise<RefreshableProspectPreview | null>;
  replaceDraftPreview: (input: ReplaceDraftPreviewInput) => Promise<boolean>;
};

export type ProspectPreviewRefreshRepository = {
  withTransaction: <T>(
    operation: (transaction: ProspectPreviewRefreshTransaction) => Promise<T>,
  ) => Promise<T>;
};

export class PreviewRefreshError extends Error {
  constructor(
    public readonly code:
      | "invalid_refresh_input"
      | "preview_not_refreshable"
      | "invalid_first_party_evidence"
      | "invalid_evidence_references"
      | "refresh_conflict",
  ) {
    super(code);
    this.name = "PreviewRefreshError";
  }
}

function hostsAreRelated(left: string, right: string): boolean {
  return (
    left === right || left.endsWith(`.${right}`) || right.endsWith(`.${left}`)
  );
}

function isFirstPartySource(sourceUrl: string, verifiedUrl: string): boolean {
  try {
    const source = new URL(sourceUrl);
    const verified = new URL(verifiedUrl);
    const sourceHost = source.hostname.toLowerCase();
    const verifiedHost = verified.hostname.toLowerCase();
    const isGoogleMaps =
      GOOGLE_MAPS_HOSTS.has(sourceHost) ||
      (sourceHost === "www.google.com" && source.pathname.startsWith("/maps"));
    return (
      (source.protocol === "http:" || source.protocol === "https:") &&
      !isGoogleMaps &&
      hostsAreRelated(sourceHost, verifiedHost)
    );
  } catch {
    return false;
  }
}

function validateEvidenceReferences(
  input: ProspectPreviewRefreshInput,
): void {
  const evidenceById = new Map(
    input.brandEvidence.map((evidence) => [evidence.id, evidence]),
  );
  if (evidenceById.size !== input.brandEvidence.length) {
    throw new PreviewRefreshError("invalid_evidence_references");
  }

  const expectedKinds: Array<{
    ids: readonly string[];
    kind: ProspectPreviewRefreshInput["brandEvidence"][number]["kind"];
  }> = [
    {
      ids: input.experienceBrief.hero.evidenceIds,
      kind: "service-language",
    },
    {
      ids: input.experienceBrief.visual.colourEvidenceIds,
      kind: "brand-colours",
    },
  ];
  if (input.experienceBrief.visual.logoEvidenceId !== null) {
    expectedKinds.push({
      ids: [input.experienceBrief.visual.logoEvidenceId],
      kind: "logo",
    });
  }
  if (input.experienceBrief.visual.onSiteImageEvidenceId !== null) {
    expectedKinds.push({
      ids: [input.experienceBrief.visual.onSiteImageEvidenceId],
      kind: "on-site-image",
    });
  }

  const usesUnapprovedAsset =
    input.experienceBrief.visual.logoAssetId !== null ||
    input.experienceBrief.visual.onSiteImageAssetId !== null ||
    input.experienceBrief.visual.approvedHeroMediaAssetId !== null;
  if (usesUnapprovedAsset) {
    throw new PreviewRefreshError("invalid_evidence_references");
  }

  for (const expected of expectedKinds) {
    if (
      expected.ids.some(
        (id) => evidenceById.get(id)?.kind !== expected.kind,
      )
    ) {
      throw new PreviewRefreshError("invalid_evidence_references");
    }
  }
}

function buildRefreshedSnapshot(
  current: StoredProspectPreviewSnapshot,
  experienceBrief: ExperienceBrief,
): StoredProspectPreviewSnapshot {
  return {
    businessName: current.businessName,
    sector: current.sector,
    locality: current.locality,
    businessGoal: current.businessGoal,
    schemaVersion: "1.1",
    primaryCta: experienceBrief.journey.primaryCta,
    homepageSections: current.homepageSections,
    conversionPlan: current.conversionPlan,
    trustSignals: current.trustSignals,
    experienceBrief,
  };
}

function isRefreshable(
  preview: RefreshableProspectPreview,
): boolean {
  return (
    preview.status === "draft" &&
    ["pending_pr", "composition_unavailable", "merged_draft"].includes(
      preview.generationStatus,
    )
  );
}

async function refreshParsedPreview(
  input: ProspectPreviewRefreshInput,
  transaction: ProspectPreviewRefreshTransaction,
): Promise<{ prospectId: string; status: "refreshed" }> {
  const current = await transaction.loadPreview(input.prospectId);
  if (current === null || !isRefreshable(current)) {
    throw new PreviewRefreshError("preview_not_refreshable");
  }
  if (
    !input.brandEvidence.every((evidence) =>
      isFirstPartySource(evidence.sourceUrl, current.firstPartySourceUrl),
    )
  ) {
    throw new PreviewRefreshError("invalid_first_party_evidence");
  }
  validateEvidenceReferences(input);

  const updated = await transaction.replaceDraftPreview({
    prospectId: input.prospectId,
    snapshot: buildRefreshedSnapshot(current.snapshot, input.experienceBrief),
    experienceBrief: input.experienceBrief,
    brandEvidence: input.brandEvidence,
  });
  if (!updated) {
    throw new PreviewRefreshError("refresh_conflict");
  }

  return { prospectId: input.prospectId, status: "refreshed" };
}

function parseRefreshInputs(
  untrustedInputs: unknown,
): ProspectPreviewRefreshInput[] {
  const parsed = z.array(previewRefreshInputSchema).min(1).max(20).safeParse(untrustedInputs);
  if (!parsed.success) {
    throw new PreviewRefreshError("invalid_refresh_input");
  }
  if (new Set(parsed.data.map((input) => input.prospectId)).size !== parsed.data.length) {
    throw new PreviewRefreshError("invalid_refresh_input");
  }
  return parsed.data;
}

export function refreshEvidenceBackedPreviews(
  untrustedInputs: unknown,
  repository: ProspectPreviewRefreshRepository,
): Promise<readonly { prospectId: string; status: "refreshed" }[]> {
  const inputs = parseRefreshInputs(untrustedInputs);
  return repository.withTransaction(async (transaction) => {
    const results: Array<{ prospectId: string; status: "refreshed" }> = [];
    for (const input of inputs) {
      results.push(await refreshParsedPreview(input, transaction));
    }
    return results;
  });
}

export async function refreshEvidenceBackedPreview(
  untrustedInput: unknown,
  repository: ProspectPreviewRefreshRepository,
): Promise<{ prospectId: string; status: "refreshed" }> {
  const results = await refreshEvidenceBackedPreviews([untrustedInput], repository);
  const result = results[0];
  if (result === undefined) {
    throw new PreviewRefreshError("invalid_refresh_input");
  }
  return result;
}
