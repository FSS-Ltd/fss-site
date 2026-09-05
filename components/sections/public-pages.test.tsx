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

test("public foundations render readable content without a canvas or hidden entrance states", () => {
  for (const route of ["", "services/", "about/", "contact/"]) {
    const { default: Page } = require(`../../app/(site)/${route}page`);
    const html = renderToStaticMarkup(<Page />);
    assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1);
    assert.doesNotMatch(
      html,
      /<canvas|data-magnetic|data-reveal|data-sc-sticky|fssWordUp/,
    );
  }
});

test("home keeps its audience, proof and FSS visual language in the rendered document", () => {
  const { default: Page, metadata } = require("../../app/(site)/page");
  assert.deepEqual(metadata.title, {
    absolute: "Custom Software for UK Charities & Faith Organisations | FSS",
  });
  const html = renderToStaticMarkup(<Page />);
  assert.match(html, /UK charities/);
  assert.match(html, /faith organisations/);
  assert.match(html, /NexSteps/);
  assert.match(html, /FSS \/ SYSTEMS/);
  assert.match(html, /Custom platforms and portals/);
  assert.ok((html.match(/href="\/contact"/g) ?? []).length >= 1);
  assert.doesNotMatch(html, /href="\/start"/);
});

test("contact renders the API fields with accessible choices and enquiry metadata", () => {
  const { default: Page, metadata } = require("../../app/(site)/contact/page");
  assert.match(metadata.title.absolute, /Discuss a custom software project/);
  const html = renderToStaticMarkup(<Page />);
  for (const name of [
    "firstName",
    "lastName",
    "workEmail",
    "company",
    "challenge",
  ]) {
    assert.match(html, new RegExp(`name="${name}"`));
  }
  assert.match(html, /type="radio"/);
  assert.match(html, /type="checkbox"/);
  assert.match(html, /<form[^>]*method="post"/);
  assert.match(
    html,
    /<button[^>]*disabled=""[^>]*>Send project enquiry<\/button>/,
  );
  assert.doesNotMatch(html, /Book a|Opens your email app/);
});
