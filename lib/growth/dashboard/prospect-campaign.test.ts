import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { GrowthQueryExecutor } from "../db/types";
import { getProspectCampaign } from "./prospect-campaign";
const email = "j.ntagengwa@faithfulsoftware.dev";
const founder = {
  email,
  actorId: createHash("sha256").update(email).digest("hex"),
};
const now = new Date("2026-11-23T09:00:00Z");
function database(active: boolean): GrowthQueryExecutor {
  const tx = async (parts: TemplateStringsArray) => {
    const query = parts.join(" ");
    if (query.includes("from growth.source_evidence e join")) return [];
    if (query.includes("from growth.prospects p where"))
      return [{ status: "new", isClient: false, suppressed: false, active }];
    if (query.includes("from (select distinct on (id)")) return [];
    throw new Error("unexpected query");
  };
  return tx as unknown as GrowthQueryExecutor;
}
test("does not infer source verification, consent, or campaigns from absent evidence", async () => {
  const result = await getProspectCampaign(
    "prospect",
    1,
    founder,
    database(false),
    now,
  );
  assert.deepEqual(result, {
    status: "ready",
    verification: null,
    reviewStatus: "available",
    campaigns: [],
    truncated: false,
  });
  const active = await getProspectCampaign(
    "prospect",
    1,
    founder,
    database(true),
    now,
  );
  assert.equal(active.status, "ready");
  if (active.status === "ready")
    assert.equal(active.reviewStatus, "already_in_outreach");
  await assert.rejects(() =>
    getProspectCampaign(
      "prospect",
      1,
      { ...founder, actorId: "wrong" },
      database(false),
      now,
    ),
  );
});

test("requires current matching source and only exposes valid approved policy versions", async () => {
  const { campaignPolicyDefinitionSchema } =
    await import("../campaigns/schemas");
  const { serializeCampaignDefinition } =
    await import("../campaigns/lifecycle");
  const observedAt = new Date("2026-11-22T09:00:00Z");
  const proof = {
    summary: "Reviewed",
    reference: { kind: "private", value: "proof" },
    observedAt: observedAt.toISOString(),
    expiresAt: "2026-12-22T09:00:00Z",
  };
  const policy = serializeCampaignDefinition(
    campaignPolicyDefinitionSchema.parse({
      version: 2,
      offer: "review",
      jurisdiction: "GB",
      permissionRequirement: "consent",
      effectiveAt: observedAt,
      expiresAt: "2026-12-22T09:00:00Z",
      capabilityEvidence: "proof",
      capabilityAttestation: proof,
      providerAttestation: {
        ...proof,
        provider: "gmail",
        jurisdiction: "GB",
        confirmed: true,
      },
      haltThresholds: { hardBounces: 1, complaints: 0 },
      cadenceFamily: "review",
      variants: [
        { id: "a", version: 1, cta: "May I?" },
        { id: "b", version: 1, cta: "Could I?" },
      ],
    }),
  );
  const common = {
    contactId: "contact",
    proofId: "proof-id",
    email: "person@example.com",
    sourceUrl: "https://example.com/contact",
    observedAt,
    verifiedAt: observedAt,
    proofContactVersion: 3,
    proofProspectVersion: 4,
    contactVersion: 3,
    prospectVersion: 4,
    primaryContactId: "contact",
    requestId: "request",
  };
  const db = (async (parts: TemplateStringsArray) => {
    const q = parts.join(" ");
    if (q.includes("from growth.source_evidence e join"))
      return [
        { ...common, claimType: "contact_email", summary: "contact" },
        {
          ...common,
          claimType: "business_observation",
          summary: "Offers bookings",
        },
      ];
    if (q.includes("from growth.prospects p where"))
      return [
        { status: "new", isClient: false, suppressed: false, active: false },
      ];
    if (q.includes("from (select distinct on (id)"))
      return [
        {
          id: "c",
          name: "Review",
          version: 2,
          status: "paused",
          approvedAt: observedAt,
          approvedBy: founder.actorId,
          policy,
        },
      ];
    throw new Error("unexpected");
  }) as unknown as GrowthQueryExecutor;
  const result = await getProspectCampaign("prospect", 4, founder, db, now);
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(result.verification?.status, "current");
  assert.equal(result.campaigns[0]?.version, 2);
  assert.equal(result.campaigns[0]?.status, "paused");
  const stale = await getProspectCampaign("prospect", 5, founder, db, now);
  if (stale.status === "ready")
    assert.equal(stale.verification?.status, "stale");
});
