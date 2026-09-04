import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalUrl,
  createPageMetadata,
  pageSchemaId,
  socialImage,
} from "./metadata";
import { isoDateSchema } from "./content";
import { buildRootSchema } from "./schema";

test("canonical URLs discard query fragments and trailing slashes without accepting another origin", () => {
  assert.equal(
    canonicalUrl("/services/?ref=email#details"),
    "https://faithfulsoftware.dev/services",
  );
  assert.equal(canonicalUrl("/"), "https://faithfulsoftware.dev");
  assert.throws(() => canonicalUrl("https://example.com/services"));
  assert.throws(() => canonicalUrl("//example.com/services"));
  assert.equal(
    pageSchemaId("/about", "webpage"),
    "https://faithfulsoftware.dev/about#webpage",
  );
});

test("metadata uses an absolute title once and self canonical social URLs", () => {
  const metadata = createPageMetadata({
    path: "/services",
    title: "Custom software | FSS",
    description: "Software for organisations.",
  });
  assert.deepEqual(metadata.title, { absolute: "Custom software | FSS" });
  assert.deepEqual(metadata.alternates, {
    canonical: "https://faithfulsoftware.dev/services",
    types: { "application/rss+xml": "https://faithfulsoftware.dev/feed.xml" },
  });
  assert.equal(
    metadata.openGraph?.url,
    "https://faithfulsoftware.dev/services",
  );
  assert.deepEqual(socialImage("/services", "Services"), {
    url: "https://faithfulsoftware.dev/social/services",
    width: 1200,
    height: 630,
    alt: "Services",
  });
  assert.equal(
    socialImage("/", "FSS").url,
    "https://faithfulsoftware.dev/social/home",
  );
  assert.deepEqual(
    createPageMetadata({
      path: "/contact",
      title: "Contact",
      description: "Contact",
      index: false,
    }).robots,
    { index: false, follow: true },
  );
});

test("ISO content dates reject invalid calendar dates and ambiguous formats", () => {
  assert.equal(isoDateSchema.parse("2024-02-29"), "2024-02-29");
  assert.equal(
    isoDateSchema.parse(new Date("2026-04-02T00:00:00Z")),
    "2026-04-02",
  );
  for (const value of [
    "2026-02-29",
    "2026-13-01",
    "02/04/2026",
    "2026-4-2",
    "",
    new Date("invalid"),
  ]) {
    assert.equal(isoDateSchema.safeParse(value).success, false);
  }
});

test("root graph connects organisation, website and evidenced founder without a search action", () => {
  const graph = buildRootSchema()["@graph"];
  const organisation = graph.find((node) => node["@type"] === "Organization");
  const website = graph.find((node) => node["@type"] === "WebSite");
  assert.ok(organisation && website);
  assert.equal(
    organisation["@id"],
    "https://faithfulsoftware.dev/#organization",
  );
  assert.equal(organisation.legalName, "Faithful Software Solutions Ltd");
  assert.equal(organisation.identifier, "16682725");
  assert.deepEqual(organisation.sameAs, [
    "https://www.linkedin.com/company/faithful-software-solutions-ltd",
  ]);
  assert.deepEqual(website.publisher, { "@id": organisation["@id"] });
  assert.equal(JSON.stringify(graph).includes("SearchAction"), false);
  assert.equal(JSON.stringify(graph).includes("Jean-Fidele Ntagengwa"), true);
});
