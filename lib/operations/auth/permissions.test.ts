import assert from "node:assert/strict";
import test from "node:test";
import { hasPortalCapability } from "./permissions";
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
