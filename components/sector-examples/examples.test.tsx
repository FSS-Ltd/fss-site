import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { sectorExamples } from "../../lib/sector-examples/catalog";
import { ExampleChrome } from "./chrome";
import { examplePages } from "./registry";
import { exampleServices } from "../../lib/sector-examples/services";
import { generateStaticParams } from "../../app/examples/[slug]/[topic]/page";

test("all forty examples have a distinct registered page", () => {
  assert.equal(sectorExamples.length, 40);
  assert.deepEqual(
    Object.keys(examplePages).sort(),
    sectorExamples.map(({ slug }) => slug).sort(),
  );
  assert.equal(new Set(Object.values(examplePages)).size, 40);
});
const guideParams = generateStaticParams();
const guidePaths = new Set(
  guideParams.map(({ slug, topic }) => `/examples/${slug}/${topic}`),
);
test("all 120 service guides resolve through generated route parameters", () => {
  assert.equal(guideParams.length, 120);
  assert.equal(guidePaths.size, 120);
  for (const example of sectorExamples) {
    assert.equal(exampleServices[example.theme].length, 3);
    for (const service of exampleServices[example.theme]) {
      assert.ok(guidePaths.has(`/examples/${example.slug}/${service.slug}`));
      assert.ok(
        service.title &&
          service.description &&
          service.question &&
          service.answer,
      );
      assert.ok(service.steps.length > 0 && service.preparation.length > 0);
    }
  }
});
for (const example of sectorExamples) {
  test(`${example.name} has one primary heading, a usable enquiry and resolved local assets`, () => {
    const Page = examplePages[example.slug];
    assert.ok(Page, example.slug);
    const html = renderToStaticMarkup(
      <ExampleChrome example={example}>
        <Page />
      </ExampleChrome>,
    );
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
    for (const id of ["example-main", "services", "approach", "enquire"])
      assert.equal(
        html.split(`id="${id}"`).length - 1,
        1,
        `${id} must appear exactly once`,
      );
    assert.match(html, /Fictional company/);
    assert.match(html, /See my next step/);
    assert.doesNotMatch(html, /href="(?:#|tel:|mailto:)"/);
    assert.equal(
      html.includes("<video"),
      ["ridge-and-vale", "hearth-and-acre"].includes(example.slug),
    );
    assert.ok(existsSync(path.join(process.cwd(), "public", example.image)));
    for (const match of html.matchAll(/(?:src|poster)="([^"]+)"/g)) {
      const url = new URL(
        match[1].replaceAll("&amp;", "&"),
        "https://example.test",
      );
      const localPath =
        url.pathname === "/_next/image"
          ? url.searchParams.get("url")
          : url.pathname;
      if (localPath?.startsWith("/prospect-previews/"))
        assert.ok(
          existsSync(path.join(process.cwd(), "public", localPath)),
          localPath,
        );
    }
    for (const match of html.matchAll(/href="(\/examples\/[^"]+)"/g)) {
      const target = match[1].split("#")[0];
      if (target.split("/").length === 4)
        assert.ok(guidePaths.has(target), `Unresolved guide: ${target}`);
    }
    for (const service of exampleServices[example.theme]) {
      assert.ok(
        html.includes(`href="/examples/${example.slug}/${service.slug}"`),
        `Missing guide link: ${service.slug}`,
      );
    }
  });
}
test("animation enhancement leaves content visible by default and includes reduced-motion styles", () => {
  const css = readFileSync(
    path.join(process.cwd(), "app/examples/responsive.css"),
    "utf8",
  );
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /opacity:\s*1/);
  const source = readFileSync(
    path.join(process.cwd(), "components/sector-examples/motion.tsx"),
    "utf8",
  );
  assert.match(source, /observer\?\.disconnect/);
  assert.match(source, /cancelAnimationFrame/);
});
