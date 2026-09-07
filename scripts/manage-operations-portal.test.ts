import assert from "node:assert/strict";
import test from "node:test";
import { parsePortalCommand } from "./manage-operations-portal";
import { portalOperationSchema } from "../lib/operations/auth/operator";

test("portal operator defaults to validation and requires explicit reviewed application", () => {
  assert.deepEqual(parsePortalCommand(["reviewed.json"]), {
    file: "reviewed.json",
    apply: false,
  });
  assert.equal(
    parsePortalCommand([
      "reviewed.json",
      "--apply",
      "--reviewed-by",
      "Founder@example.test",
      "--output",
      "invite.json",
    ]).reviewer,
    "founder@example.test",
  );
  for (const args of [
    [],
    ["--apply"],
    ["reviewed.json", "--apply"],
    ["reviewed.json", "--apply", "--reviewed-by", "invalid"],
    [
      "reviewed.json",
      "--apply",
      "--reviewed-by",
      "founder@example.test",
      "--output",
      "--unsafe",
    ],
  ])
    assert.throws(() => parsePortalCommand(args));
});
test("reviewed operations reject excess authority and missing tenant or review evidence", () => {
  const invite = {
    action: "issue_invite",
    organisationId: "11111111-1111-4111-8111-111111111111",
    contactId: "22222222-2222-4222-8222-222222222222",
    role: "viewer",
    reviewReference: "review-1",
  };
  assert.equal(portalOperationSchema.parse(invite).action, "issue_invite");
  for (const change of [
    { role: "admin" },
    { organisationId: undefined },
    { reviewReference: "" },
    { userId: "forged" },
  ])
    assert.throws(() => portalOperationSchema.parse({ ...invite, ...change }));
});
