import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { AutomotiveBookingDemo } from "./automotive-booking-demo";
import { getProspectPreview } from "@/lib/prospect-previews/registry";

test("renders an MOT booking journey that remains clearly a demonstration", () => {
  const preview = getProspectPreview("ashford-auto-centre");
  if (!preview || preview.industry !== "automotive") {
    throw new Error("Expected an automotive preview record.");
  }

  const html = renderToStaticMarkup(
    <AutomotiveBookingDemo preview={preview} />,
  );

  assert.match(html, /Vehicle registration/i);
  assert.match(html, /Check availability/i);
  assert.match(html, /This is a demonstration only\. In a live version/i);
  assert.match(html, /MOT testing/i);
  assert.match(html, /Opening hours/i);
});
