import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("personal brand colours stay scoped to the public site shell", () => {
  const css = readFileSync(
    new URL("../../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(css, /:root\s*\{[^}]*--brand-primary:\s*#14989e/);
  assert.match(css, /#fssroot\s*\{[^}]*--brand-primary:\s*#a64224/);
  assert.match(css, /#fssroot\s*\{[^}]*--brand-accent:\s*#b55937/);
  assert.match(css, /#fssroot\s*\{[^}]*--brand-fss-teal:\s*#14989e/);
  assert.match(css, /#fssroot\s*\{[^}]*--brand-fss-cyan:\s*#46c7d8/);
  assert.match(css, /#fssroot\s*\{[^}]*--brand-fss-navy:\s*#07182e/);
  assert.match(css, /#fssroot\s*\{[^}]*--foreground:\s*#211b17/);
  assert.match(css, /#fssroot\s*\{[^}]*--brand-secondary:\s*#211b17/);
  assert.match(
    css,
    /#fssroot\s*\{[^}]*--button-shadow:\s*rgba\(33, 27, 23, 0\.65\)/,
  );
});

test("public foundations render readable motion-enhanced content", () => {
  for (const route of ["", "services/", "about/", "contact/"]) {
    const { default: Page } = require(`../../app/(site)/${route}page`);
    const html = renderToStaticMarkup(<Page />);
    assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1);
    assert.match(html, /data-hero-canvas/);
    assert.match(html, /data-motion-reveal/);
    assert.doesNotMatch(html, /style="[^"]*opacity:\s*0/);
  }
});

test("primary public calls to action opt into magnetic pointer feedback", () => {
  for (const route of ["", "services/", "about/"]) {
    const { default: Page } = require(`../../app/(site)/${route}page`);
    const html = renderToStaticMarkup(<Page />);
    assert.match(html, /data-magnetic="true"/);
    assert.match(html, /data-mag-label="true"/);
  }
});

test("public hero variants render the shared particle canvas", () => {
  const pageModules = [
    ["../../app/(site)/page", "Page"],
    ["../../app/(site)/services/page", "Page"],
    ["../../app/(site)/about/page", "Page"],
    ["../../app/(site)/contact/page", "Page"],
    [
      "../../app/(site)/ai-deployment-questionnaire/page",
      "AiQuestionnairePage",
    ],
    ["../../app/(site)/start/page", "BusinessIntakePage"],
  ] as const;

  for (const [modulePath, componentName] of pageModules) {
    const pageModule = require(modulePath);
    const Component = pageModule[componentName] ?? pageModule.default;
    const html = renderToStaticMarkup(<Component />);
    assert.match(html, /data-hero-canvas/);
  }

  const { BlogIndex } = require("./blog/blog-index");
  const { ResourceLibrary } = require("./resources/resource-library");
  assert.match(
    renderToStaticMarkup(<BlogIndex posts={[]} />),
    /data-hero-canvas/,
  );
  assert.match(
    renderToStaticMarkup(<ResourceLibrary resources={[]} />),
    /data-hero-canvas/,
  );
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
  assert.match(html, /<button[^>]*type="submit"[^>]*disabled=""[^>]*>/);
  assert.match(html, /Send project enquiry/);
  assert.doesNotMatch(html, /Book a|Opens your email app/);
});

test("the opening mission scene contains five outcome-led phrases, not a title-only curtain", () => {
  const { HomeValueStory } = require("./public/home-story");
  const html = renderToStaticMarkup(<HomeValueStory />);
  assert.equal((html.match(/data-story-chapter=/g) ?? []).length, 5);
  assert.match(html, /Built around your mission/);
  assert.match(html, /Less admin. More time for people/);
  assert.match(html, /More confident decisions/);
  assert.match(html, /data-value-particles/);
  assert.match(html, /data-hero-canvas/);
  assert.doesNotMatch(html, /data-story-curtain|opacity:0/);
});

test("the mobile concept keeps a static image fallback and an isolated atom canvas", () => {
  const { AppJourney } = require("./public/app-journey");
  const html = renderToStaticMarkup(
    <AppJourney>
      <p>Services</p>
    </AppJourney>,
  );
  assert.equal((html.match(/data-app-atoms=/g) ?? []).length, 1);
  assert.doesNotMatch(html, /data-app-tile=/);
  assert.match(html, /data-app-image/);
  assert.match(html, /Illustrative app concept/);
});

test("home carries the hero mission branding and a dedicated delivery scene", () => {
  const { HomePage } = require("./public/home-page");
  const html = renderToStaticMarkup(<HomePage />);
  assert.match(html, /fss-monogram-white/);
  assert.match(html, /For Your Mission/);
  assert.match(html, /data-motion-delivery="cinematic"/);
  assert.equal((html.match(/data-delivery-step=/g) ?? []).length, 3);
});
