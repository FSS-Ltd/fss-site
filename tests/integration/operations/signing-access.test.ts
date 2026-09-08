import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { signingFixture } from "./signing-fixtures";
import {
  signPortalAgreement,
  getFounderSigning,
  getPortalSigning,
  downloadFounderSigningArtifact,
  downloadPortalSigningArtifact,
} from "../../../lib/operations/agreements/signing-service";
import {
  completeAgreementSigning,
  runSigningCompletionWorker,
} from "../../../lib/operations/agreements/signing-worker";

import {
  signingAudit,
  renderSignedAgreement,
} from "../../../lib/operations/agreements/signing-render";
import { withPortalTransaction } from "../../../lib/operations/db/portal-client";
import { withAgreementTransaction } from "../../../lib/operations/agreements/repository";

test("wrong email, unknown identity and cross-organisation access cannot read or sign", async (t) => {
  const f = await signingFixture(t);
  const p = await f.approve(await f.prepare());
  for (const identity of [
    null,
    { ...f.identities[0], userId: randomUUID() },
    { ...f.identities[0], email: "other@example.test" },
  ]) {
    await assert.rejects(
      signPortalAgreement(
        f.portal,
        identity,
        f.organisationId,
        {
          approvalId: p.id,
          approvalHash: p.approvalHash,
          typedName: "Someone",
          authority: true,
          consent: true,
        },
        f.correlationId,
      ),
    );
  }
  await assert.rejects(
    getPortalSigning(
      f.portal,
      f.identities[0],
      randomUUID(),
      p.id,
      f.correlationId,
    ),
  );
  assert.equal(
    await getPortalSigning(
      f.portal,
      { ...f.identities[0], email: "other@example.test" },
      f.organisationId,
      p.id,
      f.correlationId,
    ),
    null,
  );
  assert.equal(
    await downloadPortalSigningArtifact(
      f.portal,
      { ...f.identities[0], email: "other@example.test" },
      f.organisationId,
      p.id,
      "source",
      f.correlationId,
    ),
    null,
  );
});
test("revoked member cannot sign or download even with previously loaded approval", async (t) => {
  const f = await signingFixture(t);
  const p = await f.approve(await f.prepare());
  await f.admin`update operations.memberships set revoked_at=now() where user_id=${f.identities[0].userId}`;
  await assert.rejects(f.sign(p));
  await assert.rejects(
    downloadPortalSigningArtifact(
      f.portal,
      f.identities[0],
      f.organisationId,
      p.id,
      "source",
      f.correlationId,
    ),
  );
});
test("archived organisation blocks signing and downloads", async (t) => {
  const f = await signingFixture(t);
  const p = await f.approve(await f.prepare());
  await f.admin`update operations.organisations set lifecycle='archived' where id=${f.organisationId}`;
  await assert.rejects(f.sign(p));
  await assert.rejects(
    getPortalSigning(
      f.portal,
      f.identities[0],
      f.organisationId,
      p.id,
      f.correlationId,
    ),
  );
});
test("SQL consent boundary rejects missing confirmations and forged hashes", async (t) => {
  const f = await signingFixture(t);
  const p = await f.approve(await f.prepare());
  for (const c of [
    { hash: "f".repeat(64), name: "Signer", authority: true, consent: true },
    { hash: p.approvalHash, name: "Signer", authority: false, consent: true },
    { hash: p.approvalHash, name: "Signer", authority: true, consent: false },
    { hash: p.approvalHash, name: "x", authority: true, consent: true },
  ])
    await assert.rejects(
      withPortalTransaction(
        f.portal,
        f.identities[0],
        f.organisationId,
        f.correlationId,
        (tx) =>
          tx`select operations.record_agreement_signature(${p.id},${c.hash},${c.name},${c.authority},${c.consent},false)`,
      ),
    );
});
test("runtime roles cannot insert signatures, mutate artifacts or update agreements from portal", async (t) => {
  const f = await signingFixture(t);
  for (const db of [f.portal, f.worker]) {
    await assert.rejects(
      db`update operations.agreements set status='signed',version=version+1`,
      { code: "42501" },
    );
    await assert.rejects(
      db`insert into operations.signing_signatures(approval_id) values(${randomUUID()})`,
      { code: "42501" },
    );
  }
  for (const db of [f.portal, f.worker, f.founderDb]) {
    await assert.rejects(
      db`update operations.signing_approvals set source_pdf=${Buffer.from("forged")}`,
      { code: "42501" },
    );
    await assert.rejects(db`delete from operations.signing_artifacts`, {
      code: "42501",
    });
  }
  await assert.rejects(
    completeAgreementSigning(f.founderDb, randomUUID(), f.correlationId),
    /worker authorization/,
  );
  await assert.rejects(
    runSigningCompletionWorker(f.portal),
    /worker authorization/,
  );
});
test("portal and founder cannot call service completion function", async (t) => {
  const f = await signingFixture(t);
  const p = await f.approve(await f.prepare());
  for (const db of [f.portal, f.founderDb])
    await assert.rejects(
      db`select operations.complete_agreement_signing(${p.id},${Buffer.from("%PDF-x")},${Buffer.from("{}")},${f.correlationId})`,
      { code: "42501" },
    );
});
test("missing private artifacts and unknown agreements do not leak data", async (t) => {
  const f = await signingFixture(t);
  assert.equal(
    await getFounderSigning(
      f.founderDb,
      f.founder,
      f.organisationId,
      randomUUID(),
      f.correlationId,
    ),
    null,
  );
  assert.equal(
    await downloadFounderSigningArtifact(
      f.founderDb,
      f.founder,
      f.organisationId,
      randomUUID(),
      "audit",
      f.correlationId,
    ),
    null,
  );
  assert.equal(
    await completeAgreementSigning(f.worker, randomUUID(), f.correlationId),
    false,
  );
});
test("inhouse provenance cannot be forged by founder manual evidence writes", async (t) => {
  const f = await signingFixture(t);
  const p = await f.approve(await f.prepare());
  await assert.rejects(
    withAgreementTransaction(
      f.founderDb,
      f.founder,
      (tx) =>
        tx`insert into operations.signature_evidence(organisation_id,agreement_id,revision,provenance,evidence,created_by,correlation_id) values(${f.organisationId},${f.record.id},2,'authenticated_portal_electronic_signature',${tx.json({ confirmed: true, sourceHash: p.sourceHash, signedDocumentHash: "f".repeat(64), documentReference: "private:forged.pdf", certificateReference: null, signatories: p.requiredSigners, signedDate: "2026-09-08" })},${f.founder.actorId},${f.correlationId})`,
    ),
  );
});
test("retained PDF generator rejects corrupted source before completion", async (t) => {
  const f = await signingFixture(t);
  const p = await f.approve(await f.prepare());
  await assert.rejects(
    renderSignedAgreement(p, Buffer.from("%PDF-forged"), signingAudit(p)),
    /hash mismatch/,
  );
});

test("unapproved cancelled drafts stay private and unrelated database roles have no signing capabilities", async (t) => {
  const f = await signingFixture(t);
  const p = await f.prepare();
  await withAgreementTransaction(
    f.founderDb,
    f.founder,
    (tx) =>
      tx`select operations.cancel_agreement_signing(${f.organisationId},${p.id},${f.correlationId})`,
  );
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
  for (const role of ["anon", "authenticated", "service_role", "growth_app"]) {
    await assert.rejects(
      f.admin.begin(async (tx) => {
        await tx.unsafe(`set local role ${role}`);
        await tx`select * from operations.signing_approvals`;
      }),
      { code: "42501" },
    );
    await assert.rejects(
      f.admin.begin(async (tx) => {
        await tx.unsafe(`set local role ${role}`);
        await tx`select operations.complete_agreement_signing(${p.id},${Buffer.from("%PDF-x")},${Buffer.from("{}")},${f.correlationId})`;
      }),
      { code: "42501" },
    );
  }
});
