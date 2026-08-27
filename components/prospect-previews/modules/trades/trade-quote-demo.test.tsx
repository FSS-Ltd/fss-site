import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { TradeQuoteDemo } from "./trade-quote-demo";
import { getProspectPreview } from "@/lib/prospect-previews/registry";

test("renders a qualified trade quote journey that remains a local demonstration", () => {
  const preview = getProspectPreview("example-plumbing");
  if (!preview || preview.industry !== "trades") {
    throw new Error("Expected a trades preview record.");
  }

  const html = renderToStaticMarkup(<TradeQuoteDemo preview={preview} />);

  assert.match(html, /What do you need help with\?/i);
  assert.match(html, /Postcode/i);
  assert.match(html, /How urgent is this\?/i);
  assert.match(html, /Request a response/i);
  assert.match(html, /This is a demonstration only/i);
});
