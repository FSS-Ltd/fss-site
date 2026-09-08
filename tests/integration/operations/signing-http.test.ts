import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { signingFixture } from "./signing-fixtures";
import {
  createSigningCommandHandler,
  createSigningDownloadHandler,
} from "../../../lib/operations/agreements/signing-http";
import {
  executeFounderSigningCommand,
  executePortalSigningCommand,
} from "../../../lib/operations/agreements/signing-commands";
import { downloadPortalSigningArtifact } from "../../../lib/operations/agreements/signing-service";
import { completeAgreementSigning } from "../../../lib/operations/agreements/signing-worker";
import type { SigningApproval } from "../../../lib/operations/agreements/signing-types";
function request(command: object) {
  return new Request("https://fss.test/signing", {
    method: "POST",
    headers: { origin: "https://fss.test", "content-type": "application/json" },
    body: JSON.stringify(command),
  });
}
test("founder approval through HTTP enables exact portal consent and a private completed download", async (t) => {
  const f = await signingFixture(t, 1);
  const config = {
    enabled: true,
    origin: "https://fss.test",
    createCorrelationId: randomUUID,
    reportUnexpectedError: () => assert.fail("Unexpected signing HTTP failure"),
  };
  const founder = createSigningCommandHandler({
    ...config,
    authorize: async () => f.founder,
    execute: (identity, org, command, correlation) =>
      executeFounderSigningCommand(
        f.founderDb,
        identity,
        org,
        command,
        correlation,
      ),
  });
  const preparedResponse = await founder(
    request({
      action: "prepare",
      agreementId: f.record.id,
      expectedVersion: 1,
    }),
    f.organisationId,
  );
  assert.equal(preparedResponse.status, 200);
  const { approval }: { approval: SigningApproval } =
    await preparedResponse.json();
  assert.equal(approval.organisationLegalName, "Signing Test Limited");
  const approvedResponse = await founder(
    request({
      action: "approve",
      approvalId: approval.id,
      approvalHash: approval.approvalHash,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    }),
    f.organisationId,
  );
  assert.equal(approvedResponse.status, 200);
  const portal = createSigningCommandHandler({
    ...config,
    authorize: async () => f.identities[0],
    execute: (identity, org, command, correlation) =>
      executePortalSigningCommand(
        f.portal,
        identity,
        org,
        command,
        correlation,
      ),
  });
  const consent = {
    action: "sign",
    approvalId: approval.id,
    approvalHash: approval.approvalHash,
    typedName: "Client Representative",
    authority: true,
    consent: true,
  };
  assert.equal(
    (await portal(request({ ...consent, consent: false }), f.organisationId))
      .status,
    422,
  );
  assert.equal(
    (
      await portal(
        request({ ...consent, approvalHash: "f".repeat(64) }),
        f.organisationId,
      )
    ).status,
    409,
  );
  assert.equal((await portal(request(consent), f.organisationId)).status, 200);
  assert.equal((await portal(request(consent), f.organisationId)).status, 200);
  assert.equal(
    await completeAgreementSigning(f.worker, approval.id, randomUUID()),
    true,
  );
  const download = createSigningDownloadHandler({
    ...config,
    authorize: async () => f.identities[0],
    download: (identity, org, id, kind, correlation) =>
      downloadPortalSigningArtifact(
        f.portal,
        identity,
        org,
        id,
        kind,
        correlation,
      ),
  });
  const pdf = await download(
    new Request("https://fss.test/download"),
    f.organisationId,
    approval.id,
    "signed",
  );
  assert.equal(pdf.status, 200);
  assert.equal(
    Buffer.from(await pdf.arrayBuffer())
      .subarray(0, 5)
      .toString(),
    "%PDF-",
  );
  assert.equal(pdf.headers.get("cache-control"), "private, no-store");
  const wrongOrganisation = await download(
    new Request("https://fss.test/download"),
    randomUUID(),
    approval.id,
    "source",
  );
  assert.equal(wrongOrganisation.status, 404);
});
test("HTTP command dispatch preserves decline and founder cancellation lifecycles", async (t) => {
  const f = await signingFixture(t, 1);
  const approval = await f.approve(await f.prepare());
  const declined = await executePortalSigningCommand(
    f.portal,
    f.identities[0],
    f.organisationId,
    {
      action: "decline",
      approvalId: approval.id,
      approvalHash: approval.approvalHash,
    },
    randomUUID(),
  );
  assert.equal(declined.status, "declined");
  const other = await signingFixture(t, 1);
  const prepared = await other.prepare();
  const cancelled = await executeFounderSigningCommand(
    other.founderDb,
    other.founder,
    other.organisationId,
    { action: "cancel", approvalId: prepared.id },
    randomUUID(),
  );
  assert.equal(cancelled.status, "cancelled");
});
