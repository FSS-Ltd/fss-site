import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

// The spine pulls in CSS modules, which plain node cannot load.
const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};
const { SectionSpine, spineNumber } = require("./section-spine");

test("spineNumber is one-based and two digits", () => {
  assert.equal(spineNumber(0), "01");
  assert.equal(spineNumber(8), "09");
  assert.equal(spineNumber(9), "10");
});

test("the spine numbers each section, keeps its id and marks the last node", () => {
  const html = renderToStaticMarkup(
    <SectionSpine
      sections={[
        { id: "problem", title: "The problem.", text: "First." },
        {
          id: "idea",
          title: "The idea.",
          text: "Second.",
          points: ["A point"],
          links: [{ href: "/services", label: "Services" }],
        },
      ]}
    />,
  );

  assert.match(html, /<h2 id="problem">The problem\.<\/h2>/);
  assert.match(html, /aria-labelledby="idea"/);
  assert.match(html, />01<\/span>/);
  assert.match(html, />02<\/span>/);
  assert.match(html, /A point/);
  assert.match(html, /href="\/services"/);
  assert.equal(html.match(/data-last/g)?.length, 1);
});
