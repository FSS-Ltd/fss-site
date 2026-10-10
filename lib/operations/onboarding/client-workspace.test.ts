import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { clientOnboardingTaskCommandSchema } from "./client-workspace";
import { createClientOnboardingTaskHandler } from "./client-workspace-http";

const organisationId = "a85e5e49-dff3-4816-a2be-155f39101868";
const taskId = "0ecb5e3c-5c4b-4f3c-abfe-bd8296e505d4";
const templateVersionId = "0f38c5a6-4333-4db1-9343-ec702aa2ce3e";

test("client onboarding commands accept only profile or cleared-document evidence", () => {
  const command = clientOnboardingTaskCommandSchema.parse({
    action: "complete_profile",
    taskId,
    expectedTemplateVersionId: templateVersionId,
    profile: {
      preferredName: "Alex Morgan",
      jobTitle: "Operations director",
      phone: "+44 20 7946 0958",
    },
  });

  assert.equal(command.action, "complete_profile");
  assert.throws(
    () =>
      clientOnboardingTaskCommandSchema.parse({
        ...command,
        profile: { ...command.profile, role: "owner" },
      }),
    /unrecognized/i,
  );
  assert.throws(
    () =>
      clientOnboardingTaskCommandSchema.parse({
        ...command,
        completedAt: new Date().toISOString(),
      }),
    /unrecognized/i,
  );
});

test("client onboarding HTTP rejects an unregistered origin before command execution", async () => {
  let executed = false;
  const post = createClientOnboardingTaskHandler({
    enabled: true,
    origin: "https://portal.example.test",
    createCorrelationId: randomUUID,
    authorize: async () => ({
      userId: "b0b740cb-e525-4e33-b6ff-fb5fc3a4a7f3",
      email: "client@example.test",
      emailVerified: true as const,
    }),
    reportUnexpectedError: () => undefined,
    execute: async () => {
      executed = true;
      return { taskId, state: "complete" as const };
    },
  });

  const response = await post(
    new Request("https://portal.example.test/api/portal/organisations/tasks", {
      method: "POST",
      headers: {
        origin: "https://untrusted.example.test",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        action: "complete_profile",
        taskId,
        expectedTemplateVersionId: templateVersionId,
        profile: { preferredName: "Alex Morgan" },
      }),
    }),
    organisationId,
  );

  assert.equal(response.status, 403);
  assert.equal(executed, false);
});

test("client onboarding HTTP binds an item route to the task in its payload", async () => {
  let executed = false;
  const post = createClientOnboardingTaskHandler({
    enabled: true,
    origin: "https://portal.example.test",
    createCorrelationId: randomUUID,
    authorize: async () => ({
      userId: "b0b740cb-e525-4e33-b6ff-fb5fc3a4a7f3",
      email: "client@example.test",
      emailVerified: true as const,
    }),
    reportUnexpectedError: () => undefined,
    execute: async () => {
      executed = true;
      return { taskId, state: "complete" as const };
    },
  });

  const response = await post(
    new Request("https://portal.example.test/api/portal/organisations/tasks", {
      method: "POST",
      headers: {
        origin: "https://portal.example.test",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        action: "attach_cleared_documents",
        taskId: randomUUID(),
        expectedTemplateVersionId: templateVersionId,
        documentIds: ["3b59450e-a112-4bbb-bca5-c8e9df6e1d0c"],
      }),
    }),
    organisationId,
    taskId,
  );

  assert.equal(response.status, 404);
  assert.equal(executed, false);
});
