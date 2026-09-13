import assert from "node:assert/strict";
import test from "node:test";
import { getPortalRolePresentation, hasPortalCapability } from "./permissions";
import { portalRoles } from "./types";

test("portal roles preserve billing, delivery and invitation boundaries", () => {
  for (const role of portalRoles) {
    assert.equal(
      hasPortalCapability(role, "billing.read"),
      ["owner", "billing_contact"].includes(role),
    );
    assert.equal(
      hasPortalCapability(role, "billing.manage"),
      ["owner", "billing_contact"].includes(role),
    );
    assert.equal(
      hasPortalCapability(role, "projects.read"),
      role !== "billing_contact",
    );
    assert.equal(
      hasPortalCapability(role, "requests.create"),
      ["owner", "contributor"].includes(role),
    );
    assert.equal(
      hasPortalCapability(role, "requests.comment"),
      ["owner", "contributor"].includes(role),
    );
    assert.equal(
      hasPortalCapability(role, "requests.review"),
      role === "owner",
    );
    assert.equal(
      hasPortalCapability(role, "invites.request"),
      role === "owner",
    );
    assert.equal(
      hasPortalCapability(role, "agreements.read"),
      role === "owner",
    );
    assert.equal(
      hasPortalCapability(role, "agreements.accept"),
      false,
      "signer authorization is separate",
    );
  }
});

test("role descriptions state only capabilities granted by the permission matrix", () => {
  assert.match(
    getPortalRolePresentation("owner").detail,
    /Projects, requests, agreements, billing/,
  );
  assert.equal(hasPortalCapability("owner", "invites.request"), true);
  assert.match(
    getPortalRolePresentation("contributor").detail,
    /creating or commenting on requests/,
  );
  assert.equal(hasPortalCapability("contributor", "billing.read"), false);
  assert.match(
    getPortalRolePresentation("billing_contact").detail,
    /Billing records and payment management only/,
  );
  assert.equal(hasPortalCapability("billing_contact", "projects.read"), false);
  assert.match(
    getPortalRolePresentation("viewer").detail,
    /Read-only projects, documents, and services/,
  );
  assert.equal(hasPortalCapability("viewer", "requests.create"), false);
});
