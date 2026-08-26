import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { ProductionProspectPreview } from "./production-prospect-preview";

test("renders a local concept template from public snapshot data only", () => {
  const html = renderToStaticMarkup(
    <ProductionProspectPreview
      preview={{
        publicId: "Q2VhN4A7x6Y0-5s8V3d1K9PqRcFhZ9Xm",
        status: "published",
        content: {
          schemaVersion: "1.0",
          businessName: "Example Heating Ltd",
          sector: "Home services",
          locality: "Canterbury",
          businessGoal: "Turn urgent enquiries into qualified calls.",
          primaryCta: "Request a callback",
          homepageSections: {
            schemaVersion: "1.0",
            summary: "A clear homepage structure.",
            items: ["Hero section"],
          },
          conversionPlan: {
            schemaVersion: "1.0",
            summary: "A simpler contact journey.",
            items: ["Clear enquiry route"],
          },
          trustSignals: {
            schemaVersion: "1.0",
            summary: "Visible local service experience.",
            items: ["Service information"],
          },
        },
      }}
    />,
  );

  assert.match(html, /Concept for Example Heating Ltd/);
  assert.match(html, /Request a callback/);
  assert.match(html, /A clear homepage structure/);
  assert.doesNotMatch(html, /mailto:|contactEmail|sourceUrl|companyNumber/i);
});
