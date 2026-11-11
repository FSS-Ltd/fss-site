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

test("blog index leads with the featured story and indexes every section", () => {
  const posts = [
    post({ slug: "newest", title: "Newest", category: "Automation", publishDate: "2026-05-01" }),
    post({ slug: "pick", title: "Editor pick", featured: true }),
    post({ slug: "third", title: "Third", category: "Automation" }),
    post({ slug: "fourth", title: "Fourth", coverImage: "" }),
  ];
  const html = renderToStaticMarkup(<BlogIndex posts={posts} />);

  assert.equal(h1Count(html), 1);
  assert.match(html, /data-hero-canvas/);
  assert.match(html, /data-motion-reveal/);
  assert.match(html, /data-magnetic/);
  assert.match(html, /<h2 id="lead-story"[^>]*><a[^>]*href="\/blog\/pick"/);
  assert.match(html, /href="#section-automation"/);
  assert.match(html, /id="section-automation"/);
  assert.match(html, /4 articles/);
  assert.match(html, /2 sections/);
  // Every post is reachable from the section index.
  for (const p of posts) assert.match(html, new RegExp(`href="/blog/${p.slug}"`));
  assert.doesNotMatch(html, /—|–|!/);
});

test("blog index handles a single post and no posts", () => {
  const one = renderToStaticMarkup(<BlogIndex posts={[post({})]} />);
  assert.equal(h1Count(one), 1);
  assert.match(one, /id="lead-story"/);
  assert.doesNotMatch(one, /aria-label="Sections"/);
  assert.doesNotMatch(one, /Also in this edition/);

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
    <BlogPostLayout post={post({ modifiedDate: "2026-09-04" })} headings={headings} relatedPosts={[post({ slug: "next" })]}>
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
  assert.match(html, /href="\/blog#section-custom-software"/);
});

test("article without a cover or enough sections stays clean", () => {
  const html = renderToStaticMarkup(
    <BlogPostLayout post={post({ coverImage: "" })} headings={extractHeadings("## Only one")} relatedPosts={[]}>
      <p>Body</p>
    </BlogPostLayout>,
  );
  assert.doesNotMatch(html, /In this article/);
  assert.doesNotMatch(html, /<figure/);
  assert.doesNotMatch(html, /Read next/);
  assert.doesNotMatch(html, /Updated/);
});
