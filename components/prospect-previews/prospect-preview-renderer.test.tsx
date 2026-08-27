import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { ProspectPreviewRenderer } from "./prospect-preview-renderer";
import { getProspectPreview } from "@/lib/prospect-previews/registry";

test("renders the bespoke automotive preview with a concise concept disclosure", () => {
  const preview = getProspectPreview("ashford-auto-centre");
  if (!preview) throw new Error("Expected the automotive preview record.");

  const html = renderToStaticMarkup(
    <ProspectPreviewRenderer preview={preview} />,
  );

  assert.match(html, /Concept prepared for Ashford Auto Centre/i);
  assert.match(html, /What is this\?/i);
  assert.match(
    html,
    /not currently connected to the business(?:&#x27;|')s live systems/i,
  );
  assert.match(html, /MOT, Servicing &amp; Repairs in Ashford/i);
  assert.match(html, /Vehicle registration/i);
  assert.match(html, /ashford-auto-centre(?:%2F|\/)hero-v1\.png/i);
  assert.match(html, /prospect-reveal/i);
  assert.doesNotMatch(html, /floating-(wheel|diagnostic)-v1\.png/i);
});

test("renders the configurable FSS owner CTA without replacing the prospect experience", () => {
  const preview = getProspectPreview("example-plumbing");
  if (!preview) throw new Error("Expected the trades preview record.");

  const html = renderToStaticMarkup(
    <ProspectPreviewRenderer preview={preview} />,
  );

  assert.match(html, /Like this concept\?/i);
  assert.match(html, /href="\/contact"/);
  assert.match(html, /Talk to FSS/i);
  assert.match(html, /Plumbing help without the phone maze/i);
  assert.match(html, /What do you need help with\?/i);
  assert.match(html, /example-plumbing(?:%2F|\/)hero-v1\.png/i);
  assert.doesNotMatch(html, /floating-(valve|droplet)-v1\.png/i);
});
