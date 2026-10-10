import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  commercialOfferRouteConfiguration,
  createCommercialOfferRouteHandler,
} from "./commercial-offer-route";
import { AgreementConflict } from "../agreements/types";
import { PortalAccessDenied } from "../auth/types";
import { agreementDraft } from "../agreements/fixtures";
import type { CommercialOffer } from "../agreements/commercial-types";
const organisationId = randomUUID();
const offer: CommercialOffer = {
  id: randomUUID(),
  organisationId,
  engagementId: randomUUID(),
  version: 1,
  status: "published",
  draft: agreementDraft(),
  spec: { cash: { mode: "fixed" }, revenueShare: null },
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  selection: null,
  rejectionReason: null,
  approvalId: null,
  agreementId: null,
};
function request(origin = "https://example.test", body = "{}") {
  return new Request("https://example.test/api", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body,
  });
}
function requestAt(
  urlOrigin: string,
  requestOrigin: string | undefined,
): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (requestOrigin) headers.set("origin", requestOrigin);
  return new Request(`${urlOrigin}/api`, {
    method: "POST",
    headers,
    body: "{}",
  });
}
function handler(
  execute: () => Promise<CommercialOffer> = async () => offer,
  authorized = true,
) {
  return createCommercialOfferRouteHandler({
    enabled: true,
    origin: "https://example.test",
    authorize: async () => (authorized ? { userId: randomUUID() } : null),
    createCorrelationId: randomUUID,
    execute,
    reportUnexpectedError: () => {},
  });
}
test("commercial command authenticates, enforces origin, and returns private response", async () => {
  assert.equal(
    (await handler()(request("https://other.test"), organisationId)).status,
    403,
  );
  assert.equal(
    (await handler(undefined, false)(request(), organisationId)).status,
    401,
  );
  const response = await handler()(request(), organisationId);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.equal((await response.json()).offer.id, offer.id);
});
test("commercial commands accept the configured portal origin, not the public site origin", async () => {
  const portalOrigin = "https://portal.example.test";
  const configuration = commercialOfferRouteConfiguration({
    OPERATIONS_ENABLED: "true",
    OPERATIONS_SIGNING_ENABLED: "true",
    OPERATIONS_PORTAL_ORIGIN: portalOrigin,
    NEXT_PUBLIC_SITE_URL: "https://example.test",
  });
  let executed = 0;
  const handler = createCommercialOfferRouteHandler({
    ...configuration,
    authorize: async () => ({ userId: randomUUID() }),
    execute: async () => {
      executed += 1;
      return offer;
    },
    reportUnexpectedError: () => {},
  });

  assert.equal(configuration.origin, portalOrigin);
  assert.equal((await handler(requestAt(portalOrigin, portalOrigin), organisationId)).status, 200);
  assert.equal((await handler(requestAt(portalOrigin, undefined), organisationId)).status, 403);
  assert.equal((await handler(requestAt(portalOrigin, "https://forged.example"), organisationId)).status, 403);
  assert.equal((await handler(requestAt("https://example.test", "https://example.test"), organisationId)).status, 403);
  assert.equal((await handler(requestAt("https://forged.example", portalOrigin), organisationId)).status, 403);
  assert.equal(executed, 1);
});

test("conflicts and unavailable offers return safe scoped failures", async () => {
  assert.equal(
    (
      await handler(async () => {
        throw new AgreementConflict();
      })(request(), organisationId)
    ).status,
    409,
  );
  assert.equal(
    (
      await handler(async () => {
        throw new PortalAccessDenied();
      })(request(), organisationId)
    ).status,
    404,
  );
  const response = await handler(async () => {
    throw new Error("private-database-details");
  })(request(), organisationId);
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private-database-details/);
});
test("invalid JSON and body limits fail before execution", async () => {
  assert.equal(
    (await handler()(request("https://example.test", "{"), organisationId))
      .status,
    400,
  );
  assert.equal(
    (
      await handler()(
        request(
          "https://example.test",
          JSON.stringify({ payload: "x".repeat(70 * 1024) }),
        ),
        organisationId,
      )
    ).status,
    413,
  );
});
