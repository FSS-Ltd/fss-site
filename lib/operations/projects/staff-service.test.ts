import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { FssAdminContext } from "../auth/staff-types";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import { ProjectConflict } from "./types";
import {
  executeStaffProjectCommand,
  loadStaffProjectForEdit,
} from "./staff-service";

const projectId = "44444444-4444-4444-8444-444444444444";
const organisationId = "55555555-5555-4555-8555-555555555555";
const admin: FssAdminContext = {
  actorId: "a".repeat(64),
  correlationId: randomUUID(),
  membershipId: randomUUID(),
  realm: "staff",
  role: "admin",
  userId: randomUUID(),
};

const metadata = {
  agreementId: randomUUID(),
  deliverables: ["Approved website"],
  internalEstimateMinutes: 120,
  internalNotes: "Internal delivery note",
  outcome: "A clearer enquiry journey",
  ownerDisplay: "Jean-Fidele",
  scheduleDependencies: [],
  scheduleEvidence: null,
  status: "active",
  summary: "A client-facing project summary.",
  targetDate: null,
  title: "Website refresh",
  visibility: "client",
};

function recordingDb(options: { currentVersion?: number; project?: boolean } = {}): {
  calls: Array<{ sql: string; values: unknown[] }>;
  db: OperationsDb;
} {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const query = async (parts: TemplateStringsArray, ...values: unknown[]) => {
    const sql = parts.join("?");
    calls.push({ sql, values });
    if (sql.includes("set_config") || sql.includes("assert_active")) return [];
    if (sql.includes("from operations.projects") && sql.includes("for update")) {
      return [{ id: projectId, version: options.currentVersion ?? 3 }];
    }
    if (sql.includes("from operations.projects") && !sql.includes("for update")) {
      return options.project === false
        ? []
        : [
            {
              agreementId: metadata.agreementId,
              deliverables: metadata.deliverables,
              id: projectId,
              internalEstimateMinutes: metadata.internalEstimateMinutes,
              internalNotes: metadata.internalNotes,
              organisationId,
              outcome: metadata.outcome,
              ownerDisplay: metadata.ownerDisplay,
              scheduleDependencies: metadata.scheduleDependencies,
              scheduleEvidence: metadata.scheduleEvidence,
              status: metadata.status,
              summary: metadata.summary,
              targetDate: metadata.targetDate,
              title: metadata.title,
              version: 3,
              visibility: metadata.visibility,
            },
          ];
    }
    if (sql.includes("from operations.milestones")) return [];
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

test("updates the route-selected project within an FSS-admin transaction", async () => {
  const { calls, db } = recordingDb();

  const result = await executeStaffProjectCommand(
    db,
    admin,
    projectId,
    {
      action: "update",
      expectedVersion: 3,
      metadata,
      projectId,
      reviewReference: "Reviewed client project update",
    },
    randomUUID(),
  );

  assert.deepEqual(result, { id: projectId, version: 4 });
  assert.match(
    calls.map(({ sql }) => sql).join("\n"),
    /operations\.assert_active_staff_membership/,
  );
  assert.ok(calls.some(({ sql }) => sql.includes("update operations.projects")));
});

test("rejects a stale version or a project ID forged outside the selected route", async () => {
  const stale = recordingDb({ currentVersion: 2 });
  await assert.rejects(
    executeStaffProjectCommand(
      stale.db,
      admin,
      projectId,
      {
        action: "update",
        expectedVersion: 3,
        metadata,
        projectId,
        reviewReference: "Reviewed client project update",
      },
      randomUUID(),
    ),
    ProjectConflict,
  );
  assert.equal(
    stale.calls.some(({ sql }) => sql.includes("update operations.projects")),
    false,
  );

  const forged = recordingDb();
  await assert.rejects(
    executeStaffProjectCommand(
      forged.db,
      admin,
      projectId,
      {
        action: "update",
        expectedVersion: 3,
        metadata,
        projectId: randomUUID(),
        reviewReference: "Reviewed client project update",
      },
      randomUUID(),
    ),
  );
  assert.equal(forged.calls.length, 0);
});

test("loads project-edit data only for an existing project", async () => {
  const { db } = recordingDb();
  const missing = recordingDb({ project: false });

  const project = await loadStaffProjectForEdit(db, admin, projectId);
  assert.equal(project?.internalNotes, metadata.internalNotes);
  assert.equal(project?.milestones.length, 0);
  assert.equal(
    await loadStaffProjectForEdit(missing.db, admin, projectId),
    null,
  );
});
