import assert from "node:assert/strict";
import test from "node:test";
import { portalRouteForHost } from "./portal-host";

test("maps the portal hostname root to the portal route", () => {
  assert.equal(
    portalRouteForHost("portal.faithfulsoftware.dev", "/"),
    "/portal",
  );
  assert.equal(
    portalRouteForHost("PORTAL.FAITHFULSOFTWARE.DEV", "/"),
    "/portal",
  );
});

test("does not change public-site or explicit portal routes", () => {
  assert.equal(portalRouteForHost("faithfulsoftware.dev", "/"), null);
  assert.equal(
    portalRouteForHost("portal.faithfulsoftware.dev", "/portal/login"),
    null,
  );
});
