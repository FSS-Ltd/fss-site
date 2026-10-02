import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { PortalAccessDenied } from "../auth/types";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import { preparedWelcomeFixture } from "./fixtures";
import {
  downloadClientWelcomePacket,
  loadClientWelcomePacket,
} from "./client-packet";
import { createClientWelcomePacketDownloadHandler } from "./client-packet-http";

const organisationId = "73da6acb-e24f-4e2f-bd90-13d58634ad39";
const approvalId = "fbe3b65b-1d8c-4ffd-8f7d-fcb7a56d72cb";
const correlationId = "3d5080ee-fb31-4123-a695-36ef22c09a36";
const identity = {
  userId: "71c08b58-09ba-4de9-a08c-e036f482859e",
  email: "client@example.test",
  emailVerified: true as const,
};

function scopedDb(options: {
  role?: string;
  packet?: unknown;
  pdf?: Buffer;
  hash?: string;
  scopedOrganisation?: string;
}): OperationsDb {
  let selectedOrganisation: unknown;
  const query = Object.assign(
    async (parts: TemplateStringsArray, ...values: unknown[]) => {
      const sql = parts.join("?");
      if (sql.includes("current_user")) return [{ name: "operations_portal" }];
      if (sql.includes("set_config('operations.organisation_id'"))
        selectedOrganisation = values[0];
      if (sql.includes("from operations.memberships"))
        return selectedOrganisation ===
          (options.scopedOrganisation ?? organisationId)
          ? [{ userId: identity.userId, role: options.role ?? "owner" }]
          : [];
      if (sql.includes("read_client_welcome_packet_pdf")) {
        assert.deepEqual(values, [organisationId, approvalId]);
        return options.pdf ? [{ pdf: options.pdf, hash: options.hash }] : [];
      }
      if (sql.includes("read_client_welcome_packet")) {
        assert.deepEqual(values, [organisationId]);
        return [{ packet: options.packet ?? null }];
      }
      return [];
    },
    { json: (value: unknown) => JSON.stringify(value) },
  );
  // This minimal transaction double returns SQL rows; authorization uses the real portal transaction.
  return {
    begin: async (run: (tx: OperationsTransaction) => Promise<unknown>) =>
      run(query as unknown as OperationsTransaction),
  } as unknown as OperationsDb;
}

test("projects retained legacy content without exposing approval recipient or invoice data", async () => {
  const { snapshot } = await preparedWelcomeFixture();
  const packet = await loadClientWelcomePacket(
    scopedDb({
      packet: {
        approvalId,
        approvedAt: "2026-10-01T09:00:00Z",
        content: snapshot.content,
      },
    }),
    identity,
    organisationId,
    correlationId,
  );
  assert.equal(
    packet?.title,
    "Faithful Software Solutions: your welcome guide",
  );
  assert.deepEqual(packet?.pages, snapshot.content.pages);
  assert.doesNotMatch(
    JSON.stringify(packet),
    /acct_|obligationKey|recipient|replyTo|\"from\"/,
  );
});

test("packet reads deny missing identity, cross-organisation access and billing-only membership", async () => {
  await assert.rejects(
    loadClientWelcomePacket(scopedDb({}), null, organisationId, correlationId),
    PortalAccessDenied,
  );
  await assert.rejects(
    loadClientWelcomePacket(
      scopedDb({}),
      identity,
      "1317ae3c-e4ba-4397-849c-d106de331d38",
      correlationId,
    ),
    PortalAccessDenied,
  );
  await assert.rejects(
    loadClientWelcomePacket(
      scopedDb({ role: "billing_contact" }),
      identity,
      organisationId,
      correlationId,
    ),
    PortalAccessDenied,
  );
  assert.equal(
    await loadClientWelcomePacket(
      scopedDb({}),
      identity,
      organisationId,
      correlationId,
    ),
    null,
  );
});

test("downloads original approved PDF bytes and rejects corrupt retained artifacts", async () => {
  const { pdf, snapshot } = await preparedWelcomeFixture();
  const artifact = await downloadClientWelcomePacket(
    scopedDb({ pdf, hash: snapshot.pdfHash }),
    identity,
    organisationId,
    approvalId,
    correlationId,
  );
  assert.deepEqual(artifact?.pdf, pdf);
  await assert.rejects(
    downloadClientWelcomePacket(
      scopedDb({ pdf, hash: "a".repeat(64) }),
      identity,
      organisationId,
      approvalId,
      correlationId,
    ),
    /RetainedWelcomePacketMismatch/,
  );
});

test("authenticated PDF response preserves approved bytes and forbids caching", async () => {
  const { pdf } = await preparedWelcomeFixture();
  const handler = createClientWelcomePacketDownloadHandler({
    enabled: true,
    createCorrelationId: () => correlationId,
    authorize: async () => identity,
    download: async () => ({
      pdf,
      hash: createHash("sha256").update(pdf).digest("hex"),
    }),
    reportUnexpectedError: () => undefined,
  });
  const response = await handler(organisationId, approvalId);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(response.headers.get("Content-Type"), "application/pdf");
  assert.match(response.headers.get("Content-Disposition") ?? "", /attachment/);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), pdf);
});

test("download hides unavailable, unauthorised and malformed identifiers", async () => {
  for (const [authorize, download, expected] of [
    [async () => null, async () => null, 401],
    [async () => identity, async () => null, 404],
    [
      async () => identity,
      async () => {
        throw new PortalAccessDenied();
      },
      404,
    ],
    [
      async () => identity,
      async () => {
        throw Object.assign(new Error("private database detail"), {
          code: "42501",
        });
      },
      404,
    ],
  ] as const) {
    const handler = createClientWelcomePacketDownloadHandler({
      enabled: true,
      createCorrelationId: () => correlationId,
      authorize,
      download,
      reportUnexpectedError: () => undefined,
    });
    const response = await handler(organisationId, approvalId);
    assert.equal(response.status, expected);
    assert.doesNotMatch(await response.text(), /private database detail/);
    assert.equal(
      (await handler(organisationId, "invalid")).status,
      expected === 401 ? 401 : 404,
    );
  }
});
