import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { requireOperationsTestDatabaseUrl } from "../../../scripts/require-operations-database-env";
import { createBillingSchedule } from "../../../lib/operations/billing/schedules";
import {
  reserveBillingCommand,
  completeBillingCommand,
} from "../../../lib/operations/billing/command-repository";
import { withAgreementTransaction } from "../../../lib/operations/agreements/repository";
import {
  createBillingFixture,
  removeBillingFixture,
  billingFounder,
} from "./billing-fixtures";
const url = requireOperationsTestDatabaseUrl(
  process.env.OPERATIONS_TEST_DATABASE_URL,
);
test("billing schedules and command claims preserve signed allocation and collection ownership", async () => {
  const admin = postgres(url, { max: 1 });
  const db = postgres(url, {
    max: 3,
    connection: { options: "-c role=operations_founder" },
  });
  const f = await createBillingFixture(admin, db);
  try {
    const create = () =>
      createBillingSchedule(
        db,
        billingFounder,
        f.scope,
        f.agreementId,
        f.revision,
        f.correlationId,
      );
    const ids = await create();
    assert.equal(ids.length, 2);
    assert.deepEqual(await create(), ids);
    await assert.rejects(
      createBillingSchedule(
        db,
        null,
        f.scope,
        f.agreementId,
        2,
        f.correlationId,
      ),
      /Founder authorization/,
    );
    await assert.rejects(
      createBillingSchedule(
        db,
        billingFounder,
        { ...f.scope, organisationId: randomUUID() },
        f.agreementId,
        2,
        f.correlationId,
      ),
      /not found/,
    );
    await assert.rejects(
      createBillingSchedule(
        db,
        billingFounder,
        { ...f.scope, accountId: "acct_other" },
        f.agreementId,
        2,
        f.correlationId,
      ),
      /another account/,
    );
    const rows = await admin<
      { amount: string }[]
    >`select amount_pence::text as amount from operations.billing_schedules where organisation_id=${f.organisationId}`;
    assert.deepEqual(
      rows.map((row) => row.amount),
      ["6000", "6000"],
    );
    const reserve = (key: string) =>
      reserveBillingCommand(
        db,
        billingFounder,
        f.scope,
        `schedule:${ids[0]}`,
        key,
        f.correlationId,
      );
    const commands = await Promise.all([
      reserve("same"),
      reserve("same"),
      reserve("different-key"),
    ]);
    assert.equal(new Set(commands.map((row) => row.id)).size, 1);
    await completeBillingCommand(db, billingFounder, f.scope, commands[0].id, {
      providerId: "in_once",
    });
    assert.deepEqual((await reserve("same")).result, { providerId: "in_once" });
    await assert.rejects(
      reserveBillingCommand(
        db,
        billingFounder,
        f.scope,
        `schedule:${ids[1]}`,
        "same",
        f.correlationId,
      ),
      /different obligation/,
    );
    await withAgreementTransaction(db, billingFounder, async (tx) => {
      await tx`update operations.billing_schedules set provider_reference='in_once' where id=${ids[0]}`;
    });
    await assert.rejects(
      withAgreementTransaction(
        db,
        billingFounder,
        (tx) =>
          tx`update operations.billing_schedules set provider_reference='in_second' where id=${ids[0]}`,
      ),
      /immutable/,
    );
    await assert.rejects(
      withAgreementTransaction(
        db,
        billingFounder,
        (tx) =>
          tx`update operations.billing_commands set result=${tx.json({ providerId: "in_replaced" })} where id=${commands[0].id}`,
      ),
      /immutable/,
    );
    await withAgreementTransaction(db, billingFounder, async (tx, actor) => {
      await tx`insert into operations.invoices(organisation_id,schedule_id,account_id,environment,provider_invoice_id,number,status,currency,total_pence,amount_paid_pence,amount_remaining_pence,due_date,issued_snapshot,projected_at,created_by,correlation_id) values(${f.organisationId},${ids[0]},${f.scope.accountId},'test','in_once','TEST-1','open','GBP',6000,2000,4000,'2026-10-01',${tx.json({ totalPence: "6000", lines: [{ amountPence: "6000" }] })},now(),${actor.actorId},${f.correlationId})`;
    });
    await assert.rejects(
      admin`update operations.invoices set total_pence=7000 where organisation_id=${f.organisationId}`,
      /immutable/,
    );
    const [partial] = await admin<
      { paid: string; remaining: string }[]
    >`select amount_paid_pence::text as paid,amount_remaining_pence::text as remaining from operations.invoices where organisation_id=${f.organisationId}`;
    assert.deepEqual(partial, { paid: "2000", remaining: "4000" });
    await assert.rejects(db`delete from operations.billing_schedules`, {
      code: "42501",
    });
    assert.equal(
      (await db`select id from operations.billing_schedules`).length,
      0,
    );
  } finally {
    await removeBillingFixture(admin, f);
    await db.end();
    await admin.end();
  }
});
