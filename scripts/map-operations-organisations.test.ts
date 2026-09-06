import assert from "node:assert/strict";
import test from "node:test";
import {
  parseMappingCommand,
  resolveMappingOperator,
} from "./map-operations-organisations";

test("mapping command defaults to validation and requires explicit founder review for apply", () => {
  assert.deepEqual(parseMappingCommand(["review.json"]), {
    file: "review.json",
    apply: false,
  });
  assert.deepEqual(
    parseMappingCommand([
      "review.json",
      "--apply",
      "--reviewed-by",
      "Founder@example.test",
    ]),
    { file: "review.json", apply: true, reviewer: "founder@example.test" },
  );
  for (const args of [
    [],
    ["--apply"],
    ["review.json", "--apply"],
    ["review.json", "--force"],
  ])
    assert.throws(() => parseMappingCommand(args));
  const env = {
    GROWTH_OS_OWNER_EMAIL: "founder@example.test",
    OPERATIONS_ENABLED: "true",
  };
  assert.match(
    resolveMappingOperator("founder@example.test", env).actorId,
    /^[a-f0-9]{64}$/,
  );
  assert.throws(
    () => resolveMappingOperator("other@example.test", env),
    /reviewed/,
  );
  assert.throws(() => resolveMappingOperator(undefined, env), /reviewed/);
  assert.throws(
    () =>
      resolveMappingOperator("founder@example.test", {
        ...env,
        OPERATIONS_ENABLED: "false",
      }),
    /disabled/,
  );
});
