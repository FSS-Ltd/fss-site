import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { getProspectDetail } from "../../../lib/growth/dashboard/prospect-detail";
import { executeCrmCommand } from "../../../lib/growth/crm/commands";
import { verifyFounderEvidence } from "../../../lib/growth/campaigns/founder-verification";
import { loadFounderVerification } from "../../../lib/growth/campaigns/founder-verification-reader";

const connection = process.env.DIRECT_DATABASE_URL;
test(
  "founder verification stores immutable versioned proofs and supports replay",
  { skip: !connection },
  async () => {
    if (!connection) return;
    const db = postgres(connection, {
      max: 4,
      connection: { options: "-c role=growth_app" },
    });
    const [role] = await db`select current_user as name`;
    assert.equal(role?.name, "growth_app");
    const token = randomUUID();
    const email = "j.ntagengwa@faithfulsoftware.dev";
    const founder = {
      email,
      actorId: createHash("sha256").update(email).digest("hex"),
    };
    const source = {
      kind: "capture_source" as const,
      requestId: randomUUID(),
      sourceType: "facebook_page" as const,
      sourceUrl: `https://facebook.com/${token}`,
      businessName: `evidence-${token}`,
      countryCode: "GB",
      corporateType: null,
      registrationNumber: null,
      firstName: null,
      lastName: null,
      email: null,
      opportunity: "Review",
      offer: "Website",
      observedAt: new Date(),
    };
    try {
      const lead = await executeCrmCommand(db, source, founder, randomUUID());
      assert.ok(lead.prospectId);
      const input = {
        requestId: randomUUID(),
        prospectId: lead.prospectId,
        expectedProspectVersion: 1,
        email: `${token}@example.com`,
        firstName: null,
        lastName: null,
        contactSourceUrl: `https://${token}.example.com/contact`,
        contactObservedAt: new Date(),
        observationSourceUrl: `https://${token}.example.com`,
        observation: "The business lists appointment requests by telephone.",
        observedAt: new Date(Date.now() - 29 * 86400000),
      };
      await assert.rejects(
        verifyFounderEvidence(
          db,
          {
            ...input,
            requestId: randomUUID(),
            observedAt: new Date(Date.now() + 86400000),
          },
          founder,
          randomUUID(),
        ),
      );
      await assert.rejects(
        verifyFounderEvidence(
          db,
          {
            ...input,
            requestId: randomUUID(),
            observedAt: new Date(Date.now() - 31 * 86400000),
          },
          founder,
          randomUUID(),
        ),
      );
      await assert.rejects(
        verifyFounderEvidence(
          db,
          { ...input, requestId: randomUUID(), observation: "x".repeat(501) },
          founder,
          randomUUID(),
        ),
      );
      await assert.rejects(
        verifyFounderEvidence(
          db,
          {
            ...input,
            requestId: randomUUID(),
            contactSourceUrl: "http://127.0.0.1",
          },
          founder,
          randomUUID(),
        ),
      );
      const [first, replay] = await Promise.all([
        verifyFounderEvidence(db, input, founder, randomUUID()),
        verifyFounderEvidence(db, input, founder, randomUUID()),
      ]);
      assert.equal(first.contactId, replay.contactId);
      const detail = await getProspectDetail(lead.prospectId, db);
      assert.equal(detail.status, "found");
      if (detail.status === "found")
        assert.equal(detail.data.evidence.length, 0);
      const rows =
        await db`select origin, research_run_id, contact_id, contact_version, prospect_version from growth.source_evidence where request_id=${input.requestId}`;
      assert.equal(rows.length, 2);
      assert.ok(
        rows.every(
          (row) =>
            row.origin === "founder" &&
            row.research_run_id === null &&
            row.contact_id === first.contactId &&
            row.contact_version === first.contactVersion &&
            row.prospect_version === first.prospectVersion,
        ),
      );
      const [contact] =
        await db`select first_name,last_name,lawful_basis from growth.contacts where id=${first.contactId}`;
      assert.equal(contact?.first_name, null);
      assert.equal(contact?.last_name, null);
      assert.equal(contact?.lawful_basis, "research_only");
      assert.equal(
        (
          await loadFounderVerification(
            db,
            lead.prospectId,
            new Date(),
            founder,
          )
        )?.status,
        "current",
      );
      const snapshot = await loadFounderVerification(
        db,
        lead.prospectId,
        new Date(),
        founder,
      );
      assert.equal(
        snapshot?.effectiveEvidenceAt.toISOString(),
        input.observedAt.toISOString(),
      );
      assert.equal(
        (
          await loadFounderVerification(
            db,
            lead.prospectId,
            new Date(Date.now() + 2 * 86400000),
            founder,
          )
        )?.status,
        "stale",
      );
      await assert.rejects(
        db.begin(async (tx) => {
          await tx`set local role growth_app`;
          await tx`update growth.source_evidence set claim_summary='changed' where request_id=${input.requestId}`;
        }),
      );
      await assert.rejects(
        db.begin(async (tx) => {
          await tx`set local role growth_app`;
          await tx`delete from growth.source_evidence where request_id=${input.requestId}`;
        }),
      );
      const otherLead = await executeCrmCommand(
        db,
        {
          ...source,
          requestId: randomUUID(),
          businessName: `other-${token}`,
          sourceUrl: `https://facebook.com/other-${token}`,
        },
        founder,
        randomUUID(),
      );
      assert.ok(otherLead.prospectId);
      const conflictRequest = randomUUID();
      await assert.rejects(
        verifyFounderEvidence(
          db,
          {
            ...input,
            requestId: conflictRequest,
            prospectId: otherLead.prospectId,
          },
          founder,
          randomUUID(),
        ),
      );
      const [conflictRows] =
        await db`select count(*)::int as count from growth.source_evidence where request_id=${conflictRequest}`;
      assert.equal(conflictRows?.count, 0);
      const rollbackId = randomUUID();
      await assert.rejects(
        verifyFounderEvidence(
          db,
          {
            ...input,
            requestId: rollbackId,
            expectedProspectVersion: first.prospectVersion,
          },
          founder,
          "\u0000",
        ),
      );
      const [rolledBack] =
        await db`select count(*)::int as count from growth.source_evidence where request_id=${rollbackId}`;
      assert.equal(rolledBack?.count, 0);
      const [unchanged] =
        await db`select version from growth.prospects where id=${lead.prospectId}`;
      assert.equal(unchanged?.version, first.prospectVersion);
      const renewal = await verifyFounderEvidence(
        db,
        {
          ...input,
          requestId: randomUUID(),
          expectedProspectVersion: first.prospectVersion,
          observedAt: new Date(),
          contactObservedAt: new Date(),
        },
        founder,
        randomUUID(),
      );
      assert.equal(renewal.prospectVersion, first.prospectVersion + 1);
      assert.equal(
        (
          await loadFounderVerification(
            db,
            lead.prospectId,
            new Date(),
            founder,
          )
        )?.status,
        "current",
      );
      await db`update growth.prospects set version=version+1 where id=${lead.prospectId}`;
      assert.equal(
        (
          await loadFounderVerification(
            db,
            lead.prospectId,
            new Date(),
            founder,
          )
        )?.status,
        "stale",
      );
      await assert.rejects(
        loadFounderVerification(db, lead.prospectId, new Date(), {
          ...founder,
          actorId: "bad",
        }),
      );

      await assert.rejects(
        db`update growth.source_evidence set claim_summary='changed' where request_id=${input.requestId}`,
      );
      await assert.rejects(
        verifyFounderEvidence(
          db,
          { ...input, observation: "Changed" },
          founder,
          randomUUID(),
        ),
      );
    } finally {
      await db.end();
    }
  },
);
