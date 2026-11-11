import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { PageTransition } from "./page-transition";

test("renders the page unchanged when React has no ViewTransition", () => {
  const html = renderToStaticMarkup(
    <PageTransition>
      <p>Page body</p>
    </PageTransition>,
  );

  assert.equal(html, "<p>Page body</p>");
});
