import assert from "node:assert/strict";

import test from "node:test";
import { signingFixture } from "./signing-fixtures";
import {
  prepareAgreementSigning,
  cancelAgreementSigning,
  declinePortalAgreement,
  getFounderSigning,
  getPortalSigning,
} from "../../../lib/operations/agreements/signing-service";
import {
  completeAgreementSigning,
  runSigningCompletionWorker,
} from "../../../lib/operations/agreements/signing-worker";
import { executeAgreementCommand } from "../../../lib/operations/agreements/service";
import { signingAudit } from "../../../lib/operations/agreements/signing-render";

test("edited content invalidates all existing consent and old approval", async (t) => {
  const f = await signingFixture(t);
  const p = await f.approve(await f.prepare());
  await f.sign(p);
  await executeAgreementCommand(
    f.founderDb,
    f.founder,
    f.organisationId,
    {
      action: "revise",
      agreementId: f.record.id,
      expectedVersion: 2,
      draft: { ...p.draft, scope: "Different terms" },
    },
    f.correlationId,
  );
  assert.equal(
    (
      await getFounderSigning(
        f.founderDb,
        f.founder,
        f.organisationId,
        p.id,
        f.correlationId,
      )
    )?.status,
    "superseded",
  );
  await assert.rejects(f.sign(p, 1));
  assert.equal(
    await completeAgreementSigning(f.worker, p.id, f.correlationId),
    false,
  );
});
test("changing required signers creates a replacement with no transferred consent", async (t) => {
  const f = await signingFixture(t);
  const p = await f.approve(await f.prepare());
  await f.sign(p);
  const revised = await executeAgreementCommand(
    f.founderDb,
    f.founder,
    f.organisationId,
    {
      action: "revise",
      agreementId: f.record.id,
      expectedVersion: 2,
      draft: { ...p.draft, signatories: [f.identities[1].email] },
    },
    f.correlationId,
  );
  const replacement = await prepareAgreementSigning(
    f.founderDb,
    f.founder,
    f.organisationId,
    { agreementId: f.record.id, expectedVersion: revised.version },
    f.correlationId,
  );
  assert.notEqual(replacement.approvalHash, p.approvalHash);
  assert.deepEqual(replacement.signatures, []);
  assert.deepEqual(replacement.requiredSigners, [f.identities[1].email]);
});
test("decline terminates remaining signatures and is audited", async (t) => {
  const f = await signingFixture(t);
  const p = await f.approve(await f.prepare());
  const declined = await declinePortalAgreement(
    f.portal,
    f.identities[0],
    f.organisationId,
    { approvalId: p.id, approvalHash: p.approvalHash },
    f.correlationId,
  );
  assert.equal(declined.status, "declined");
  await assert.rejects(f.sign(p, 1));
  assert.equal(
    await completeAgreementSigning(f.worker, p.id, f.correlationId),
    false,
  );
  assert.equal(
    (
      await f.admin`select * from operations.signing_audit_events where approval_id=${p.id} and action='declined'`
    ).length,
    1,
  );
});
test("cancellation is idempotent and prevents completion", async (t) => {
  const f = await signingFixture(t);
  const p = await f.approve(await f.prepare());
  for (let i = 0; i < 2; i++)
    assert.equal(
      (
        await cancelAgreementSigning(
          f.founderDb,
          f.founder,
          f.organisationId,
          { approvalId: p.id },
          f.correlationId,
        )
      ).status,
      "cancelled",
    );
  await assert.rejects(f.sign(p));
  assert.equal(
    await completeAgreementSigning(f.worker, p.id, f.correlationId),
    false,
  );
});
test("expiry blocks new signatures but preserves historical partial evidence", async (t) => {
  const f = await signingFixture(t);
  const p = await f.approve(await f.prepare());
  await f.sign(p);
  await f.admin`update operations.signing_approvals set expires_at=clock_timestamp()-interval '1 second' where id=${p.id}`;
  assert.equal(
    (
      await getPortalSigning(
        f.portal,
        f.identities[1],
        f.organisationId,
        p.id,
        f.correlationId,
      )
    )?.status,
    "expired",
  );
  await assert.rejects(f.sign(p, 1));
});
test("worker recovers fully signed execution after delivery expiry and never signs partial requests", async (t) => {
  const f = await signingFixture(t, 1);
  const p = await f.approve(await f.prepare());
  await f.sign(p);
  await f.admin`update operations.signing_signatures set signed_at=clock_timestamp()-interval '2 minutes' where approval_id=${p.id}`;
  await f.admin`update operations.signing_approvals set expires_at=clock_timestamp()-interval '1 minute' where id=${p.id}`;
  const recovered = await runSigningCompletionWorker(f.worker, { limit: 1 });
  assert.equal(recovered.completed, 1);
  assert.equal(recovered.failed, 0);
  assert.deepEqual(await runSigningCompletionWorker(f.worker), {
    completed: 0,
    failed: 0,
  });
});
test("worker SQL refuses partial signatures and mismatched audit, leaving no evidence on failure", async (t) => {
  const f = await signingFixture(t, 1);
  const p = await f.approve(await f.prepare());
  await assert.rejects(
    f.worker`select operations.complete_agreement_signing(${p.id},${Buffer.from("%PDF-x")},${Buffer.from("{}")},${f.correlationId})`,
    /All required/,
  );
  await f.sign(p);
  await assert.rejects(
    f.worker`select operations.complete_agreement_signing(${p.id},${Buffer.from("%PDF-x")},${Buffer.from("{}")},${f.correlationId})`,
    /Audit evidence/,
  );
  assert.equal(
    (
      await f.admin`select * from operations.signing_artifacts where approval_id=${p.id}`
    ).length,
    0,
  );
  assert.equal(
    (
      await f.admin`select status from operations.agreements where id=${f.record.id}`
    )[0].status,
    "draft",
  );
});
test("oversized retained completion rolls back and worker can safely retry", async (t) => {
  const f = await signingFixture(t, 1);
  const p = await f.approve(await f.prepare());
  const signed = await f.sign(p);
  const oversized = Buffer.concat([
    Buffer.from("%PDF-"),
    Buffer.alloc(1024 * 1024),
  ]);
  await assert.rejects(
    f.worker`select operations.complete_agreement_signing(${p.id},${oversized},${signingAudit(signed)},${f.correlationId})`,
    { code: "23514" },
  );
  assert.equal(
    (
      await f.admin`select * from operations.signing_artifacts where approval_id=${p.id}`
    ).length,
    0,
  );
  assert.equal(
    await completeAgreementSigning(f.worker, p.id, f.correlationId),
    true,
  );
});
test("completed agreements cannot be cancelled, revised or prepared again", async (t) => {
  const f = await signingFixture(t, 1);
  const p = await f.approve(await f.prepare());
  await f.sign(p);
  await completeAgreementSigning(f.worker, p.id, f.correlationId);
  await assert.rejects(
    cancelAgreementSigning(
      f.founderDb,
      f.founder,
      f.organisationId,
      { approvalId: p.id },
      f.correlationId,
    ),
  );
  await assert.rejects(
    prepareAgreementSigning(
      f.founderDb,
      f.founder,
      f.organisationId,
      { agreementId: f.record.id, expectedVersion: 3 },
      f.correlationId,
    ),
    /immutable/,
  );
});

test("failed completion receives bounded retry delay while other requests remain recoverable", async (t) => {
  const f = await signingFixture(t, 1);
  const p = await f.approve(await f.prepare());
  await f.sign(p);
  // Simulate legacy corrupt evidence in the disposable administrator fixture.
  await f.admin`update operations.signing_signatures set signed_at=clock_timestamp()+interval '2 days' where approval_id=${p.id}`;
  assert.deepEqual(await runSigningCompletionWorker(f.worker), {
    completed: 0,
    failed: 1,
  });
  const [retry] =
    await f.admin`select completion_attempts,completion_next_attempt_at>now() as delayed from operations.signing_approvals where id=${p.id}`;
  assert.equal(retry.completion_attempts, 1);
  assert.equal(retry.delayed, true);
  assert.deepEqual(await runSigningCompletionWorker(f.worker), {
    completed: 0,
    failed: 0,
  });
  await f.admin`update operations.signing_signatures set signed_at=clock_timestamp() where approval_id=${p.id}`;
  await f.worker`update operations.signing_approvals set completion_next_attempt_at=now() where id=${p.id}`;
  assert.deepEqual(await runSigningCompletionWorker(f.worker), {
    completed: 1,
    failed: 0,
  });
});

test("all recorded consents lock cancellation, revision and manual replacement until evidence completes", async (t) => {
  const f = await signingFixture(t, 1);
  const p = await f.approve(await f.prepare());
  await f.sign(p);
  await assert.rejects(
    cancelAgreementSigning(
      f.founderDb,
      f.founder,
      f.organisationId,
      { approvalId: p.id },
      f.correlationId,
    ),
  );
  await assert.rejects(
    executeAgreementCommand(
      f.founderDb,
      f.founder,
      f.organisationId,
      {
        action: "revise",
        agreementId: f.record.id,
        expectedVersion: 2,
        draft: { ...p.draft, scope: "Replaced after execution" },
      },
      f.correlationId,
    ),
    /All parties have signed/,
  );
  await assert.rejects(
    executeAgreementCommand(
      f.founderDb,
      f.founder,
      f.organisationId,
      {
        action: "sign",
        agreementId: f.record.id,
        expectedVersion: 2,
        evidence: {
          confirmed: true,
          sourceHash: p.sourceHash,
          signedDocumentHash: "c".repeat(64),
          documentReference: "private:manual.pdf",
          certificateReference: null,
          signatories: p.requiredSigners,
          signedDate: new Date().toISOString().slice(0, 10),
        },
      },
      f.correlationId,
    ),
    /All parties have signed/,
  );
  assert.equal(
    await completeAgreementSigning(f.worker, p.id, f.correlationId),
    true,
  );
});
