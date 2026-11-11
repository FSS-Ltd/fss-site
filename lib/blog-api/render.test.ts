import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

import { isSafeLinkDestination } from "./links";
import { markdownMdxOptions } from "./render";

// next-mdx-remote is ESM-only and cannot be loaded from this CJS test, so the
// real compile runs in a child process.
function compile(source: string): string {
  const script = `
    import { serialize } from "next-mdx-remote/serialize";
    const { compiledSource } = await serialize(${JSON.stringify(source)}, { mdxOptions: ${JSON.stringify(markdownMdxOptions)} });
    process.stdout.write(compiledSource);
  `;
  return execFileSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

test("markdown rows drop raw HTML and evaluate nothing", () => {
  const compiled = compile(
    'hi <img src=x onerror=alert(1)> <script>alert(2)</script>\n\n<div onclick=alert(3)>x</div>\n\nimport x from "fs"\n\n{process.exit(1)}',
  );
  for (const forbidden of ['"img"', '"script"', '"div"', "onerror", "onclick"]) {
    assert.ok(!compiled.includes(forbidden), forbidden);
  }
  // Braces stay inert text inside a string literal, not an evaluated expression.
  assert.match(compiled, /"[^"\n]*\{process\.exit\(1\)\}/);
  assert.ok(!/^\s*import /m.test(compiled));
});

test("the Anchor guard allows only http(s), mailto, relative and fragments", () => {
  const options = { allowFragment: true };
  for (const href of ["https://a.example", "/x", "mailto:a@b.co", "#top"]) {
    assert.equal(isSafeLinkDestination(href, options), true, href);
  }
  for (const href of ["javascript:alert(1)", " JaVa\tScript:alert(1)", "data:text/html,x", "//evil.example", "x/y"]) {
    assert.equal(isSafeLinkDestination(href, options), false, href);
  }
});
