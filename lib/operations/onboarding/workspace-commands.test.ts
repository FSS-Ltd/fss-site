import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { onboardingWorkspaceCommandSchema } from "./workspace-commands";

const taskId = randomUUID();
const templateCommand = {
  action: "save_template_draft" as const,
  templateId: randomUUID(),
  name: "Studio launch",
  expectedVersion: 0,
  reviewReference: "workspace-command-test",
  tasks: [
    {
      id: taskId,
      title: "Confirm your details",
      instructions: "Check the contact details we will use for your project.",
      kind: "profile",
      ownerRole: "owner",
      required: true,
      dependsOnTaskId: null,
      dueRule: "activation",
      evidenceRule: "profile_saved",
      bookingUrl: null,
    },
  ],
};

test("accepts bounded staff template draft commands", () => {
  const command = onboardingWorkspaceCommandSchema.parse(templateCommand);

  assert.equal(command.action, "save_template_draft");
  assert.equal(command.tasks[0]?.evidenceRule, "profile_saved");
});

test("rejects unrecognised workspace actions and browser timestamps", () => {
  assert.throws(
    () =>
      onboardingWorkspaceCommandSchema.parse({
        ...templateCommand,
        action: "start_now",
      }),
    /invalid/i,
  );
  assert.throws(
    () =>
      onboardingWorkspaceCommandSchema.parse({
        ...templateCommand,
        completedAt: new Date().toISOString(),
      }),
    /unrecognized/i,
  );
});
