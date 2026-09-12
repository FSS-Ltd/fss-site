import assert from "node:assert/strict";
import test from "node:test";
import { runWithOperationsRole } from "./client";

test("sets the constrained role before Operations work runs", async () => {
  const calls: string[] = [];
  const result = await runWithOperationsRole(
    "operations_founder",
    {
      unsafe: async (statement: string) => {
        calls.push(statement);
        return [];
      },
    },
    async () => {
      calls.push("work");
      return "complete";
    },
  );

  assert.equal(result, "complete");
  assert.deepEqual(calls, ["set local role operations_founder", "work"]);
});
