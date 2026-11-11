import assert from "node:assert/strict";
import test from "node:test";

import { blogPostInputSchema, findMdxConstruct } from "./post-schema";

const valid = {
  slug: "ai-automation-cost-uk",
  title: "What AI automation costs",
  excerpt: "A plain answer.",
  publishDate: "2026-11-11",
  author: "FSS Growth Team",
  category: "AI",
  tags: ["ai"],
  coverImage: "/images/covers/x.svg",
  seoTitle: "AI automation cost",
  seoDescription: "What it costs.",
  bodyMarkdown: "## Heading",
  primaryKeyword: "AI automation cost UK",
};

test("an unclosed or mid-line fence does not hide raw HTML", () => {
  assert.equal(findMdxConstruct("text ``` \n<img src=x onerror=alert(1)>"), "tag");
  assert.equal(findMdxConstruct("```\n<img src=x onerror=alert(1)>"), "tag");
  assert.equal(findMdxConstruct("~~~\nunclosed\n<b>x</b>"), "tag");
  assert.equal(findMdxConstruct("```\n<img>\n```\n\n<b>after</b>"), "tag");
  assert.equal(findMdxConstruct("```html\n<img>\n```\n\nsafe"), null);
});

test("raw HTML and comments are refused", () => {
  for (const html of ["<b>x</b>", "<!-- c -->", '<a href="/x">y</a>', "<br/>", "<? php ?>"]) {
    assert.equal(findMdxConstruct(`text ${html}`), "tag", html);
  }
});

test("link and image destinations must be http, https, mailto or a single-slash path", () => {
  const bad = [
    "[x](javascript:alert(1))",
    "[x](JaVaScRiPt:alert(1))",
    "[x](   javascript:alert(1))",
    "[x](<javascript:alert(1)>)",
    "[x](data:text/html;base64,AAA)",
    "[x](vbscript:msgbox(1))",
    "[x](java&#x73;cript:alert(1))",
    "[x](javascript&colon;alert(1))",
    "[x](&#106;avascript:alert(1))",
    "[x](java&Tab;script:alert(1))",
    "[x](&bogus;javascript:alert(1))",
    "![x](data:image/svg+xml;base64,AAA)",
    "[x](//evil.example/a)",
    "[x](/\\evil.example)",
    "[x](relative/path)",
    "[x][ref]\n\n[ref]: javascript:alert(1)",
  ];
  for (const markdown of bad) {
    // An angle-bracketed destination with a bad scheme is caught as a raw tag first.
    const expected = markdown.includes("(<") ? "tag" : "unsafe_link";
    assert.equal(findMdxConstruct(markdown), expected, markdown);
  }
  for (const ok of [
    "[x](https://example.com/a?b=1&c=2)",
    "[x](HTTP://example.com)",
    "[x](mailto:a@example.com)",
    "[x](/contact)",
    "![x](/images/a.png)",
    "[ref]: /contact",
  ]) {
    assert.equal(findMdxConstruct(ok), null, ok);
  }
});

test("cover images cannot be protocol-relative or use backslashes", () => {
  for (const coverImage of ["//evil.example/x.png", "/\\evil.example/x.png", "/a\\b.png", "javascript:x", "images/x.png"]) {
    assert.equal(blogPostInputSchema.safeParse({ ...valid, coverImage }).success, false, coverImage);
  }
  assert.equal(blogPostInputSchema.safeParse({ ...valid, coverImage: "/images/x.svg" }).success, true);
});

test("text fields are length capped", () => {
  for (const patch of [
    { excerpt: "x".repeat(501) },
    { author: "x".repeat(121) },
    { category: "x".repeat(81) },
    { seoTitle: "x".repeat(71) },
    { seoDescription: "x".repeat(201) },
    { tags: ["x".repeat(51)] },
    { tags: Array.from({ length: 11 }, (_, i) => `t${i}`) },
    { reviewedBy: "x".repeat(121) },
    { summary: "x".repeat(501) },
    { audience: Array.from({ length: 11 }, (_, i) => `a${i}`) },
    { sources: Array.from({ length: 21 }, () => ({ title: "t", url: "https://example.com" })) },
  ]) {
    assert.equal(
      blogPostInputSchema.safeParse({ ...valid, ...patch }).success,
      false,
      JSON.stringify(patch).slice(0, 40),
    );
  }
});
