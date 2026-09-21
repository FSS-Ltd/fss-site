import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { requireOperationsTestDatabaseUrl } from "../../../scripts/require-operations-database-env";
import { withAgreementTransaction } from "../../../lib/operations/agreements/repository";
import { executeProjectCommand } from "../../../lib/operations/projects/service";
import {
  getPortalProject,
  listPortalProjects,
} from "../../../lib/operations/projects/repository";
import { executeDocumentCommand } from "../../../lib/operations/documents/service";
import {
  getPortalDocumentDetail,
  listProjectDocuments,
  getAuthorisedDocumentDownload,
} from "../../../lib/operations/documents/repository";
import { withPortalTransaction } from "../../../lib/operations/db/portal-client";
import {
  createDeliveryFixture,
  deliveryFounder,
  projectMetadata,
  removeDeliveryFixture,
} from "./project-document-fixtures";

const url = requireOperationsTestDatabaseUrl(
  process.env.OPERATIONS_TEST_DATABASE_URL,
);
test("real portal role exposes only scoped public delivery metadata and rechecks live access on pool reuse", async () => {
  const admin = postgres(url, { max: 1 });
  const founder = postgres(url, {
    max: 1,
    connection: { options: "-c role=operations_founder" },
  });
  const portal = postgres(url, {
    max: 1,
    connection: { options: "-c role=operations_portal" },
  });
  const a = await createDeliveryFixture(admin, founder);
  const b = await createDeliveryFixture(admin, founder);
  const execute = (raw: unknown) =>
    executeProjectCommand(
      founder,
      deliveryFounder,
      a.organisationId,
      raw,
      a.correlationId,
    );
  const read = (id: string) =>
    getPortalProject(portal, a.identity, a.organisationId, id, a.correlationId);
  const documents = (id: string) =>
    listProjectDocuments(
      portal,
      a.identity,
      a.organisationId,
      id,
      a.correlationId,
    );
  const download = (id: string) =>
    getAuthorisedDocumentDownload(
      portal,
      a.identity,
      a.organisationId,
      id,
      a.correlationId,
    );
  const documentDetail = (id: string) =>
    getPortalDocumentDetail(
      portal,
      a.identity,
      a.organisationId,
      id,
      a.correlationId,
    );
  const writeDocument = (raw: unknown) =>
    executeDocumentCommand(
      founder,
      deliveryFounder,
      a.organisationId,
      raw,
      a.correlationId,
    );
  try {
    assert.deepEqual(
      await listPortalProjects(
        portal,
        a.identity,
        a.organisationId,
        a.correlationId,
      ),
      [],
    );
    await assert.rejects(
      execute({
        action: "create",
        metadata: { ...projectMetadata(a), agreementId: b.agreementId },
        reviewReference: "wrong scope",
      }),
      { code: "23503" },
    );
    let project = await execute({
      action: "create",
      metadata: projectMetadata(a),
      reviewReference: "review",
    });
    const other = await executeProjectCommand(
      founder,
      deliveryFounder,
      b.organisationId,
      {
        action: "create",
        metadata: projectMetadata(b),
        reviewReference: "review",
      },
      b.correlationId,
    );
    assert.equal(await read(other.id), null);
    assert.equal(await read(randomUUID()), null);
    const view = await read(project.id);
    assert.equal(view?.targetDate, null);
    assert.deepEqual(view?.scheduleDependencies, ["Client assets"]);
    assert.deepEqual(view?.milestones, []);
    assert.equal(JSON.stringify(view).includes("internal"), false);
    assert.equal(JSON.stringify(view).includes("margin"), false);
    await assert.rejects(
      withPortalTransaction(
        portal,
        a.identity,
        a.organisationId,
        a.correlationId,
        async (tx) => tx`select internal_notes from operations.projects`,
      ),
      { code: "42501" },
    );
    await assert.rejects(
      withPortalTransaction(
        portal,
        a.identity,
        a.organisationId,
        a.correlationId,
        async (tx) =>
          tx`select internal_estimate_minutes from operations.projects`,
      ),
      { code: "42501" },
    );
    project = await execute({
      action: "milestone",
      projectId: project.id,
      expectedVersion: project.version,
      milestoneId: null,
      metadata: {
        title: "Content",
        summary: "Content review",
        ownerDisplay: "Client",
        status: "waiting_for_you",
        targetDate: null,
        evidence: null,
        position: 0,
      },
      reviewReference: "milestone review",
    });
    assert.equal((await read(project.id))?.milestones[0].targetDate, null);
    await assert.rejects(
      execute({
        action: "update",
        projectId: project.id,
        expectedVersion: 1,
        metadata: projectMetadata(a),
        reviewReference: "stale",
      }),
      /changed/,
    );
    const milestoneId = (await read(project.id))!.milestones[0].id;
    project = await execute({
      action: "milestone",
      projectId: project.id,
      expectedVersion: project.version,
      milestoneId,
      metadata: {
        title: "Content",
        summary: "Approved",
        ownerDisplay: "Client",
        status: "completed",
        targetDate: null,
        evidence: "Client approval",
        position: 0,
      },
      reviewReference: "reviewed",
    });
    const linkId = randomUUID();
    await writeDocument({
      action: "create",
      documentId: linkId,
      reviewReference: "approved link",
      metadata: {
        kind: "link",
        projectId: project.id,
        milestoneId,
        title: "Deliverable",
        visibility: "client",
        expiresAt: null,
        url: "https://example.test/deliverable",
      },
    });
    const linkDetail = await documentDetail(linkId);
    assert.equal(linkDetail?.kind, "link");
    assert.equal(linkDetail?.projectId, project.id);
    assert.equal(linkDetail?.version, 1);
    assert.equal(JSON.stringify(linkDetail).includes("review"), false);
    assert.equal(JSON.stringify(linkDetail).includes("scan"), false);
    const fileId = randomUUID();
    const metadata = {
      kind: "file",
      projectId: project.id,
      milestoneId: null,
      title: "Guide",
      visibility: "client",
      expiresAt: null,
      filename: "guide.pdf",
      mimeType: "application/pdf",
      sizeBytes: 32,
      contentHash: "a".repeat(64),
      scanStatus: "quarantined",
      scanContentHash: null,
      scanEvidence: null,
    };
    await writeDocument({
      action: "create",
      documentId: fileId,
      metadata,
      reviewReference: "registered quarantined",
    });
    assert.equal(await download(fileId), null);
    assert.equal(await documentDetail(fileId), null);
    assert.equal((await documents(project.id)).length, 1);
    await writeDocument({
      action: "update",
      documentId: fileId,
      expectedVersion: 1,
      metadata: {
        ...metadata,
        scanStatus: "cleared",
        scanContentHash: metadata.contentHash,
        scanEvidence: "Independent scan result for the recorded SHA256",
      },
      reviewReference: "scan reviewed",
    });
    assert.equal(
      (await download(fileId))?.objectKey,
      `operations/${a.organisationId}/${fileId}/${metadata.contentHash}`,
    );
    const fileDetail = await documentDetail(fileId);
    assert.deepEqual(
      fileDetail && {
        filename: fileDetail.kind === "file" ? fileDetail.filename : null,
        id: fileDetail.id,
        kind: fileDetail.kind,
        mimeType: fileDetail.kind === "file" ? fileDetail.mimeType : null,
        projectId: fileDetail.projectId,
        sizeBytes: fileDetail.kind === "file" ? fileDetail.sizeBytes : null,
        version: fileDetail.version,
      },
      {
        filename: "guide.pdf",
        id: fileId,
        kind: "file",
        mimeType: "application/pdf",
        projectId: project.id,
        sizeBytes: 32,
        version: 2,
      },
    );
    assert.equal(JSON.stringify(fileDetail).includes("objectKey"), false);
    assert.equal(JSON.stringify(fileDetail).includes("contentHash"), false);
    assert.equal(JSON.stringify(fileDetail).includes("scan"), false);
    // Database checks independently bind scan approval, bytes and object identity.
    for (const column of ["object_key", "scan_content_hash", "content_hash"]) {
      await assert.rejects(
        withAgreementTransaction(founder, deliveryFounder, async (tx) => {
          await tx.unsafe(
            `update operations.documents set ${column}=null where id=$1`,
            [fileId],
          );
        }),
        { code: "23514" },
      );
    }
    await assert.rejects(
      withAgreementTransaction(founder, deliveryFounder, async (tx) => {
        await tx`update operations.documents set scan_content_hash=${"b".repeat(64)} where id=${fileId}`;
      }),
      { code: "23514" },
    );
    await assert.rejects(
      withAgreementTransaction(founder, deliveryFounder, async (tx) => {
        await tx`update operations.documents set project_id=${other.id} where id=${fileId}`;
      }),
      { code: "23503" },
    );
    await assert.rejects(
      withAgreementTransaction(founder, deliveryFounder, async (tx) => {
        await tx`update operations.milestones set project_id=${other.id} where id=${milestoneId}`;
      }),
      { code: "23503" },
    );
    const listed = await documents(project.id);
    assert.equal(listed.length, 2);
    assert.equal(JSON.stringify(listed).includes("objectKey"), false);
    assert.equal(JSON.stringify(listed).includes(metadata.contentHash), false);
    assert.equal(await download(linkId), null);
    assert.equal(
      await getAuthorisedDocumentDownload(
        portal,
        b.identity,
        b.organisationId,
        fileId,
        b.correlationId,
      ),
      null,
    );
    assert.equal(
      await getPortalDocumentDetail(
        portal,
        b.identity,
        b.organisationId,
        fileId,
        b.correlationId,
      ),
      null,
    );
    assert.deepEqual(await documents(other.id), []);
    for (const role of ["owner", "contributor", "viewer"]) {
      await admin`update operations.memberships set role=${role} where organisation_id=${a.organisationId}`;
      assert.ok(await read(project.id));
      assert.ok(await download(fileId));
    }
    await admin`update operations.memberships set role='billing_contact' where organisation_id=${a.organisationId}`;
    await assert.rejects(read(project.id), /Portal access/);
    await assert.rejects(download(fileId), /Portal access/);
    await withPortalTransaction(
      portal,
      a.identity,
      a.organisationId,
      a.correlationId,
      async (tx) =>
        assert.equal((await tx`select id from operations.projects`).length, 0),
    );
    await admin`update operations.memberships set role='owner' where organisation_id=${a.organisationId}`;
    await writeDocument({
      action: "update",
      documentId: fileId,
      expectedVersion: 2,
      metadata: {
        ...metadata,
        scanStatus: "cleared",
        scanContentHash: metadata.contentHash,
        scanEvidence: "Review",
        expiresAt: "2000-01-01T00:00:00Z",
      },
      reviewReference: "expired",
    });
    assert.equal(await download(fileId), null);
    assert.equal(await documentDetail(fileId), null);
    await writeDocument({
      action: "revoke",
      documentId: linkId,
      expectedVersion: 1,
      reviewReference: "revoked",
    });
    assert.deepEqual(await documents(project.id), []);
    assert.equal(await documentDetail(linkId), null);
    await assert.rejects(
      writeDocument({
        action: "revoke",
        documentId: linkId,
        expectedVersion: 2,
        reviewReference: "again",
      }),
      /changed/,
    );
    project = await execute({
      action: "update",
      projectId: project.id,
      expectedVersion: project.version,
      metadata: { ...projectMetadata(a), visibility: "internal" },
      reviewReference: "withheld",
    });
    assert.equal(await read(project.id), null);
    assert.deepEqual(await documents(project.id), []);
    await admin`update operations.memberships set revoked_at=now() where organisation_id=${a.organisationId}`;
    await assert.rejects(read(project.id), /Portal access/);
    await assert.rejects(download(fileId), /Portal access/);
    assert.equal((await portal`select id from operations.projects`).length, 0);
    assert.equal((await portal`select id from operations.documents`).length, 0);
    const [audit] = await admin<
      { count: number }[]
    >`select count(*)::int as count from operations.audit_events where organisation_id=${a.organisationId} and action in ('project.created','project.updated','milestone.created','milestone.updated','document.created','document.updated') and actor_id=${deliveryFounder.actorId} and correlation_id=${a.correlationId}`;
    assert.ok(audit.count >= 10);
  } finally {
    await portal.end();
    await founder.end();
    await removeDeliveryFixture(admin, a);
    await removeDeliveryFixture(admin, b);
    await admin.end();
  }
});
