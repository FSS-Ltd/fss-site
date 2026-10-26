import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { executeCrmCommand } from "../../../lib/growth/crm/commands";
import { getPipelineBoardResult } from "../../../lib/growth/dashboard/pipeline";
import { pipelineFiltersSchema } from "../../../lib/growth/crm/schemas";
import {
  crmTestFounder as founder,
  withCrmTestDatabase,
} from "./crm-test-fixtures";

test(
  "filtered pipeline reconciles separate and weighted money with bounded records",
  { skip: !process.env.DIRECT_DATABASE_URL },
  async () =>
    withCrmTestDatabase(async (sql, newLead) => {
      const input = { ...newLead(), businessName: "Pipeline " + randomUUID() };
      const created = await executeCrmCommand(
        sql,
        input,
        founder,
        randomUUID(),
      );
      const [engagement] = await sql<
        { id: string }[]
      >`insert into growth.delivery_engagements(prospect_id,name,stage,one_off_value_pence,monthly_value_pence,probability_percent) values (${created.prospectId!},'Website','qualified',200000,10000,25) returning id`;
      const filters = pipelineFiltersSchema.parse({
        q: input.businessName,
        nextAction: "missing",
      });
      const board = await getPipelineBoardResult({ after: {}, filters }, sql);
      assert.equal(board.status, "ready");
      if (board.status !== "ready") return;
      assert.equal(board.data.columns.qualified.totalCount, 1);
      assert.equal(board.data.columns.qualified.oneOffTotalPence, 200000);
      assert.equal(board.data.columns.qualified.monthlyTotalPence, 10000);
      assert.equal(board.data.columns.qualified.weightedOneOffPence, 50000);
      assert.equal(board.data.columns.qualified.weightedMonthlyPence, 2500);
      assert.equal(
        board.data.columns.qualified.rows[0]?.oneOffValuePence,
        200000,
      );
      const list = await getPipelineBoardResult(
        { after: {}, filters: { ...filters, view: "list" } },
        sql,
      );
      assert.deepEqual(list, board);
      await executeCrmCommand(
        sql,
        {
          kind: "update_opportunity",
          prospectId: created.prospectId!,
          engagementId: engagement.id,
          expectedVersion: 1,
          name: "New scope",
          oneOffValuePence: 300000,
          monthlyValuePence: 20000,
          probabilityPercent: 50,
          expectedCloseDate: "2026-11-30",
        },
        founder,
        randomUUID(),
      );
      const [updated] =
        await sql`select version,name from growth.delivery_engagements where id=${engagement.id}`;
      assert.equal(updated.version, 2);
      assert.equal(updated.name, "New scope");
      await sql`update growth.delivery_engagements set stage='won',won_at=now() where id=${engagement.id}`;
      await assert.rejects(
        executeCrmCommand(
          sql,
          {
            kind: "update_opportunity",
            prospectId: created.prospectId!,
            engagementId: engagement.id,
            expectedVersion: 2,
            name: "Cannot rewrite",
            oneOffValuePence: 1,
            monthlyValuePence: 0,
            probabilityPercent: 0,
            expectedCloseDate: null,
          },
          founder,
          randomUUID(),
        ),
      );
      const closed = await getPipelineBoardResult({ after: {}, filters }, sql);
      assert.equal(closed.status, "ready");
      if (closed.status === "ready")
        assert.equal(closed.data.columns.qualified.totalCount, 0);
    }),
);
