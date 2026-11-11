import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_BODY_CHARS,
  blogPostInputSchema,
  findMdxConstruct,
} from "./post-schema";

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
  bodyMarkdown: "## Heading\n\nPlain **markdown** with a [link](/contact).",
  primaryKeyword: "AI automation cost UK",
};

test("accepts a minimal post and defaults status to draft", () => {
  const parsed = blogPostInputSchema.parse(valid);
  assert.equal(parsed.status, "draft");
  assert.equal(parsed.featured, false);
});

test("rejects unknown keys, bad slugs, remote covers and non-http source urls", () => {
  for (const patch of [
    { extra: 1 },
    { slug: "Not A Slug" },
    { coverImage: "https://evil.example/x.png" },
    { coverImage: "//evil.example/x.png" },
    { primaryKeyword: "   " },
    { status: "scheduled" },
    { sources: [{ title: "x", url: "javascript:alert(1)" }] },
    { bodyMarkdown: "x".repeat(MAX_BODY_CHARS + 1) },
  ]) {
    assert.equal(
      blogPostInputSchema.safeParse({ ...valid, ...patch }).success,
      false,
      JSON.stringify(patch).slice(0, 60),
    );
  }
});

test("flags MDX and JSX constructs", () => {
  assert.equal(findMdxConstruct("import x from 'y'\n\ntext"), "import_or_export");
  assert.equal(findMdxConstruct("export const a = 1"), "import_or_export");
  assert.equal(findMdxConstruct("hi <script>alert(1)</script>"), "script_tag");
  assert.equal(findMdxConstruct("<Callout title=\"x\">hi</Callout>"), "tag");
  assert.equal(findMdxConstruct("<CtaBlock />"), "tag");
  assert.equal(findMdxConstruct("<img src=x onerror=y>"), "tag");
  assert.equal(findMdxConstruct("Total is {props.value}."), "expression");
});

test("allows plain markdown, autolinks and code that mentions these constructs", () => {
  assert.equal(findMdxConstruct("a < b and b > a, see <https://example.com>"), null);
  assert.equal(findMdxConstruct("Mail <hello@example.com> today"), null);
  assert.equal(
    findMdxConstruct("```ts\nimport x from 'y';\nconst a = {b: 1};\n<Foo />\n```\n\nUse `{x}` inline."),
    null,
  );
  assert.equal(findMdxConstruct("## Title\n\n- one\n- two\n\n> quote"), null);
});
