import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { sectorExamples } from "../../lib/sector-examples/catalog";
import { exampleJourneys } from "../../lib/sector-examples/journeys";
import { ExampleEnquiry } from "./enquiry";

for (const theme of new Set(sectorExamples.map((example) => example.theme))) {
  test(`${theme} enquiry exposes labelled choices without collecting personal details`, () => {
    const html = renderToStaticMarkup(<ExampleEnquiry theme={theme} />);
    const journey = exampleJourneys[theme];
    assert.equal(
      (html.match(/type="radio"/g) ?? []).length,
      journey.options.length,
    );
    assert.equal((html.match(/checked=""/g) ?? []).length, 1);
    assert.match(html, /<fieldset><legend>/);
    assert.match(html, /See my next step/);
    assert.match(html, /No personal details needed/);
    assert.doesNotMatch(html, /type="(?:email|tel|text)"/);
    assert.doesNotMatch(html, /<form[^>]+action=/);
    const selectId = html.match(/<select id="([^"]+)"/)?.[1];
    assert.ok(selectId);
    assert.ok(html.includes(`for="${selectId}"`));
    assert.equal(
      (html.match(/<option\b/g) ?? []).length,
      journey.details.length,
    );
  });
}

test("multiple enquiry instances keep their control IDs and radio groups separate", () => {
  const html = renderToStaticMarkup(
    <>
      <ExampleEnquiry theme="hospitality" />
      <ExampleEnquiry theme="landscape" />
    </>,
  );
  const selectIds = [...html.matchAll(/<select id="([^"]+)"/g)].map(
    (match) => match[1],
  );
  assert.equal(new Set(selectIds).size, 2);
  const radioNames = [...html.matchAll(/type="radio" name="([^"]+)"/g)].map(
    (match) => match[1],
  );
  assert.equal(new Set(radioNames).size, 2);
});
