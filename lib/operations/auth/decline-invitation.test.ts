import assert from "node:assert/strict";
import test from "node:test";
import type { OperationsDb } from "../db/client";
import { declinePortalInvitation } from "./decline-invitation";
import { createDeclineToken, hashDeclineToken } from "./decline-token";

const correlationId = "11111111-1111-4111-8111-111111111111";
const invitationId = "44444444-4444-4444-8444-444444444444";

test("new decline tokens contain 256 random bits and only their hash is stored", () => {
  const first = createDeclineToken();
  const second = createDeclineToken();
  assert.match(first.token, /^[A-Za-z0-9_-]{43}$/);
  assert.match(first.hash, /^[a-f0-9]{64}$/);
  assert.equal(hashDeclineToken(first.token), first.hash);
  assert.notEqual(first.token, second.token);
});

test("decline uses the token hash and revokes only its invitation ID", async () => {
  const { token, hash } = createDeclineToken();
  const args: unknown[][] = [];
  const queries: string[] = [];
  const db = (async (parts: TemplateStringsArray, tokenHash: string) => {
    const sql = parts.join("?");
    queries.push(sql);
    assert.equal(tokenHash, hash);
    return sql.includes("decline_portal_invitation")
      ? [{ invitationId, invitationEmail: "client@example.test" }]
      : [];
  }) as unknown as OperationsDb;
  const result = await declinePortalInvitation(
    db,
    token,
    correlationId,
    async (...values) => {
      args.push(values);
    },
  );
  assert.equal(result, true);
  assert.deepEqual(args, [["client@example.test", invitationId, "portal"]]);
  assert.match(queries.at(-1) ?? "", /complete_portal_invitation_decline/);
});

test("invalid or expired decline tokens do not contact Clerk", async () => {
  let queryCount = 0;
  let providerCount = 0;
  const db = (async () => {
    queryCount += 1;
    return [];
  }) as unknown as OperationsDb;
  const provider = async () => {
    providerCount += 1;
  };
  assert.equal(
    await declinePortalInvitation(db, "bad", correlationId, provider),
    false,
  );
  assert.equal(queryCount, 0);
  assert.equal(
    await declinePortalInvitation(
      db,
      createDeclineToken().token,
      correlationId,
      provider,
    ),
    false,
  );
  assert.equal(queryCount, 1);
  assert.equal(providerCount, 0);
});

test("provider failure does not consume the decline token", async () => {
  const calls: string[] = [];
  const db = (async (parts: TemplateStringsArray) => {
    const sql = parts.join("?");
    calls.push(sql);
    return [{ invitationId, invitationEmail: "client@example.test" }];
  }) as unknown as OperationsDb;
  await assert.rejects(
    declinePortalInvitation(
      db,
      createDeclineToken().token,
      correlationId,
      async () => {
        throw new Error("provider unavailable");
      },
    ),
    /provider unavailable/,
  );
  assert.equal(calls.length, 1);
  assert.doesNotMatch(calls.join("\n"), /complete_portal_invitation_decline/);
});
