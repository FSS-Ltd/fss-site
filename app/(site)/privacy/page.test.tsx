import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, property) => String(property) }),
  };
};

const { default: PrivacyPage } = require("./page") as typeof import("./page");

test("publishes the controller identity and effective date", () => {
  const html = renderToStaticMarkup(<PrivacyPage />);

  assert.match(html, /Effective 26 August 2026/);
  assert.match(html, /Faithful Software Solutions Ltd/);
  assert.match(html, /16682725/);
  assert.match(html, /51 Hurst Road/);
  assert.match(html, /hello@faithfulsoftware\.dev/);
});

test("discloses Growth OS research, Gmail data use, and provider boundaries", () => {
  const html = renderToStaticMarkup(<PrivacyPage />);

  assert.match(html, /public corporate and business contact information/i);
  assert.match(html, /gmail\.modify/);
  assert.match(html, /founder-approved business email/i);
  assert.match(html, /never sell/i);
  assert.match(html, /advertising/i);
  assert.match(html, /general-purpose AI training/i);
  assert.match(html, /Vercel/);
  assert.match(html, /Supabase/);
  assert.match(html, /Resend/);
  assert.match(html, /HubSpot/);
});

test("explains analytics consent, withdrawal, rights, and ICO complaints", () => {
  const html = renderToStaticMarkup(<PrivacyPage />);

  assert.match(html, /Google Analytics only after you accept/i);
  assert.match(html, /Cookie settings/i);
  assert.match(html, /withdraw your consent/i);
  assert.match(html, /href="https:\/\/ico\.org\.uk\/make-a-complaint\/"/i);
});
