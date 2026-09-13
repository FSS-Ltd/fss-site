import assert from "node:assert/strict";
import test from "node:test";
import { createGrantAccessPayload } from "./portal-access-form";

test("request payload preserves selected database role", () => {
  const form = new FormData();
  form.set("organisationId", "organisation-1");
  form.set("name", "Taylor Example");
  form.set("email", "taylor@example.test");
  form.set("role", "billing_contact");
  form.set("reviewReference", "Finance contact approved by founder");

  assert.deepEqual(createGrantAccessPayload(form), {
    action: "grant_access",
    organisationId: "organisation-1",
    name: "Taylor Example",
    email: "taylor@example.test",
    role: "billing_contact",
    reviewReference: "Finance contact approved by founder",
  });
});

test("request payload rejects a role outside the database role union", () => {
  const form = new FormData();
  form.set("organisationId", "organisation-1");
  form.set("name", "Taylor Example");
  form.set("email", "taylor@example.test");
  form.set("role", "administrator");
  form.set("reviewReference", "Finance contact approved by founder");

  assert.throws(() => createGrantAccessPayload(form));
});
