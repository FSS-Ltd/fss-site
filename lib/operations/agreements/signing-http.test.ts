import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import {
  createSigningCommandHandler,
  createSigningDownloadHandler,
} from "./signing-http";
import { AgreementConflict } from "./types";
import { PortalAccessDenied } from "../auth/types";
import type { SigningApproval } from "./signing-types";
const organisationId = "11111111-1111-4111-8111-111111111111";
const config = {
  enabled: true,
  origin: "https://fss.test",
  authorize: async () => ({ userId: "verified-user" }),
  createCorrelationId: () => "correlation",
  reportUnexpectedError: () => {},
};
function request(
  body = "{}",
  origin = "https://fss.test",
  contentType = "application/json",
) {
  return new Request("https://fss.test/signing", {
    method: "POST",
    headers: { origin, "content-type": contentType },
    body,
  });
}
const unused = async (): Promise<SigningApproval> => {
  throw new Error("unexpected execution");
};
test("signing HTTP rejects disabled, foreign-origin, unsupported and unauthenticated writes before execution", async () => {
  assert.equal(
    (
      await createSigningCommandHandler({
        ...config,
        enabled: false,
        execute: unused,
      })(request(), organisationId)
    ).status,
    404,
  );
  assert.equal(
    (
      await createSigningCommandHandler({ ...config, execute: unused })(
        request("{}", "https://evil.test"),
        organisationId,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await createSigningCommandHandler({ ...config, execute: unused })(
        request("{}", config.origin, "text/plain"),
        organisationId,
      )
    ).status,
    415,
  );
  assert.equal(
    (
      await createSigningCommandHandler({
        ...config,
        authorize: async () => null,
        execute: unused,
      })(request(), organisationId)
    ).status,
    401,
  );
});
test("signing HTTP bounds body, validates scope and enforces rate limits", async () => {
  const handler = createSigningCommandHandler({ ...config, execute: unused });
  assert.equal((await handler(request(), "invalid")).status, 422);
  assert.equal((await handler(request("{"), organisationId)).status, 400);
  assert.equal(
    (
      await handler(
        request(JSON.stringify({ value: "x".repeat(17000) })),
        organisationId,
      )
    ).status,
    413,
  );
  assert.equal(
    (
      await createSigningCommandHandler({
        ...config,
        execute: unused,
        consumeRateLimit: async () => false,
      })(request(), organisationId)
    ).status,
    429,
  );
});
test("signing HTTP protects denial and unexpected errors, and reports stale approvals", async () => {
  for (const [error, status] of [
    [new PortalAccessDenied(), 404],
    [new AgreementConflict(), 409],
    [z.uuid().safeParse("bad").error, 422],
    [new Error("secret database value"), 503],
  ] as const) {
    const response = await createSigningCommandHandler({
      ...config,
      execute: async () => {
        throw error;
      },
    })(request(), organisationId);
    assert.equal(response.status, status);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.ok(!(await response.text()).includes("secret database value"));
  }
});
test("private signing download checks identity and never caches or serves executable content inline", async () => {
  const download = async () => ({
    bytes: Buffer.from("%PDF-test"),
    hash: "a".repeat(64),
    contentType: "application/pdf" as const,
    filename: "ignored.pdf",
  });
  const handler = createSigningDownloadHandler({ ...config, download });
  const response = await handler(
    new Request("https://fss.test"),
    organisationId,
    organisationId,
    "source",
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(
    response.headers.get("content-disposition"),
    'attachment; filename="agreement-source.pdf"',
  );
  assert.equal(
    (
      await handler(
        new Request("https://fss.test"),
        organisationId,
        organisationId,
        "arbitrary",
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await createSigningDownloadHandler({
        ...config,
        authorize: async () => null,
        download,
      })(
        new Request("https://fss.test"),
        organisationId,
        organisationId,
        "source",
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await createSigningDownloadHandler({
        ...config,
        download: async () => null,
      })(
        new Request("https://fss.test"),
        organisationId,
        organisationId,
        "signed",
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await createSigningDownloadHandler({
        ...config,
        download: async () => {
          throw new PortalAccessDenied();
        },
      })(
        new Request("https://fss.test"),
        organisationId,
        organisationId,
        "source",
      )
    ).status,
    404,
  );
});
