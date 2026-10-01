import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createDesignedWelcomePack } from "@/lib/operations/onboarding/packet-editions";
import type { WelcomePack } from "@/lib/operations/onboarding/welcome-pack-contract";
const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};
const { WelcomePackEditor } =
  require("./welcome-pack-editor") as typeof import("./welcome-pack-editor");
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
  assert.match(html, /10 pages/);
  assert.match(html, /Open packet/);
  assert.doesNotMatch(html, /<textarea/);
});
