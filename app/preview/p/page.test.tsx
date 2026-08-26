import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import {
  dynamic,
  generateMetadata,
  renderProductionProspectPreviewPage,
} from "./[publicId]/page";

const PUBLIC_ID = "Q2VhN4A7x6Y0-5s8V3d1K9PqRcFhZ9Xm";

test("marks published opaque preview pages as dynamic and noindex", async () => {
  const metadata = await generateMetadata({
    params: Promise.resolve({ publicId: PUBLIC_ID }),
  });

  assert.equal(dynamic, "force-dynamic");
  assert.deepEqual(metadata.robots, { index: false, follow: false });
});

test("renders only the published preview provided by the data loader", async () => {
  const page = await renderProductionProspectPreviewPage(
    PUBLIC_ID,
    async () => ({
      publicId: PUBLIC_ID,
      status: "published" as const,
      content: {
        schemaVersion: "1.0" as const,
        businessName: "Example Heating Ltd",
        sector: "Home services",
        locality: "Canterbury",
        businessGoal: "Turn urgent enquiries into qualified calls.",
        primaryCta: "Request a callback",
        homepageSections: {
          schemaVersion: "1.0" as const,
          summary: "A clear homepage structure.",
          items: ["Hero section"],
        },
        conversionPlan: {
          schemaVersion: "1.0" as const,
          summary: "A simpler contact journey.",
          items: ["Clear enquiry route"],
        },
        trustSignals: {
          schemaVersion: "1.0" as const,
          summary: "Visible local service experience.",
          items: ["Service information"],
        },
      },
    }),
  );

  const html = renderToStaticMarkup(page);

  assert.match(html, /Concept for Example Heating Ltd/);
  assert.doesNotMatch(html, /Faithful Software Solutions Ltd/);
});

test("does not render draft or withdrawn preview IDs", async () => {
  await assert.rejects(
    renderProductionProspectPreviewPage(PUBLIC_ID, async () => null),
  );
});
