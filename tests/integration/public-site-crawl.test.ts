import assert from "node:assert/strict";
import test from "node:test";
import sitemap from "@/app/sitemap";
import { getAllResources } from "@/lib/resources";
import { commercialPages } from "@/lib/commercial/pages";

const origin = process.env.PUBLIC_SITE_TEST_URL;
const canonicalOrigin = "https://faithfulsoftware.dev";

function attributes(tag: string): Record<string, string> {
  return Object.fromEntries(
    [...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((match) => [
      match[1],
      match[2].replaceAll("&amp;", "&"),
    ]),
  );
}

function tags(html: string, name: string): Record<string, string>[] {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi"))].map(
    (match) => attributes(match[0]),
  );
}

test(
  "built public site satisfies crawl, metadata, link and redirect contracts",
  { timeout: 120_000 },
  async () => {
    assert.ok(
      origin,
      "Set PUBLIC_SITE_TEST_URL to the running production build, for example http://localhost:3100",
    );
    const request = (pathname: string) =>
      fetch(new URL(pathname, origin), { redirect: "manual" });
    const expected = (await sitemap()).map((entry) => entry.url).sort();
    const sitemapResponse = await request("/sitemap.xml");
    assert.equal(sitemapResponse.status, 200);
    const locations = [
      ...(await sitemapResponse.text()).matchAll(/<loc>([^<]+)<\/loc>/g),
    ]
      .map((match) => match[1])
      .sort();
    assert.deepEqual(
      locations,
      expected,
      "built sitemap matches source indexability and has no duplicates",
    );
    const pages = new Map<string, string>();
    const titles = new Set<string>();
    const links = new Set<string>();
    const fragments: URL[] = [];
    for (const url of locations) {
      const pathname = new URL(url).pathname;
      const response = await request(pathname);
      assert.equal(response.status, 200, pathname);
      assert.doesNotMatch(
        response.headers.get("x-robots-tag") ?? "",
        /noindex/i,
        pathname,
      );
      const html = await response.text();
      pages.set(pathname, html);
      assert.equal(
        (html.match(/<h1[\s>]/g) ?? []).length,
        1,
        `${pathname}: one H1`,
      );
      const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
      assert.ok(title, pathname);
      assert.equal(titles.has(title), false, `${pathname}: duplicate title`);
      titles.add(title);
      const canonicals = tags(html, "link").filter(
        (tag) => tag.rel === "canonical",
      );
      assert.deepEqual(
        canonicals.map((tag) => tag.href),
        [url],
        `${pathname}: self canonical`,
      );
      assert.ok(
        tags(html, "meta")
          .filter((tag) => tag.name === "robots")
          .every((tag) => !tag.content?.includes("noindex")),
        pathname,
      );
      for (const tag of tags(html, "a")) {
        if (!tag.href || /^(mailto:|tel:|javascript:)/.test(tag.href)) continue;
        const target = new URL(tag.href, canonicalOrigin + pathname);
        if (target.origin === canonicalOrigin) {
          links.add(target.pathname + target.search);
          if (target.hash) fragments.push(target);
        }
      }
    }
    for (const link of links) {
      const response = await request(link);
      assert.equal(
        response.status,
        200,
        `${link}: internal links must reach their final destination directly`,
      );
      if (
        response.headers.get("content-type")?.includes("text/html") &&
        !pages.has(new URL(link, origin).pathname)
      ) {
        const html = await response.text();
        assert.ok(
          /noindex/i.test(response.headers.get("x-robots-tag") ?? "") ||
            tags(html, "meta").some(
              (tag) => tag.name === "robots" && /noindex/i.test(tag.content),
            ),
          `${link}: indexable linked page missing from sitemap`,
        );
      } else await response.body?.cancel();
    }
    for (const target of fragments) {
      const html = pages.get(target.pathname);
      assert.ok(html, target.pathname);
      const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(
        (match) => match[1],
      );
      assert.ok(
        ids.includes(decodeURIComponent(target.hash.slice(1))),
        `${target.pathname}${target.hash}: broken fragment`,
      );
    }
    for (const route of Object.keys(commercialPages)) {
      assert.ok(
        [...pages].some(
          ([source, html]) =>
            source !== route &&
            tags(html, "a").some((tag) => tag.href === route),
        ),
        `${route}: orphaned commercial page`,
      );
    }
    for (const [oldSlug, newSlug] of [
      ["sdk-integration-readiness-kit", "software-project-readiness-kit"],
      [
        "technical-content-conversion-playbook",
        "software-investment-framework",
      ],
    ]) {
      for (const suffix of ["", "/thank-you"]) {
        const destination = `/resources/${newSlug}${suffix}`;
        const response = await request(`/resources/${oldSlug}${suffix}`);
        assert.equal(response.status, 308);
        const location = response.headers.get("location");
        assert.ok(location);
        assert.equal(new URL(location, origin).pathname, destination);
        assert.equal(
          (await request(destination)).status,
          200,
          "redirect has one hop",
        );
      }
    }
    const resources = await getAllResources();
    for (const resource of resources) {
      if (resource.delivery.type !== "direct_download") continue;
      assert.ok(resource.delivery.url);
      const response = await request(resource.delivery.url);
      assert.equal(response.status, 200, resource.slug);
      assert.match(
        response.headers.get("content-type") ?? "",
        /application\/pdf/i,
      );
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(bytes.subarray(0, 5).toString(), "%PDF-", resource.slug);
    }
    for (const route of [
      "/growth",
      "/growth/login",
      "/preview/crawl-contract-not-a-real-preview",
      ...resources.map((resource) => `/resources/${resource.slug}/thank-you`),
    ]) {
      const response = await request(route);
      assert.equal(
        response.status,
        route === "/growth" ? 307 : route.startsWith("/preview/") ? 404 : 200,
        `${route}: expected private route response`,
      );
      assert.match(
        response.headers.get("x-robots-tag") ?? "",
        /noindex/i,
        route,
      );
      assert.equal(locations.includes(canonicalOrigin + route), false);
    }
    const missing = await request("/blog/crawl-contract-does-not-exist");
    assert.equal(missing.status, 404);
    process.stdout.write(
      `Crawled ${pages.size} indexable pages, checked ${links.size} internal destinations, ${fragments.length} fragments and ${resources.length} PDF downloads.\n`,
    );
  },
);
