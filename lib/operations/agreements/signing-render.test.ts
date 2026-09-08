import assert from "node:assert/strict";
import test from "node:test";
import { agreementDraft } from "./fixtures";
import {
  agreementContent,
  renderAgreementSource,
  renderSignedAgreement,
  signingAudit,
  signingHash,
} from "./signing-render";
import { signingPounds } from "./signing-pdf-content";
import { supportsSigningText } from "./signing-text";
import { signingConsentSchema, type SigningApproval } from "./signing-types";
import { getSigningWorkerDb, signingEnabled } from "./signing-worker";
import { signingOperation } from "./signing-service";

test("source hashes exclude storage metadata, preserve exact pence and freeze client legal name", async (t) => {
  t.mock.timers.enable({
    apis: ["Date"],
    now: new Date("2026-09-08T12:00:00Z"),
  });
  const draft = agreementDraft();
  const source = await renderAgreementSource(draft, "Example Limited");
  assert.deepEqual(
    source,
    await renderAgreementSource(
      {
        ...draft,
        documentHash: "a".repeat(64),
        documentReference: "private:other.pdf",
      },
      "Example Limited",
    ),
  );
  assert.notEqual(
    signingHash(source),
    signingHash(
      await renderAgreementSource(
        { ...draft, terms: "Changed terms" },
        "Example Limited",
      ),
    ),
  );
  assert.notEqual(
    signingHash(source),
    signingHash(await renderAgreementSource(draft, "Other Limited")),
  );
  assert.ok(!("documentHash" in agreementContent(draft)));
  assert.ok(!("documentReference" in agreementContent(draft)));
  assert.equal(signingPounds("9007199254740993"), "£90,071,992,547,409.93");
  assert.equal(signingPounds("0"), "£0.00");
  assert.equal(signingPounds("1"), "£0.01");
});
test("signed PDF embeds the exact original source and auditable consent without session data", async () => {
  const draft = agreementDraft();
  draft.lines[0].recurrenceMonths = 1;
  draft.installments = [];
  const source = await renderAgreementSource(draft, "École Limited");
  const approval: SigningApproval = {
    id: "11111111-1111-4111-8111-111111111111",
    organisationId: "22222222-2222-4222-8222-222222222222",
    organisationLegalName: "École Limited",
    agreementId: "33333333-3333-4333-8333-333333333333",
    revision: 2,
    agreementVersion: 2,
    title: draft.title,
    draft,
    sourceHash: signingHash(source),
    approvalHash: "f".repeat(64),
    requiredSigners: draft.signatories,
    status: "approved",
    createdAt: "2026-09-08T10:00:00.000Z",
    approvedAt: "2026-09-08T10:00:00.000Z",
    expiresAt: "2026-09-09T10:00:00.000Z",
    completedAt: null,
    signatures: [
      {
        email: draft.signatories[0],
        userId: "44444444-4444-4444-8444-444444444444",
        typedName: "Émilie Test",
        signedAt: "2026-09-08T11:00:00.000Z",
      },
    ],
  };
  const audit = signingAudit(approval);
  const signed = await renderSignedAgreement(approval, source, audit);
  assert.equal(signed.subarray(0, 5).toString(), "%PDF-");
  assert.match(signed.toString("latin1"), /approved-source\.pdf/);
  assert.match(signed.toString("latin1"), /signature-audit\.json/);
  assert.equal(audit.toString().includes("private:"), false);
  assert.equal(audit.toString().includes("bearer"), false);
  assert.deepEqual(
    JSON.parse(audit.toString()).signatures,
    approval.signatures,
  );
});
test("unsupported characters fail before durable preparation or consent, western European names survive", async () => {
  assert.equal(
    supportsSigningText({
      text: "Émilie £20.00 “consent”",
      rows: ["Jean-Fidèle", true, null],
    }),
    true,
  );
  assert.equal(supportsSigningText("Signer 中文"), false);
  await assert.rejects(
    renderAgreementSource(
      { ...agreementDraft(), terms: "中文" },
      "Example Limited",
    ),
    /Western European/,
  );
  await assert.rejects(
    renderAgreementSource(agreementDraft(), "中文"),
    /Western European/,
  );
  const valid = {
    approvalId: "11111111-1111-4111-8111-111111111111",
    approvalHash: "a".repeat(64),
    typedName: "Émilie Test",
    authority: true,
    consent: true,
  };
  assert.equal(signingConsentSchema.safeParse(valid).success, true);
  for (const candidate of [
    { ...valid, typedName: "中文" },
    { ...valid, typedName: "A\nB" },
    { ...valid, authority: false },
    { ...valid, consent: false },
    { ...valid, email: "forged@example.test" },
  ])
    assert.equal(signingConsentSchema.safeParse(candidate).success, false);
});
test("worker feature gate requires both flags and separate credentials", async (t) => {
  assert.equal(
    signingEnabled({
      OPERATIONS_ENABLED: "true",
      OPERATIONS_SIGNING_ENABLED: "true",
    }),
    true,
  );
  for (const env of [
    {},
    { OPERATIONS_ENABLED: "true" },
    { OPERATIONS_ENABLED: "true", OPERATIONS_SIGNING_ENABLED: "TRUE" },
  ])
    assert.equal(signingEnabled(env), false);
  const saved = {
    operations: process.env.OPERATIONS_ENABLED,
    signing: process.env.OPERATIONS_SIGNING_ENABLED,
    url: process.env.OPERATIONS_SIGNING_DATABASE_URL,
  };
  t.after(() => {
    for (const [key, value] of Object.entries({
      OPERATIONS_ENABLED: saved.operations,
      OPERATIONS_SIGNING_ENABLED: saved.signing,
      OPERATIONS_SIGNING_DATABASE_URL: saved.url,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  process.env.OPERATIONS_ENABLED = "false";
  assert.throws(getSigningWorkerDb, /disabled/);
  process.env.OPERATIONS_ENABLED = "true";
  process.env.OPERATIONS_SIGNING_ENABLED = "true";
  delete process.env.OPERATIONS_SIGNING_DATABASE_URL;
  assert.throws(getSigningWorkerDb, /not configured/);
});
test("domain conflict adapter only masks expected race errors", async () => {
  assert.equal(await signingOperation(async () => 42), 42);
  for (const code of ["P0001", "P0002", "23505"])
    await assert.rejects(
      signingOperation(async () => {
        throw { code };
      }),
      /changed/,
    );
  const original = new Error("unexpected");
  await assert.rejects(
    signingOperation(async () => {
      throw original;
    }),
    (error) => error === original,
  );
});
