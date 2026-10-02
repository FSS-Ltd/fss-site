import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { defaultActiveStudioSettings } from "@/lib/operations/studio/active-settings-types";
import { createSettingsEditorState } from "./settings-editor-state";
const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_, key) => String(key) }),
  };
};
const { AppRouterContext } =
  require("next/dist/shared/lib/app-router-context.shared-runtime") as typeof import("next/dist/shared/lib/app-router-context.shared-runtime");
const router: AppRouterInstance = {
  back: () => undefined,
  bfcacheId: "settings-test",
  forward: () => undefined,
  prefetch: () => undefined,
  push: () => undefined,
  refresh: () => undefined,
  replace: () => undefined,
};
const { StudioSettings } =
  require("./studio-settings") as typeof import("./studio-settings");
const { SettingsSectionCard } =
  require("./settings-section-card") as typeof import("./settings-section-card");

test("shows applied settings as four summary cards with contextual edits and honest configuration availability", () => {
  const html = renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <StudioSettings
        settings={{
          active: defaultActiveStudioSettings,
          approvedReplyTo: [],
          draft: {
            ...defaultActiveStudioSettings,
            revision: 9,
            displayName: "Historical draft name",
            createdAt: "2026-09-21T10:00:00Z",
          },
          integrationConfiguration: [
            {
              available: true,
              detail: "Identity is deployment-managed.",
              name: "Authentication",
            },
          ],
        }}
      />
    </AppRouterContext.Provider>,
  );
  for (const title of ["Identity", "Communication", "Timezone", "Delivery"])
    assert.match(html, new RegExp(`Edit ${title.toLowerCase()}`));
  assert.match(html, /Faithful Software Solutions/);
  assert.match(html, /Configuration availability/);
  assert.match(html, /live provider health/);
  assert.match(html, /Historical draft revision 9/);
  assert.doesNotMatch(
    html,
    /Historical draft name|Save settings draft|Secret key|<form/,
  );
});

test("focused editors label fields, show pending/error states and offer explicit conflict review", () => {
  const base = {
    ...createSettingsEditorState(defaultActiveStudioSettings),
    section: "communication" as const,
    values: { ...defaultActiveStudioSettings, responseExpectationHours: 24 },
  };
  const props = {
    section: "communication" as const,
    approvedReplyTo: ["studio@example.test"],
    onEdit: () => undefined,
    onChange: () => undefined,
    onClose: () => undefined,
    onSubmit: () => undefined,
    onReviewConflict: () => undefined,
  };
  const pending = renderToStaticMarkup(
    <SettingsSectionCard {...props} state={{ ...base, status: "pending" }} />,
  );
  assert.match(pending, /Save and apply/);
  assert.match(pending, /aria-busy="true"/);
  assert.match(pending, /value="24"/);
  const failed = renderToStaticMarkup(
    <SettingsSectionCard
      {...props}
      state={{ ...base, status: "error", message: "Your edits are retained" }}
    />,
  );
  assert.match(failed, /role="alert"/);
  assert.match(failed, /Your edits are retained/);
  const conflict = renderToStaticMarkup(
    <SettingsSectionCard
      {...props}
      state={{
        ...base,
        status: "conflict",
        conflict: { ...defaultActiveStudioSettings, revision: 5 },
        message: "Review current settings",
      }}
    />,
  );
  assert.match(conflict, /Applied revision 5/);
  assert.match(conflict, /Review and use current revision/);
  assert.match(conflict, /value="24"/);
});
