import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { parseOnboardingTemplateDraft } from "./workspace-schema";

const profileTask = {
  id: randomUUID(),
  title: "Confirm your working details",
  instructions: "Check the people who should receive project updates.",
  kind: "profile",
  ownerRole: "owner",
  required: true,
  dependsOnTaskId: null,
  dueRule: "activation",
  evidenceRule: "profile_saved",
  bookingUrl: null,
};

test("rejects a checklist task that depends on itself", () => {
  const task = {
    ...profileTask,
    id: randomUUID(),
  };

  assert.throws(
    () =>
      parseOnboardingTemplateDraft({
        name: "Project welcome",
        tasks: [{ ...task, dependsOnTaskId: task.id }],
      }),
    /dependency/i,
  );
});

test("requires an explicit evidence rule for an upload task", () => {
  assert.throws(
    () =>
      parseOnboardingTemplateDraft({
        name: "Project welcome",
        tasks: [
          profileTask,
          {
            ...profileTask,
            id: randomUUID(),
            title: "Share approved brand assets",
            kind: "upload",
            ownerRole: "contributor",
            evidenceRule: "profile_saved",
          },
        ],
      }),
    /evidence/i,
  );
});

test("rejects an indirect checklist dependency cycle", () => {
  const firstId = randomUUID();
  const secondId = randomUUID();

  assert.throws(
    () =>
      parseOnboardingTemplateDraft({
        name: "Project welcome",
        tasks: [
          {
            ...profileTask,
            id: firstId,
            dependsOnTaskId: secondId,
          },
          {
            ...profileTask,
            id: secondId,
            title: "Confirm the project introduction",
            kind: "acknowledgement",
            evidenceRule: "acknowledged",
            dependsOnTaskId: firstId,
          },
        ],
      }),
    /cycle/i,
  );
});

test("accepts a versioned template draft with a profile task", () => {
  const draft = parseOnboardingTemplateDraft({
    name: "Project welcome",
    tasks: [profileTask],
  });

  assert.equal(draft.name, "Project welcome");
  assert.equal(draft.tasks[0]?.kind, "profile");
  assert.equal(draft.tasks[0]?.evidenceRule, "profile_saved");
});
