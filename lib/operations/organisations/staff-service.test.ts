import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { FssAdminContext } from "../auth/staff-types";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import {
  StudioClientDuplicateError,
  createStaffClient,
  staffClientCreationSchema,
  staffClientCurrencySchema,
} from "./staff-service";

const admin: FssAdminContext = {
  actorId: "a".repeat(64),
  correlationId: randomUUID(),
  membershipId: randomUUID(),
  realm: "staff",
  role: "admin",
  userId: randomUUID(),
};

const clientInput = {
  displayName: " Northstar Studio ",
  legalName: " Northstar Studio Ltd ",
  primaryContact: {
    email: " ALEX@NORTHSTAR.EXAMPLE ",
    name: " Alex Morgan ",
    role: "Director",
  },
  reviewReference: " Reviewed client record ",
  timezone: "Europe/London",
};

function recordingDb(existing = false): {
  calls: Array<{ sql: string; values: unknown[] }>;
  db: OperationsDb;
} {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const organisationId = "7e2815e3-7f30-4137-bfaa-8dcb45e434fb";
  const query = async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const sql = parts.join("?");
    calls.push({ sql, values });
    if (sql.includes("set_config") || sql.includes("contacts")) return [];
    if (sql.includes("from operations.organisations"))
      return existing ? [{ id: organisationId }] : [];
    if (sql.includes("insert into operations.organisations")) {
      return [{ id: organisationId }];
    }
    return [];
  };
  return {
    calls,
    db: {
      begin: (run: (tx: OperationsTransaction) => Promise<unknown>) =>
        run(query as unknown as OperationsTransaction),
    } as unknown as OperationsDb,
  };
}

test("creates a client and primary contact without portal access", async () => {
  const { calls, db } = recordingDb();

  const result = await createStaffClient(db, admin, clientInput, randomUUID());

  assert.deepEqual(result, {
    organisationId: "7e2815e3-7f30-4137-bfaa-8dcb45e434fb",
  });
  assert.ok(
    calls.some(
      ({ sql, values }) =>
        sql.includes("insert into operations.organisations") &&
        values.includes("Northstar Studio") &&
        values.includes("Northstar Studio Ltd"),
    ),
  );
  assert.ok(
    calls.some(
      ({ sql, values }) =>
        sql.includes("insert into operations.contacts") &&
        values.includes("alex@northstar.example") &&
        values.includes("Alex Morgan"),
    ),
  );
  assert.equal(
    calls.some(({ sql }) =>
      /insert into operations\.(memberships|portal_invites|pending_portal_invitations)/i.test(
        sql,
      ),
    ),
    false,
  );
});

test("rejects duplicate candidates before writing a client or contact", async () => {
  const { calls, db } = recordingDb(true);

  await assert.rejects(
    createStaffClient(db, admin, clientInput, randomUUID()),
    StudioClientDuplicateError,
  );

  assert.equal(
    calls.some(({ sql }) =>
      sql.includes("insert into operations.organisations"),
    ),
    false,
  );
  assert.equal(
    calls.some(({ sql }) => sql.includes("insert into operations.contacts")),
    false,
  );
});

test("rejects invalid client inputs before opening an Operations transaction", async () => {
  const { calls, db } = recordingDb();

  await assert.rejects(
    createStaffClient(
      db,
      admin,
      { ...clientInput, timezone: "Not/A-Timezone" },
      randomUUID(),
    ),
  );

  assert.equal(calls.length, 0);
});

test("client creation defaults to GBP and accepts only supported currencies", () => {
  assert.equal(
    staffClientCreationSchema.parse(clientInput).billingCurrency,
    "GBP",
  );
  for (const billingCurrency of ["GBP", "USD", "EUR"]) {
    assert.equal(
      staffClientCreationSchema.parse({ ...clientInput, billingCurrency })
        .billingCurrency,
      billingCurrency,
    );
  }
  assert.equal(
    staffClientCreationSchema.safeParse({
      ...clientInput,
      billingCurrency: "CAD",
    }).success,
    false,
  );
});

test("currency changes require an exact positive version and reviewed reason", () => {
  const input = {
    billingCurrency: "EUR",
    expectedCurrencyVersion: 2,
    reviewReference: "Reviewed currency",
  };
  assert.deepEqual(staffClientCurrencySchema.parse(input), input);
  for (const invalid of [
    { ...input, expectedCurrencyVersion: 0 },
    { ...input, expectedCurrencyVersion: 1.5 },
    { ...input, billingCurrency: "eur" },
    { ...input, reviewReference: " " },
    { ...input, currencyVersion: 2 },
  ])
    assert.equal(staffClientCurrencySchema.safeParse(invalid).success, false);
});
