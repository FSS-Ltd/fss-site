import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  ClientOnboardingTask,
  ClientOnboardingWorkspace,
} from "@/lib/operations/onboarding/client-workspace";
import type { PortalWorkspaceDocument } from "@/lib/operations/workspaces/types";

const require = createRequire(import.meta.url);

require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};

const { ClientOnboardingTaskDetail } =
  require("./client-onboarding-task") as typeof import("./client-onboarding-task");
const { ClientOnboardingWorkspaceView } =
  require("./client-onboarding-workspace") as typeof import("./client-onboarding-workspace");

const profileTask: ClientOnboardingTask = {
  id: "5c4ca4d0-d7ce-4966-ab8a-7842f44ae673",
  templateVersionId: "62bd1fe5-34b8-4ba3-aa16-eaf0f4df8550",
  title: "Confirm your project details",
  instructions: "Tell us the best contact details for your delivery team.",
  kind: "profile",
  required: true,
  ownerLabel: "Assigned to owner.",
  dueAt: null,
  state: "available",
  completionDetail: null,
  action: { type: "complete_profile" },
};

const assetTask: ClientOnboardingTask = {
  id: "5388cf9d-9b60-4f5c-a13b-b173efe4a98e",
  templateVersionId: profileTask.templateVersionId,
  title: "Share brand assets",
  instructions: "Choose the cleared files we should use to start the work.",
  kind: "upload",
  required: true,
  ownerLabel: "Assigned to owner.",
  dueAt: null,
  state: "available",
  completionDetail: null,
  action: { type: "attach_cleared_documents" },
};

const workspace: ClientOnboardingWorkspace = {
  checklist: {
    agreementSigned: true,
    billingReady: false,
    filesReady: false,
    serviceReady: false,
  },
  tasks: [profileTask, assetTask],
  requiredTasksComplete: false,
};

const documents: readonly PortalWorkspaceDocument[] = [
  {
    id: "a05d40d6-184f-4fc3-916a-0591f46e1812",
    kind: "file",
    projectId: "4d8baa71-c2ea-4d82-ae2c-e1b3c5c078e3",
    projectTitle: "Website refresh",
    title: "Brand pack",
    filename: "brand-pack.pdf",
    mimeType: "application/pdf",
    sizeBytes: 38_400,
  },
];

test("renders the client launch checklist from server-derived task states", () => {
  const html = renderToStaticMarkup(
    <ClientOnboardingWorkspaceView
      organisationId="73da6acb-e24f-4e2f-bd90-13d58634ad39"
      workspace={workspace}
    />,
  );

  assert.match(html, /Your launch checklist/);
  assert.match(html, /Share brand assets/);
  assert.match(html, /Agreement signed/);
  assert.match(html, /Available/);
});

test("renders the completion hero only when every required task is complete", () => {
  const html = renderToStaticMarkup(
    <ClientOnboardingWorkspaceView
      organisationId="73da6acb-e24f-4e2f-bd90-13d58634ad39"
      workspace={{
        ...workspace,
        requiredTasksComplete: true,
        tasks: [
          {
            ...profileTask,
            completionDetail: "Project contact confirmed.",
            state: "complete",
            action: { type: "none" },
          },
          { ...assetTask, required: false },
        ],
      }}
    />,
  );

  assert.match(html, /Your project is ready to begin/);
  assert.match(html, /Share brand assets/);
});

test("renders truthful task-specific guidance without membership controls", () => {
  const profileHtml = renderToStaticMarkup(
    <ClientOnboardingTaskDetail
      organisationId="73da6acb-e24f-4e2f-bd90-13d58634ad39"
      task={profileTask}
    />,
  );
  const uploadHtml = renderToStaticMarkup(
    <ClientOnboardingTaskDetail
      documents={documents}
      organisationId="73da6acb-e24f-4e2f-bd90-13d58634ad39"
      task={assetTask}
    />,
  );
  const blockedHtml = renderToStaticMarkup(
    <ClientOnboardingTaskDetail
      organisationId="73da6acb-e24f-4e2f-bd90-13d58634ad39"
      task={{ ...assetTask, state: "blocked", action: { type: "none" } }}
    />,
  );

  assert.match(uploadHtml, /Safety checks passed/);
  assert.match(blockedHtml, /Complete the previous required step first/);
  assert.doesNotMatch(profileHtml, /Owner role.*select/i);
});
