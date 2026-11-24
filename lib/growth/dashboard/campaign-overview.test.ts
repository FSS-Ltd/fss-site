import assert from "node:assert/strict";
import test from "node:test";
import type { GrowthQueryExecutor } from "../db/types";
import { websiteServiceOffers } from "../campaigns/website-service-offers";
import { getCampaignOverview } from "./campaign-overview";

function dbReturning(rows: object[]): GrowthQueryExecutor {
  return (async () => rows) as unknown as GrowthQueryExecutor;
}

test("projects stored offer terms and observed campaign counts", async () => {
  const result = await getCampaignOverview(
    dbReturning([
      {
        id: "campaign",
        name: "Local",
        version: 1,
        status: "paused",
        approvedAt: null,
        policy: {
          offer: "lead_review_essentials_v1",
          commercialTerms: websiteServiceOffers.lead_review_essentials_v1,
        },
        prepared: 3,
        held: 1,
        attempts: 2,
        accepted: 1,
        confirmed: 0,
        holdReason: "permission_invalid",
        reportDue: new Date("2026-12-23T09:00:00Z"),
        reportStatus: "pending",
      },
    ]),
    new Date("2026-11-23T09:00:00Z"),
  );
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(result.rows[0]?.offer, "Lead & Review Essentials · £297/month");
  assert.equal(result.rows[0]?.confirmed, 0);
  assert.equal(result.rows[0]?.holdReason, "permission_invalid");
  assert.equal(result.rows[0]?.reportDue, "2026-12-23T09:00:00.000Z");
});

test("does not infer missing monthly terms and marks a bounded list", async () => {
  const row = {
    id: "x",
    name: "X",
    version: 1,
    status: "paused",
    approvedAt: null,
    policy: { offer: "ai_front_desk_v1" },
    prepared: 0,
    held: 0,
    attempts: 0,
    accepted: 0,
    confirmed: 0,
    holdReason: null,
    reportDue: null,
    reportStatus: null,
  };
  const result = await getCampaignOverview(
    dbReturning(
      Array.from({ length: 51 }, (_, index) => ({ ...row, id: String(index) })),
    ),
  );
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(result.rows.length, 50);
  assert.equal(result.truncated, true);
  assert.equal(result.rows[0]?.offer, "Monthly terms unavailable");
});

test("returns a safe error on database failure", async () => {
  const db = (async () => {
    throw new Error("private database details");
  }) as unknown as GrowthQueryExecutor;
  const result = await getCampaignOverview(db);
  assert.equal(result.status, "error");
  assert.doesNotMatch(JSON.stringify(result), /private database details/);
});

test("only exposes safely round-trippable stored policy for revision", async () => {
  const { campaignPolicyDefinitionSchema } =
    await import("../campaigns/schemas");
  const { serializeCampaignDefinition } =
    await import("../campaigns/lifecycle");
  const proof = {
    summary: "Reviewed",
    reference: { kind: "private", value: "proof" },
    observedAt: "2026-11-20T12:00:00Z",
    expiresAt: "2026-12-20T12:00:00Z",
  };
  const policy = serializeCampaignDefinition(
    campaignPolicyDefinitionSchema.parse({
      version: 1,
      offer: "review",
      jurisdiction: "GB",
      capabilityEvidence: "proof",
      capabilityAttestation: proof,
      providerAttestation: {
        ...proof,
        provider: "gmail",
        jurisdiction: "GB",
        confirmed: true,
      },
    }),
  );
  const row = {
    id: "x",
    name: "X",
    version: 1,
    status: "paused",
    approvedAt: null,
    prepared: 0,
    held: 0,
    attempts: 0,
    accepted: 0,
    confirmed: 0,
    holdReason: null,
    reportDue: null,
    reportStatus: null,
  };
  const result = await getCampaignOverview(
    dbReturning([
      { ...row, policy },
      { ...row, id: "unknown", policy: { ...policy, futureSetting: true } },
    ]),
  );
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(result.rows[0]?.editorPolicy?.offer, "review");
  assert.equal(result.rows[1]?.editorPolicy, null);
});
