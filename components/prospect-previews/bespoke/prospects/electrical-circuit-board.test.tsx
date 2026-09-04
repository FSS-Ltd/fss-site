import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { EteElectricalPage } from "./ete-electrical";
import { ThElectricalPage } from "./th-electrical";

test("renders one site-wide circuit-board background for both electrical concepts", () => {
  for (const Page of [EteElectricalPage, ThElectricalPage]) {
    const html = renderToStaticMarkup(<Page />);

    assert.match(html, /data-electrical-circuit-board="true"/);
    assert.equal(
      (html.match(/data-electrical-circuit-scope="site"/g) ?? []).length,
      1,
    );
    assert.equal(
      (html.match(/data-electrical-circuit-trace="true"/g) ?? []).length,
      4,
    );
  }
});

test("uses CSS scroll animation with a reduced-motion fallback", () => {
  const styles = readFileSync(
    new URL("../../../../app/preview/preview.css", import.meta.url),
    "utf8",
  );

  assert.match(styles, /\[data-electrical-circuit-board\]/);
  assert.match(
    styles,
    /data-electrical-circuit-scope="site"[\s\S]*animation-timeline:\s*scroll\(root block\)/,
  );
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)/);
});
