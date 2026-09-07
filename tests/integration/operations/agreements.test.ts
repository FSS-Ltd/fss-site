import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { requireOperationsTestDatabaseUrl } from "../../../scripts/require-operations-database-env";
import { applyReviewedMapping } from "../../../lib/operations/organisations/repository";
import { executeAgreementCommand } from "../../../lib/operations/agreements/service";
import { listAgreementRegister } from "../../../lib/operations/agreements/repository";
import {
  agreementDraft,
  signatureEvidence,
} from "../../../lib/operations/agreements/fixtures";
import { createEngagement } from "./fixtures";

const url = requireOperationsTestDatabaseUrl(
  process.env.OPERATIONS_TEST_DATABASE_URL,
);

test("founder agreements preserve signed revisions, gate individual services and append auditable evidence", async () => {
  const admin = postgres(url, { max: 1 });
  const runtime = postgres(url, {
    max: 2,
    connection: { options: "-c role=operations_founder" },
  });
  const organisationId = randomUUID();
  const founder = { actorId: "c".repeat(64) };
  const fixture = await createEngagement(admin);
  const correlationId = randomUUID();
  const execute = (command: unknown) =>
    executeAgreementCommand(
      runtime,
      founder,
      organisationId,
      command,
      correlationId,
    );
  try {
    await applyReviewedMapping(runtime, founder, {
      reviewReference: "agreement-test",
      organisations: [
        {
          id: organisationId,
          legalName: "Agreement Test Limited",
          displayName: "Agreement Test",
          tradingStatus: "active",
          timezone: "Europe/London",
          engagementIds: [fixture.engagementId],
        },
      ],
    });
    const draft = agreementDraft();
    draft.lines[0].startDate = "2026-01-01";
    draft.lines.push(
      {
        ...draft.lines[0],
        serviceCode: "quarterly",
        recurrenceMonths: 3,
        startDate: "2099-01-01",
      },
      { ...draft.lines[0], serviceCode: "annual", recurrenceMonths: 12 },
    );
    await assert.rejects(
      executeAgreementCommand(
        runtime,
        null,
        organisationId,
        { action: "create", engagementId: fixture.engagementId, draft },
        correlationId,
      ),
      /Founder authorization/,
    );
    await assert.rejects(
      execute({ action: "create", engagementId: randomUUID(), draft }),
      { code: "23503" },
    );
    let record = await execute({
      action: "create",
      engagementId: fixture.engagementId,
      draft,
    });
    assert.equal(record.version, 1);
    for (const snapshot of [
      draft,
      { ...draft, assetsRequired: undefined },
      { ...draft, requiredDepositPence: undefined },
    ]) {
      await assert.rejects(
        runtime.begin(async (tx) => {
          await tx`select set_config('operations.actor_id', ${founder.actorId}, true)`;
          await tx`insert into operations.agreement_revisions(organisation_id,agreement_id,revision,snapshot,created_by,correlation_id) values (${organisationId},${record.id},2,${tx.json(snapshot)},${founder.actorId},${correlationId})`;
          await tx`update operations.agreements set current_revision=2,version=2 where id=${record.id}`;
          await tx`insert into operations.signature_evidence(organisation_id,agreement_id,revision,evidence,created_by,correlation_id) values (${organisationId},${record.id},2,${tx.json(signatureEvidence())},${founder.actorId},${correlationId})`;
          throw new Error(
            "Unexpected acceptance of incomplete signed snapshot",
          );
        }),
        /Complete revision lines required|Valid activation requirements required/,
      );
    }
    const base = { agreementId: record.id, expectedVersion: 1 };
    const activation = {
      effectiveDate: "2026-09-06",
      assetsReady: true,
      deposit: {
        amountPence: "6000",
        verifiedDate: "2026-09-06",
        reference: "manual-bank-review",
      },
    };
    await assert.rejects(
      execute({
        action: "activate",
        ...base,
        lineNumber: 1,
        evidence: activation,
      }),
      /signed/i,
    );
    const revisions = await Promise.allSettled([
      execute({
        action: "revise",
        ...base,
        draft: { ...draft, title: "Revised terms" },
      }),
      execute({
        action: "revise",
        ...base,
        draft: { ...draft, title: "Conflicting terms" },
      }),
    ]);
    assert.equal(
      revisions.filter((result) => result.status === "fulfilled").length,
      1,
    );
    record = (await listAgreementRegister(runtime, founder, organisationId))!
      .agreements[0];
    assert.equal(record.revision, 2);
    assert.equal(record.version, 2);
    const evidence = { ...signatureEvidence(), certificateReference: null };
    await assert.rejects(
      execute({
        action: "sign",
        agreementId: record.id,
        expectedVersion: 2,
        evidence: { ...evidence, sourceHash: "a".repeat(64) },
      }),
      /match/,
    );
    await assert.rejects(
      execute({
        action: "sign",
        agreementId: record.id,
        expectedVersion: 2,
        evidence: { ...evidence, signedDate: "2099-01-01" },
      }),
      /future/,
    );
    record = await execute({
      action: "sign",
      agreementId: record.id,
      expectedVersion: 2,
      evidence,
    });
    assert.equal(record.status, "signed");
    await assert.rejects(
      runtime.begin(async (tx) => {
        await tx`select set_config('operations.actor_id', ${founder.actorId}, true)`;
        const malformed = {
          ...activation,
          deposit: { ...activation.deposit, amountPence: "NaN" },
        };
        await tx`insert into operations.service_instances(organisation_id,agreement_id,revision,line_number,effective_date,activation_evidence,created_by,correlation_id) values (${organisationId},${record.id},2,1,${activation.effectiveDate},${tx.json(malformed)},${founder.actorId},${correlationId})`;
        throw new Error("Unexpected acceptance of non-finite deposit");
      }),
      /Valid deposit amount required/,
    );

    assert.equal(record.evidence?.signedDocumentHash, "c".repeat(64));
    await assert.rejects(
      execute({
        action: "revise",
        agreementId: record.id,
        expectedVersion: 3,
        draft,
      }),
      /immutable/,
    );
    for (const invalid of [
      { ...activation, deposit: null },
      { ...activation, assetsReady: false },
      { ...activation, effectiveDate: "2026-09-05", deposit: null },
    ]) {
      await assert.rejects(
        execute({
          action: "activate",
          agreementId: record.id,
          expectedVersion: 3,
          lineNumber: 1,
          evidence: invalid,
        }),
      );
    }
    await assert.rejects(
      execute({
        action: "activate",
        agreementId: record.id,
        expectedVersion: 3,
        lineNumber: 2,
        evidence: activation,
      }),
      /start|date/i,
    );
    record = await execute({
      action: "activate",
      agreementId: record.id,
      expectedVersion: 3,
      lineNumber: 1,
      evidence: activation,
    });
    assert.equal(record.services.length, 1);
    assert.equal(record.services[0].effectiveDate, activation.effectiveDate);
    await assert.rejects(
      execute({
        action: "activate",
        agreementId: record.id,
        expectedVersion: 4,
        lineNumber: 1,
        evidence: activation,
      }),
      /already active/,
    );
    record = await execute({
      action: "activate",
      agreementId: record.id,
      expectedVersion: 4,
      lineNumber: 3,
      evidence: activation,
    });
    assert.equal(record.services.length, 2);
    const totals = await admin<
      { total: string; recurrence: number }[]
    >`select total_pence::text as total, recurrence_months as recurrence from operations.agreement_lines where agreement_id=${record.id} and revision=2 order by line_number`;
    assert.deepEqual(
      [...totals],
      [
        { total: "12000", recurrence: 0 },
        { total: "12000", recurrence: 3 },
        { total: "12000", recurrence: 12 },
      ],
    );
    const audits = await admin<
      { action: string; actor: string; correlation: string }[]
    >`select action,actor_id as actor,correlation_id as correlation from operations.audit_events where organisation_id=${organisationId} and correlation_id is not null`;
    assert.equal(audits.length, 5);
    assert.ok(
      audits.every(
        (row) =>
          row.actor === founder.actorId && row.correlation === correlationId,
      ),
    );
    assert.equal(
      audits.filter((row) => row.action === "service.activated").length,
      2,
    );
    for (const table of [
      "agreement_revisions",
      "agreement_lines",
      "signature_evidence",
      "service_instances",
    ]) {
      await assert.rejects(runtime.unsafe(`delete from operations.${table}`), {
        code: "42501",
      });
    }
    assert.equal(
      (await runtime`select id from operations.agreements`).length,
      0,
    );
    await assert.rejects(
      executeAgreementCommand(
        runtime,
        founder,
        randomUUID(),
        {
          action: "sign",
          agreementId: record.id,
          expectedVersion: 5,
          evidence,
        },
        correlationId,
      ),
      /not found/,
    );
    const [growth] = await admin<
      { stage: string; version: number }[]
    >`select stage,version from growth.delivery_engagements where id=${fixture.engagementId}`;
    assert.deepEqual(growth, { stage: "new", version: 1 });
  } finally {
    await runtime.end();
    await admin.begin(async (tx) => {
      await tx`set constraints all deferred`;
      for (const table of [
        "service_instances",
        "signature_evidence",
        "agreement_lines",
        "agreement_revisions",
        "agreements",
        "audit_events",
        "engagement_links",
        "organisations",
      ]) {
        await tx.unsafe(
          `delete from operations.${table} where ${table === "organisations" ? "id" : "organisation_id"}=$1`,
          [organisationId],
        );
      }
    });
    await admin`delete from growth.delivery_engagements where id=${fixture.engagementId}`;
    await admin`delete from growth.prospects where id=${fixture.prospectId}`;
    await admin`delete from growth.contacts where id=${fixture.contactId}`;
    await admin`delete from growth.businesses where id=${fixture.businessId}`;
    await admin.end();
  }
});
