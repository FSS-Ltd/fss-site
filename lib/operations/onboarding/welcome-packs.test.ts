import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { FssAdminContext } from "../auth/staff-types";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import {
  executeStaffWelcomePackCommand,
  listStaffWelcomePacks,
  WelcomePackConflict,
  welcomePackContentSchema,
  welcomePackIds,
} from "./welcome-packs";

const packContent = () => ({
  emailSubject: "Next steps for {{client_name}}",
  emailBody:
    "Hello {{contact_first_name}}, we will begin with {{agreement_goal}}.",
  guide: Array.from({ length: 5 }, (_, index) => ({
    title: `Step ${index + 1}`,
    paragraphs: [`We will follow {{agreement_scope}}.`],
  })),
  thankYou: {
    subject: "Thank you, {{contact_first_name}}",
    intro: "Thank you for confirming the work.",
    nextStep: "We will confirm the schedule after prerequisites are ready.",
    requiredAction: "Prepare the approved materials in your agreement.",
  },
  tasks: [
    {
      id: randomUUID(),
      title: "Confirm your project contact",
      instructions: "Check your workspace contact details.",
      kind: "profile",
      ownerRole: "owner",
      required: true,
      dependsOnTaskId: null,
      dueRule: "activation",
      evidenceRule: "profile_saved",
      bookingUrl: null,
    },
  ],
});

const admin: FssAdminContext = {
  actorId: "a".repeat(64),
  correlationId: randomUUID(),
  membershipId: randomUUID(),
  realm: "staff",
  role: "admin",
  userId: randomUUID(),
};

function recordingDb(queryResult: (sql: string) => unknown[] = () => []): {
  calls: string[];
  db: OperationsDb;
} {
  const calls: string[] = [];
  const query = Object.assign(
    async (parts: TemplateStringsArray) => {
      const sql = parts.join("?");
      calls.push(sql);
      return queryResult(sql);
    },
    { json: (value: unknown) => JSON.stringify(value) },
  );
  return {
    calls,
    db: {
      begin: (run: (tx: OperationsTransaction) => Promise<unknown>) =>
        run(query as unknown as OperationsTransaction),
    } as unknown as OperationsDb,
  };
}

test("limits shared packs to the three supported FSS services", () => {
  assert.deepEqual(welcomePackIds, [
    "website_build",
    "website_seo",
    "systems_portal",
  ]);
});

test("accepts client placeholders in a five-section pack", () => {
  const parsed = welcomePackContentSchema.parse(packContent());
  assert.equal(parsed.guide.length, 5);
  assert.match(parsed.emailSubject, /{{client_name}}/);
});

test("rejects unsupported client placeholders", () => {
  const content = packContent();
  content.emailBody = "Welcome {{client_address}}";
  assert.throws(
    () => welcomePackContentSchema.parse(content),
    /supported client detail placeholders/i,
  );
});

test("keeps client placeholders out of checklist tasks", () => {
  const content = packContent();
  const firstTask = content.tasks[0];
  assert.ok(firstTask);
  firstTask.instructions = "Prepare materials for {{client_name}}.";
  assert.throws(
    () => welcomePackContentSchema.parse(content),
    /fixed client instructions/i,
  );
});

test("rejects welcome guides that do not have five sections", () => {
  const content = packContent();
  content.guide.pop();
  assert.throws(() => welcomePackContentSchema.parse(content));
});

test("uses immutable published content for a client pack version", async () => {
  const draft = packContent();
  const published = packContent();
  draft.emailBody = "Unpublished draft copy.";
  published.emailBody = "Approved published copy.";
  const database = recordingDb((sql) => {
    if (sql.includes("from operations.welcome_packs"))
      return [
        {
          id: "website_build",
          title: "Standard website build",
          draftContent: draft,
          draftVersion: 2,
          publishedVersion: 1,
        },
      ];
    if (sql.includes("from operations.welcome_pack_versions"))
      return [
        {
          packId: "website_build",
          id: randomUUID(),
          version: 1,
          content: published,
          publishedAt: new Date().toISOString(),
        },
      ];
    return [];
  });
  const [pack] = await listStaffWelcomePacks(database.db, admin);
  assert.equal(pack?.content.emailBody, "Unpublished draft copy.");
  assert.equal(
    pack?.versions[0]?.content.emailBody,
    "Approved published copy.",
  );
});

test("rejects a stale pack draft without recording a write", async () => {
  const database = recordingDb();
  await assert.rejects(
    executeStaffWelcomePackCommand(database.db, admin, {
      action: "save_draft",
      packId: "website_build",
      content: packContent(),
      expectedVersion: 1,
      reviewReference: "Reviewed the welcome draft",
    }),
    WelcomePackConflict,
  );
  assert.equal(
    database.calls.some((sql) =>
      sql.includes("insert into operations.welcome_pack_audit_events"),
    ),
    false,
  );
});

test("publishes the current reviewed draft as the next immutable version", async () => {
  const database = recordingDb((sql) => {
    if (sql.includes("from operations.welcome_packs"))
      return [
        {
          title: "Standard website build",
          content: packContent(),
          publishedVersion: 2,
          draftVersion: 4,
        },
      ];
    if (sql.includes("insert into operations.welcome_pack_versions"))
      return [{ id: randomUUID() }];
    if (sql.includes("update operations.welcome_packs"))
      return [{ draftVersion: 5 }];
    return [];
  });
  const result = await executeStaffWelcomePackCommand(database.db, admin, {
    action: "publish",
    packId: "website_build",
    expectedDraftVersion: 4,
    reviewReference: "Approved website pack v3",
  });
  assert.equal(result.kind, "welcome_pack_version");
  if (result.kind !== "welcome_pack_version") return;
  assert.equal(result.version, 3);
  assert.ok(
    database.calls.some((sql) =>
      sql.includes("insert into operations.welcome_pack_versions"),
    ),
  );
  assert.ok(
    database.calls.some((sql) =>
      sql.includes("insert into operations.welcome_pack_audit_events"),
    ),
  );
  assert.ok(
    database.calls.some((sql) =>
      sql.includes("draft_version = draft_version + 1"),
    ),
  );
});
