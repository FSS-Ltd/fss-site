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
    if (query.includes("with candidates as materialized")) return [];
    if (query.includes("from growth.source_evidence e join")) return [];
    if (query.includes("from growth.prospects p where"))
      return [{ status: "new", isClient: false, suppressed: false, active }];
    if (query.includes("from (select distinct on (id)")) return [];
    if (query.includes("from growth.campaign_memberships m join")) return [];
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
    replies: { status: "ready", items: [], truncated: false },
    membership: null,
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
    requestId: "c8f19d64-bfbb-4d62-a578-e3f48ea6c435",
  };
  let memberRows: object[] = [];
  let isClient = false;
  const db = (async (parts: TemplateStringsArray) => {
    const q = parts.join(" ");
    if (q.includes("with candidates as materialized")) return [];
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
        {
          status: "new",
          isClient,
          suppressed: false,
          active: memberRows.length > 0,
        },
      ];
    if (q.includes("from growth.campaign_memberships m join"))
      return memberRows;
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
  memberRows = [
    {
      id: "membership",
      campaignName: "Review",
      policyVersion: 2,
      status: "review",
      policyStatus: "paused",
      approvedBy: founder.actorId,
      approvedAt: observedAt,
      latestVersion: 2,
      country: "GB",
      policy,
      permissionExpiresAt: new Date("2026-12-22T09:00:00Z"),
      preparationStatus: "held",
      preparationReason: "permission_invalid",
    },
  ];
  const memberResult = await getProspectCampaign(
    "prospect",
    4,
    founder,
    db,
    now,
  );
  assert.equal(memberResult.status, "ready");
  if (memberResult.status === "ready") {
    assert.equal(memberResult.membership?.canRecord, true);
    assert.equal(
      memberResult.membership?.preparation?.reason,
      "permission_invalid",
    );
    assert.equal(memberResult.verification?.contactVersion, 3);
  }
  isClient = true;
  const excluded = await getProspectCampaign("prospect", 4, founder, db, now);
  if (excluded.status === "ready") {
    assert.equal(excluded.reviewStatus, "excluded");
    assert.equal(excluded.membership?.canRecord, false);
  }
  isClient = false;
  const stale = await getProspectCampaign("prospect", 5, founder, db, now);
  if (stale.status === "ready") {
    assert.equal(stale.verification?.status, "stale");
    assert.equal(stale.membership?.canRecord, false);
  }
});
