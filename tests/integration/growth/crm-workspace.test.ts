import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { executeCrmCommand } from "../../../lib/growth/crm/commands";
import { CrmError } from "../../../lib/growth/crm/errors";
import { getCrmWorkspace } from "../../../lib/growth/crm/workspace-query";
import {
  crmTestFounder as founder,
  withCrmTestDatabase,
} from "./crm-test-fixtures";
const connection = process.env.DIRECT_DATABASE_URL;
test(
  "tasks preserve scope, record history and roll back stale promotion atomically",
  { skip: !connection },
  async () =>
    withCrmTestDatabase(async (sql, newLead) => {
      const capture = await executeCrmCommand(
        sql,
        newLead(),
        founder,
        randomUUID(),
      );
      const prospect = { id: capture.prospectId!, version: 1 };
      const second = await executeCrmCommand(
        sql,
        newLead(),
        founder,
        randomUUID(),
      );
      const taskId = randomUUID();
      const create = {
        kind: "create_task" as const,
        prospectId: prospect.id,
        requestId: taskId,
        title: "Follow up with director",
        dueAt: "2026-10-28T10:00:00Z",
      };
      await executeCrmCommand(sql, create, founder, randomUUID());
      await executeCrmCommand(sql, create, founder, randomUUID());
      await assert.rejects(
        executeCrmCommand(
          sql,
          {
            kind: "promote_task",
            prospectId: prospect.id,
            taskId,
            expectedVersion: 1,
            prospectVersion: 9999,
          },
          founder,
          randomUUID(),
        ),
        (e: unknown) => e instanceof CrmError && e.code === "version_conflict",
      );
      const [unchanged] =
        await sql`select next_action from growth.prospects where id=${prospect.id}`;
      assert.equal(unchanged.next_action, null);
      await executeCrmCommand(
        sql,
        {
          kind: "promote_task",
          prospectId: prospect.id,
          taskId,
          expectedVersion: 1,
          prospectVersion: prospect.version,
        },
        founder,
        randomUUID(),
      );
      await executeCrmCommand(
        sql,
        {
          kind: "task_status",
          prospectId: prospect.id,
          taskId,
          expectedVersion: 2,
          completed: true,
        },
        founder,
        randomUUID(),
      );
      await executeCrmCommand(
        sql,
        {
          kind: "task_status",
          prospectId: prospect.id,
          taskId,
          expectedVersion: 3,
          completed: false,
        },
        founder,
        randomUUID(),
      );
      const other = { id: second.prospectId! };
      await assert.rejects(
        executeCrmCommand(
          sql,
          {
            kind: "update_task",
            prospectId: other.id,
            taskId,
            expectedVersion: 4,
            title: "Wrong record",
            dueAt: "2026-11-01T12:00:00Z",
          },
          founder,
          randomUUID(),
        ),
        (e: unknown) => e instanceof CrmError && e.code === "not_found",
      );
      for (const activityType of ["note", "call", "meeting"] as const)
        await executeCrmCommand(
          sql,
          {
            kind: "add_activity",
            prospectId: prospect.id,
            requestId: randomUUID(),
            activityType,
            body: "Plain text <script>never execute</script>",
          },
          founder,
          randomUUID(),
        );
      const workspace = await getCrmWorkspace(sql, prospect.id, {});
      assert.equal(
        workspace.tasks.rows.find((task) => task.id === taskId)?.version,
        4,
      );
      assert.ok(
        workspace.activities.rows.some(
          (item) => item.type === "task_completed",
        ),
      );
      assert.ok(
        workspace.activities.rows.some((item) => item.type === "meeting"),
      );
      assert.equal(
        workspace.activities.rows.filter(
          (item) => item.type === "task_created" && item.taskId === taskId,
        ).length,
        1,
      );
    }),
);
test(
  "saved views validate filters, isolate owners and enforce versions",
  { skip: !connection },
  async () =>
    withCrmTestDatabase(async (sql) => {
      const id = randomUUID();
      const filters = {
        q: "Example",
        stage: "all" as const,
        sector: "",
        location: "",
        nextAction: "overdue" as const,
        view: "list" as const,
      };
      await executeCrmCommand(
        sql,
        { kind: "save_view", requestId: id, name: "Review " + id, filters },
        founder,
        randomUUID(),
      );
      await executeCrmCommand(
        sql,
        {
          kind: "rename_view",
          viewId: id,
          expectedVersion: 1,
          name: "Priority " + id,
        },
        founder,
        randomUUID(),
      );
      await assert.rejects(
        executeCrmCommand(
          sql,
          { kind: "delete_view", viewId: id, expectedVersion: 1 },
          founder,
          randomUUID(),
        ),
        (e: unknown) => e instanceof CrmError && e.code === "version_conflict",
      );
      await sql`update growth.crm_saved_views set actor_id=${"b".repeat(64)} where id=${id}`;
      await assert.rejects(
        executeCrmCommand(
          sql,
          { kind: "delete_view", viewId: id, expectedVersion: 2 },
          founder,
          randomUUID(),
        ),
        (e: unknown) => e instanceof CrmError && e.code === "not_found",
      );
      await sql`delete from growth.crm_saved_views where id=${id}`;
      await sql`delete from growth.audit_log where entity_id=${id}`;
    }),
);

test(
  "activity pagination preserves records sharing a microsecond timestamp",
  { skip: !connection },
  async () =>
    withCrmTestDatabase(async (sql, newLead) => {
      const capture = await executeCrmCommand(
        sql,
        newLead(),
        founder,
        randomUUID(),
      );
      const prospectId = capture.prospectId!;
      await sql`insert into growth.crm_activities(id,prospect_id,activity_type,body,actor_id,created_at) select gen_random_uuid(),${prospectId},'note','Same instant',${founder.actorId},'2026-10-26T12:00:00.123456Z'::timestamptz from generate_series(1,25)`;
      const first = await getCrmWorkspace(sql, prospectId, {});
      assert.equal(first.activities.rows.length, 20);
      assert.ok(first.activities.nextCursor);
      const second = await getCrmWorkspace(sql, prospectId, {
        activityAfter: first.activities.nextCursor!,
      });
      assert.equal(second.activities.rows.length, 5);
      assert.equal(
        new Set(
          [...first.activities.rows, ...second.activities.rows].map(
            (row) => row.id,
          ),
        ).size,
        25,
      );
    }),
);

test(
  "duplicate saved-view names return a view-specific conflict",
  { skip: !connection },
  async () =>
    withCrmTestDatabase(async (sql) => {
      const id = randomUUID();
      const name = "Duplicate " + id;
      try {
        await executeCrmCommand(
          sql,
          {
            kind: "save_view",
            requestId: id,
            name,
            filters: {
              q: "",
              stage: "all",
              sector: "",
              location: "",
              nextAction: "all",
              view: "board",
            },
          },
          founder,
          randomUUID(),
        );
        await assert.rejects(
          executeCrmCommand(
            sql,
            {
              kind: "save_view",
              requestId: randomUUID(),
              name,
              filters: {
                q: "",
                stage: "all",
                sector: "",
                location: "",
                nextAction: "all",
                view: "list",
              },
            },
            founder,
            randomUUID(),
          ),
          (e: unknown) => e instanceof CrmError && e.code === "duplicate_view",
        );
      } finally {
        await sql`delete from growth.crm_saved_views where id=${id}`;
        await sql`delete from growth.audit_log where entity_id=${id}`;
      }
    }),
);
