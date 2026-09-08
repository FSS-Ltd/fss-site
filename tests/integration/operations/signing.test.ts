import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { signingFixture } from "./signing-fixtures";
import {
  prepareAgreementSigning,
  approveAgreementSigning,
  signPortalAgreement,
  getFounderSigning,
  getPortalSigning,
  listFounderSigning,
  listPortalSigning,
  downloadFounderSigningArtifact,
  downloadPortalSigningArtifact,
} from "../../../lib/operations/agreements/signing-service";
import { completeAgreementSigning } from "../../../lib/operations/agreements/signing-worker";

import {
  signingHash,
  signingAudit,
} from "../../../lib/operations/agreements/signing-render";

test("preparation retains exact source in new revision and requires separate founder approval", async (t) => {
  const f = await signingFixture(t);
  const p = await f.prepare();
  assert.equal(p.status, "prepared");
  assert.equal(p.revision, 2);
  assert.equal(p.agreementVersion, 2);
  assert.notEqual(p.sourceHash, f.draft.documentHash);
  assert.equal(p.sourceHash, p.draft.documentHash);
  const file = await downloadFounderSigningArtifact(
    f.founderDb,
    f.founder,
    f.organisationId,
    p.id,
    "source",
    f.correlationId,
  );
  assert.ok(file);
  assert.equal(signingHash(file.bytes), p.sourceHash);
  assert.equal(file.contentType, "application/pdf");
  assert.equal(
    await getPortalSigning(
      f.portal,
      f.identities[0],
      f.organisationId,
      p.id,
      f.correlationId,
    ),
    null,
  );
  assert.equal(
    (
      await listFounderSigning(
        f.founderDb,
        f.founder,
        f.organisationId,
        f.correlationId,
      )
    ).length,
    1,
  );
  assert.equal(
    (
      await listPortalSigning(
        f.portal,
        f.identities[0],
        f.organisationId,
        f.correlationId,
      )
    ).length,
    0,
  );
  const approved = await f.approve(p);
  assert.equal(approved.status, "approved");
  assert.ok(approved.approvedAt);
  assert.equal(
    (
      await listPortalSigning(
        f.portal,
        f.identities[0],
        f.organisationId,
        f.correlationId,
      )
    ).length,
    1,
  );
});
test("founder authorization, version and approval hash cannot be skipped", async (t) => {
  const f = await signingFixture(t);
  const p = await f.prepare();
  await assert.rejects(
    prepareAgreementSigning(
      f.founderDb,
      null,
      f.organisationId,
      { agreementId: f.record.id, expectedVersion: 2 },
      f.correlationId,
    ),
    /Founder authorization/,
  );
  await assert.rejects(f.prepare(), /changed/);
  await assert.rejects(
    approveAgreementSigning(
      f.founderDb,
      f.founder,
      f.organisationId,
      {
        approvalId: p.id,
        approvalHash: "f".repeat(64),
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      },
      f.correlationId,
    ),
    /changed/,
  );
  for (const expiresAt of [
    "2020-01-01T00:00:00.000Z",
    "2099-01-01T00:00:00.000Z",
  ])
    await assert.rejects(
      approveAgreementSigning(
        f.founderDb,
        f.founder,
        f.organisationId,
        { approvalId: p.id, approvalHash: p.approvalHash, expiresAt },
        f.correlationId,
      ),
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
    "prepared",
  );
});
test("partial signatures never complete or expose signed artifacts", async (t) => {
  const f = await signingFixture(t);
  const p = await f.approve(await f.prepare());
  await f.sign(p);
  assert.equal(
    await completeAgreementSigning(f.worker, p.id, f.correlationId),
    false,
  );
  assert.equal(
    await downloadPortalSigningArtifact(
      f.portal,
      f.identities[0],
      f.organisationId,
      p.id,
      "signed",
      f.correlationId,
    ),
    null,
  );
  const [a] =
    await f.admin`select status from operations.agreements where id=${f.record.id}`;
  assert.equal(a.status, "draft");
});
test("concurrent signers and completion retries produce one immutable signed record and outbox", async (t) => {
  const f = await signingFixture(t);
  const p = await f.approve(await f.prepare());
  await Promise.all([f.sign(p, 0), f.sign(p, 1)]);
  const results = await Promise.all([
    completeAgreementSigning(f.worker, p.id, f.correlationId),
    completeAgreementSigning(f.worker, p.id, randomUUID()),
  ]);
  assert.deepEqual(results.sort(), [false, true]);
  const done = await getPortalSigning(
    f.portal,
    f.identities[0],
    f.organisationId,
    p.id,
    f.correlationId,
  );
  assert.ok(done);
  assert.equal(done.status, "completed");
  assert.equal(done.signatures.length, 2);
  assert.ok(done.completedAt);
  for (const kind of ["source", "signed", "audit"] as const) {
    const artifact = await downloadPortalSigningArtifact(
      f.portal,
      f.identities[0],
      f.organisationId,
      p.id,
      kind,
      f.correlationId,
    );
    assert.ok(artifact);
    assert.equal(signingHash(artifact.bytes), artifact.hash);
    if (kind === "audit")
      assert.deepEqual(
        JSON.parse(artifact.bytes.toString()),
        JSON.parse(signingAudit(done).toString()),
      );
  }
  const [e] =
    await f.admin`select provenance,created_by from operations.signature_evidence where agreement_id=${f.record.id}`;
  assert.equal(e.provenance, "authenticated_portal_electronic_signature");
  assert.equal(e.created_by, "system:operations-signing");
  const outbox =
    await f.admin`select * from operations.signing_completion_outbox where id=${p.id}`;
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0].financial_snapshot.documentHash, p.sourceHash);
  assert.equal(
    await completeAgreementSigning(f.worker, p.id, f.correlationId),
    false,
  );
  await f.sign(p, 0);
  assert.equal(
    (
      await f.admin`select * from operations.signing_signatures where approval_id=${p.id}`
    ).length,
    2,
  );
});
test("duplicate concurrent consent is idempotent, altered signature is rejected", async (t) => {
  const f = await signingFixture(t);
  const p = await f.approve(await f.prepare());
  await Promise.all([f.sign(p), f.sign(p)]);
  assert.equal(
    (
      await f.admin`select * from operations.signing_signatures where approval_id=${p.id}`
    ).length,
    1,
  );
  await assert.rejects(
    signPortalAgreement(
      f.portal,
      f.identities[0],
      f.organisationId,
      {
        approvalId: p.id,
        approvalHash: p.approvalHash,
        typedName: "Changed Name",
        authority: true,
        consent: true,
      },
      f.correlationId,
    ),
  );
});
