import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);

require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};

const { JourneyTemplateEditor } =
  require("./journey-template-editor") as typeof import("./journey-template-editor");

test("renders a versioned checklist editor", () => {
  const html = renderToStaticMarkup(
    <JourneyTemplateEditor
      commandEndpoint="/api/portal/admin/welcome/templates?organisationId=org"
      templates={[
        {
          draftVersion: 1,
          id: "13db3b9b-ad10-4641-a11e-42d8e1dd74c8",
          name: "Studio launch",
          publishedVersion: 1,
          tasks: [
            {
              bookingUrl: null,
              dependsOnTaskId: null,
              dueRule: "activation",
              evidenceRule: "profile_saved",
              id: "7795e784-a909-45fd-b205-67fb508a181f",
              instructions: "Confirm your details for the project workspace.",
              kind: "profile",
              ownerRole: "owner",
              required: true,
              title: "Confirm your details",
            },
          ],
        },
      ]}
    />,
  );

  assert.match(html, /Welcome templates/);
  assert.match(html, /Client checklist/);
  assert.match(html, /Versioned publishing/);
  assert.match(html, /Active journeys retain their/);
});
