import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import sitemap from "@/app/sitemap";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};

const routes = [
  "/sectors/charities-faith-organisations",
  "/services/custom-software-development",
  "/services/portal-development",
  "/services/workflow-automation",
  "/work/nexsteps",
  "/services/software-modernisation",
  "/services/private-ai",
  "/guides/custom-software-cost-uk",
  "/blog/church-management-software-vs-bespoke",
];

for (const route of routes) {
  test(`${route} publishes matching metadata, visible content and schema`, () => {
    const { default: Page, metadata } = require(
      `../../app/(site)${route}/page`,
    );
    const html = renderToStaticMarkup(<Page />);
    const url = `https://faithfulsoftware.dev${route}`;
    assert.equal(metadata.alternates.canonical, url);
    assert.equal(metadata.openGraph.url, url);
    assert.equal(
      metadata.openGraph.images[0].url,
      `https://faithfulsoftware.dev/social${route}`,
    );
    assert.equal(metadata.openGraph.images[0].width, 1200);
    assert.equal(metadata.openGraph.images[0].height, 630);
    assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1);
    assert.equal((html.match(/href="\/contact"/g) ?? []).length, 1);
    assert.match(html, /aria-label="Breadcrumb"/);
    assert.match(html, /aria-current="page"/);
    assert.match(html, /Frequently asked questions/);
    assert.match(html, /Related reading and next steps/);
    assert.match(html, /href="\/resources"/);
    assert.doesNotMatch(html, /<canvas|href="\/?#work"/);
    const script = html.match(
      /<script type="application\/ld\+json">(.*?)<\/script>/,
    )?.[1];
    assert.ok(script);
    const graph = JSON.parse(script)["@graph"];
    const page = graph.find(
      (node: { "@type": string }) => node["@type"] === "WebPage",
    );
    assert.equal(page.url, url);
    assert.equal(page.name, metadata.title.absolute);
    assert.equal(page.description, metadata.description);
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, "HTML IDs are unique");
    const breadcrumbs = graph.find(
      (node: { "@type": string }) => node["@type"] === "BreadcrumbList",
    );
    assert.equal(breadcrumbs.itemListElement.at(-1).item, url);
    assert.equal(
      breadcrumbs.itemListElement[0].item,
      "https://faithfulsoftware.dev",
    );
    const faq = graph.find(
      (node: { "@type": string }) => node["@type"] === "FAQPage",
    );
    for (const question of faq.mainEntity) {
      assert.ok(html.includes(renderToStaticMarkup(<h3>{question.name}</h3>)));
      assert.ok(
        html.includes(
          renderToStaticMarkup(<p>{question.acceptedAnswer.text}</p>),
        ),
      );
    }
    if (route.startsWith("/services/")) {
      assert.ok(
        graph.some(
          (node: { "@type": string; url: string }) =>
            node["@type"] === "Service" && node.url === url,
        ),
      );
    }
  });
}

test("all commercial routes are indexable and discoverable exactly once", async () => {
  const entries = await sitemap();
  for (const route of routes) {
    assert.equal(
      entries.filter(
        (entry) => entry.url === `https://faithfulsoftware.dev${route}`,
      ).length,
      1,
    );
  }
});

test("commercial titles are unique and authority content avoids unsupported metrics and prices", () => {
  const { commercialPages } =
    require("@/lib/commercial/pages") as typeof import("@/lib/commercial/pages");
  const titles = Object.values(commercialPages).map((page) => page.title);
  assert.equal(new Set(titles).size, titles.length);
  for (const route of [
    "/work/nexsteps",
    "/guides/custom-software-cost-uk",
  ] as const) {
    const page = commercialPages[route];
    const content = JSON.stringify([page.answer, page.sections, page.faqs]);
    assert.doesNotMatch(
      content,
      /£|\d+%|award-winning|guaranteed|testimonial from/i,
    );
  }
});

test("sector hub and spokes link reciprocally", () => {
  const hub = routes[0];
  const { default: Hub } = require(`../../app/(site)${hub}/page`);
  const hubHtml = renderToStaticMarkup(<Hub />);
  for (const route of routes.slice(1)) {
    assert.ok(
      hubHtml.includes(`href="${route}"`),
      `${route} is linked from hub`,
    );
    const { default: Page } = require(`../../app/(site)${route}/page`);
    assert.ok(
      renderToStaticMarkup(<Page />).includes(`href="${hub}"`),
      `${route} links to hub`,
    );
  }
});

test("existing public routes connect readers to the new commercial pages", async () => {
  for (const route of [
    "",
    "/about",
    "/services",
    "/resources",
    "/blog",
    "/contact",
  ]) {
    const { default: Page } = require(`../../app/(site)${route}/page`);
    const html = renderToStaticMarkup(await Page());
    assert.match(html, /href="\/sectors\/charities-faith-organisations"/);
    assert.doesNotMatch(html, /href="\/?#work"/);
  }
  const { navItems } = require("../layout/site-header-nav-items");
  assert.equal(
    navItems.find((item: { label: string }) => item.label === "Work").href,
    "/work/nexsteps",
  );
  assert.equal(
    navItems.find((item: { label: string }) => item.label === "Work")
      .activePath,
    "/work/nexsteps",
  );
});
