import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { JaguarPlumbingPage } from "./jaguar-plumbing";

test("renders Jaguar's scroll-linked water journey with an accessible still fallback", () => {
  const html = renderToStaticMarkup(<JaguarPlumbingPage />);

  assert.match(html, /data-jaguar-water-journey="true"/);
  assert.match(
    html,
    /prospect-previews\/bespoke\/jaguar-plumbing\/water-journey-scroll-scrub-v1\.mp4/,
  );
  assert.match(
    html,
    /prospect-previews\/bespoke\/jaguar-plumbing\/water-journey-v1-poster\.png/,
  );
  assert.doesNotMatch(html, /<video[^>]*autoPlay/);
  assert.match(html, /A better response starts before the callout\./);
  assert.match(html, /Jaguar Plumbing/);
});
