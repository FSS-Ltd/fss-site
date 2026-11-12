import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { BlogPostMeta } from "@/lib/types/blog";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};

const { BlogIndex } = require("./blog-index");
const { BlogPostLayout } = require("../../blog/blog-post-layout");
const { mdxComponents } = require("../../blog/mdx-components");
const { extractHeadings } = require("../../../lib/blog-presentation");

function post(overrides: Partial<BlogPostMeta>): BlogPostMeta {
  return {
    slug: "post",
    title: "A post",
    excerpt: "An excerpt.",
    publishDate: "2026-04-02",
    modifiedDate: "2026-04-02",
    author: "FSS Growth Team",
    category: "Custom Software",
    tags: ["UK"],
    coverImage: "/images/covers/sdk-playbook.svg",
    seoTitle: "s",
    seoDescription: "d",
    featured: false,
    indexable: true,
    readingMinutes: 4,
    ...overrides,
  };
}

const h1Count = (html: string) => (html.match(/<h1[\s>]/g) ?? []).length;

test("blog index is one route map: a named link per post, lead largest, no counter", () => {
  const posts = [
    post({ slug: "newest", title: "Newest", category: "Growth", publishDate: "2026-05-01" }),
    post({ slug: "pick", title: "Editor pick", featured: true }),
    post({ slug: "second", title: "Second", category: "Growth" }),
    post({ slug: "a1", title: "Auto one", category: "Automation" }),
    post({ slug: "a2", title: "Auto two", category: "Automation" }),
    post({ slug: "a3", title: "Auto three", category: "Automation" }),
    post({ slug: "solo", title: "Solo", category: "Software", coverImage: "" }),
  ];
  const html = renderToStaticMarkup(<BlogIndex posts={posts} />);

  assert.equal(h1Count(html), 1);
  assert.match(html, /data-hero-canvas/);
  assert.match(html, /data-motion-reveal/);
  assert.match(html, /data-magnetic/);
  assert.match(html, /data-lift-light/);
  assert.match(html, /7 articles/);
  assert.match(html, /Index updated/);
  assert.match(html, /Field Notes, 7 articles/);
  assert.doesNotMatch(html, /\d\d \/ \d\d/);
  assert.doesNotMatch(html, /<img|Also in this edition|More articles/);
  // Exactly one link per post, named by its visible content (no aria-label,
  // which would not contain the kicker and date); the lead is marked.
  assert.doesNotMatch(html, /aria-label="(Newest|Editor pick|Second)"/);
  for (const p of posts) {
    const links = html.match(new RegExp(`href="/blog/${p.slug}"[^>]*>(?:(?!</a>).)*<span class="grow">${p.title}</span>`, "g")) ?? [];
    assert.equal(links.length, 1, p.slug);
    assert.equal((html.match(new RegExp(`href="/blog/${p.slug}"`, "g")) ?? []).length, 1, p.slug);
  }
  assert.match(html, /Lead story \/ Custom Software/);
  assert.equal((html.match(/class="mapNode mapLead"/g) ?? []).length, 1);
  // Routes: one svg per layout, both aria-hidden.
  assert.equal((html.match(/<div class="mapRoutes map(Wide|Mid)" aria-hidden="true"><svg/g) ?? []).length, 2);
  assert.doesNotMatch(html, /—|–|!/);
});

test("blog index handles a single post and no posts", () => {
  const one = renderToStaticMarkup(<BlogIndex posts={[post({})]} />);
  assert.equal(h1Count(one), 1);
  assert.match(one, /Lead story/);

  const none = renderToStaticMarkup(<BlogIndex posts={[]} />);
  assert.equal(h1Count(none), 1);
  assert.match(none, /No articles are published yet/);
});

test("article shows a contents list whose links match the rendered h2 ids", () => {
  const body = "## First step\n\ntext\n\n## Second **step**\n\n## Third [step](/x)";
  const headings = extractHeadings(body);
  const prose = headings.map((h: { text: string }) =>
    mdxComponents.h2({ children: h.text }),
  );
  const html = renderToStaticMarkup(
    <BlogPostLayout post={post({ modifiedDate: "2026-09-04" })} headings={headings} allPosts={[post({ slug: "next", title: "Next one" })]}>
      {prose}
    </BlogPostLayout>,
  );

  assert.equal(h1Count(html), 1);
  assert.match(html, /In this article/);
  for (const id of ["first-step", "second-step", "third-step"]) {
    assert.match(html, new RegExp(`href="#${id}"`));
    assert.match(html, new RegExp(`<h2 id="${id}"`));
  }
  assert.match(html, /Updated <time dateTime="2026-09-04">4 September 2026<\/time>/);
  assert.match(html, /href="\/contact"/);
  assert.match(html, /Read next/);
  assert.match(html, /href="\/blog"/);
  assert.match(html, /<ol><li><a href="#first-step"><span>First step<\/span>/);
  // Hero art: one labelled node per heading, on a route.
  assert.match(html, /<svg[^>]*class="artSvg artWide"[^>]*aria-hidden="true"/);
  assert.match(html, />First step</);
  assert.match(html, />Third step</);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /class="cta-link|link"[^>]*>\s*Home/);
});

test("article without a cover or enough sections stays clean", () => {
  const html = renderToStaticMarkup(
    <BlogPostLayout post={post({ coverImage: "" })} headings={extractHeadings("## Only one")}>
      <p>Body</p>
    </BlogPostLayout>,
  );
  assert.doesNotMatch(html, /In this article/);
  // Fewer than three headings: the art shows the post's own node instead.
  assert.match(html, /THIS ARTICLE/);
  assert.doesNotMatch(html, /Read next/);
  assert.doesNotMatch(html, /Updated/);
});
