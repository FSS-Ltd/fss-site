import assert from "node:assert/strict";
import test from "node:test";
import { reserveBillingCommand } from "../../../lib/operations/billing/command-repository";
import { executeBillingObligation } from "../../../lib/operations/billing/invoice-service";
import { createBillingSchedule } from "../../../lib/operations/billing/schedules";
import { previewBillingAmendment } from "../../../lib/operations/billing/amendments";
import { agreementDraft } from "../../../lib/operations/agreements/fixtures";
import {
  createBillingTestDatabases,
  createBillingFixture,
  createSignedBillingAmendment,
  removeBillingFixture,
  billingFounder,
} from "./billing-fixtures";
import { billingProviderFixture } from "./billing-provider-fixture";
test("future signed schedule amendment previews a full period and holds changes without provider mutation", async () => {
  const { admin, db } = createBillingTestDatabases();
  const draft = agreementDraft();
  draft.lines[0].taxPence = "0";
  draft.lines[0].unitPence = "12000";
  draft.lines[0].recurrenceMonths = 1;
  draft.lines[0].startDate = "2099-01-01";
  draft.installments = [];
  const f = await createBillingFixture(admin, db, draft);
  const p = billingProviderFixture();
  try {
    const [id] = await createBillingSchedule(
      db,
      billingFounder,
      f.scope,
      f.agreementId,
      2,
      f.correlationId,
    );
    await executeBillingObligation(
      db,
      billingFounder,
      f.scope,
      id,
      "future",
      p.stripe,
      f.correlationId,
    );
    const proposed = await createSignedBillingAmendment(db, f, draft);
    const [proposedScheduleId] = await createBillingSchedule(
      db,
      billingFounder,
      f.scope,
      proposed.agreementId,
      proposed.revision,
      f.correlationId,
    );
    const input = {
      scheduleId: id,
      agreementId: proposed.agreementId,
      revision: proposed.revision,
      lineNumber: 1,
      effectiveAt: "2026-09-08T05:41:48.695Z",
    };
    const preview = await previewBillingAmendment(
      db,
      billingFounder,
      f.scope,
      input,
      p.stripe,
      f.correlationId,
    );
    await assert.rejects(
      executeBillingObligation(
        db,
        billingFounder,
        f.scope,
        proposedScheduleId,
        "held-issue",
        p.stripe,
        f.correlationId,
      ),
      /held for founder approval/,
    );
    assert.equal(
      p.requests.filter(
        (r) => r.path === "/v1/subscription_schedules" && r.method === "POST",
      ).length,
      1,
    );
    const racing = await createSignedBillingAmendment(db, f, draft);
    const [racingSchedule] = await createBillingSchedule(
      db,
      billingFounder,
      f.scope,
      racing.agreementId,
      racing.revision,
      f.correlationId,
    );
    const race = await Promise.allSettled([
      reserveBillingCommand(
        db,
        billingFounder,
        f.scope,
        `schedule:${racingSchedule}`,
        "concurrent-issue",
        f.correlationId,
      ),
      previewBillingAmendment(
        db,
        billingFounder,
        f.scope,
        {
          ...input,
          agreementId: racing.agreementId,
          revision: racing.revision,
        },
        p.stripe,
        f.correlationId,
      ),
    ]);
    assert.equal(
      race.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(
      race.filter((result) => result.status === "rejected").length,
      1,
    );
    assert.equal(preview.totalPence, "12000");
    assert.equal(preview.state, "awaiting_founder_approval");
    const [held] = await admin<
      {
        preview: {
          change: {
            kind: string;
            prorationPence: string;
            current: { startDate: string };
            proposed: { startDate: string };
            firstPeriodTotalPence: string;
          };
        };
      }[]
    >`select preview from operations.billing_amendment_previews where id=${preview.id}`;
    assert.equal(held.preview.change.kind, "future_schedule");
    assert.equal(held.preview.change.prorationPence, "0");
    assert.equal(held.preview.change.proposed.startDate, "2099-01-01");
    assert.equal(p.state.startDate, Date.parse("2099-01-01T00:00:00Z") / 1000);
    assert.equal(
      p.requests.filter(
        (r) =>
          r.method === "POST" &&
          r.path === "/v1/subscription_schedules/sub_sched_synthetic",
      ).length,
      0,
    );
    const request = p.requests.find(
      (r) => r.path === "/v1/invoices/create_preview",
    );
    assert.equal(
      request?.params.get("schedule_details[phases][0][proration_behavior]"),
      "none",
    );
    p.state.phaseCount = 2;
    await assert.rejects(
      previewBillingAmendment(
        db,
        billingFounder,
        f.scope,
        input,
        p.stripe,
        f.correlationId,
      ),
      /single future/,
    );
    p.state.phaseCount = 1;
    p.state.subscriptionCustomer = "cus_other";
    await assert.rejects(
      previewBillingAmendment(
        db,
        billingFounder,
        f.scope,
        input,
        p.stripe,
        f.correlationId,
      ),
      /context mismatch/,
    );
    assert.equal(
      (
        await admin`select id from operations.invoices where organisation_id=${f.organisationId}`
      ).length,
      0,
    );
  } finally {
    await removeBillingFixture(admin, f);
    await db.end();
    await admin.end();
  }
});
