import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createDesignedWelcomePack } from "@/lib/operations/onboarding/packet-editions";
import type { WelcomePack } from "@/lib/operations/onboarding/welcome-pack-contract";
import { welcomePackContentSchema } from "@/lib/operations/onboarding/welcome-pack-contract";
const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};
const { WelcomePackEditor } =
  require("./welcome-pack-editor") as typeof import("./welcome-pack-editor");
const { WelcomePackLibrary } =
  require("./welcome-pack-library") as typeof import("./welcome-pack-library");
test("opens welcome templates as a cover library before exposing editing fields", () => {
  const pack: WelcomePack = {
    id: "website_build",
    title: "Website Build",
    draftVersion: 1,
    publishedVersion: 0,
    content: createDesignedWelcomePack("website_build"),
    versions: [],
  };
  const html = renderToStaticMarkup(<WelcomePackEditor packs={[pack]} />);
  assert.match(html, /Predesigned welcome packets/);
  assert.match(html, /Not published/);
  assert.doesNotMatch(html, /10 pages/);
  assert.match(html, /Open packet/);
  assert.doesNotMatch(html, /<textarea/);
});

test("journey library reports the published version rather than a newer draft", () => {
  const designed = createDesignedWelcomePack("website_build");
  const legacy = welcomePackContentSchema.parse({
    emailSubject: designed.emailSubject,
    emailBody: designed.emailBody,
    guide: designed.guide
      .slice(0, 5)
      .map(({ title, paragraphs }) => ({ title, paragraphs })),
    thankYou: designed.thankYou,
    tasks: designed.tasks,
  });
  const pack: WelcomePack = {
    id: "website_build",
    title: "Website Build",
    draftVersion: 2,
    publishedVersion: 1,
    content: designed,
    versions: [
      {
        id: "23c9f3cb-77f7-4c05-b859-f319c88b14a0",
        version: 1,
        content: legacy,
        publishedAt: "2026-10-10T10:00:00Z",
      },
    ],
  };
  const html = renderToStaticMarkup(
    <WelcomePackLibrary
      packs={[pack]}
      onChoose={() => {}}
      actionLabel="Use packet"
      requireDesignedPublished
    />,
  );
  assert.match(html, /5 sections/);
  assert.match(html, /Published v1/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Use packet/);
  assert.doesNotMatch(html, /10 pages/);
});
