import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import * as staffRequests from "./staff-service";

test("staff request creation is exposed through the FSS-admin service boundary", async () => {
  const candidate = Reflect.get(staffRequests, "createStaffRequest");
  assert.equal(typeof candidate, "function");
  if (typeof candidate !== "function") return;

  const organisationId = randomUUID();
  const projectId = randomUUID();
  const correlationId = randomUUID();
  const admin = {
    actorId: "a".repeat(64),
    correlationId,
    membershipId: randomUUID(),
    realm: "staff" as const,
    role: "admin" as const,
    userId: randomUUID(),
  };
  const calls: string[] = [];
  const query = async (parts: TemplateStringsArray) => {
    const sql = parts.join("?");
    calls.push(sql);
    if (sql.includes("create_staff_request")) return [{ id: randomUUID() }];
    return [];
  };
  Object.assign(query, { json: (value: unknown) => JSON.stringify(value) });
  const db = {
    begin: (run: (tx: OperationsTransaction) => Promise<unknown>) =>
      run(query as unknown as OperationsTransaction),
  } as unknown as OperationsDb;

  await candidate(
    db,
    admin,
    organisationId,
    {
      description: "Prepare a client-visible request.",
      desiredOutcome: "The client can review the recorded request.",
      idempotencyKey: randomUUID(),
      priority: "normal",
      projectId,
      title: "Prepare review work",
      type: "work",
    },
    correlationId,
  );
  assert.ok(calls.some((sql) => sql.includes("assert_active_staff_membership")));
  assert.ok(calls.some((sql) => sql.includes("create_staff_request")));
});
