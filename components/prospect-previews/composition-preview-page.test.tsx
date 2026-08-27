import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import {
  renderProspectCompositionPage,
  type ProspectCompositionLoader,
} from "./composition-preview-page";
import type { ProspectPreviewComposition } from "@/lib/growth/prospect-previews/compositions/types";

const composition: ProspectPreviewComposition = {
  schemaVersion: "1.0",
  prospectId: "f0f5caeec-cbe0-454d-9774-14483ba3a37f",
  slug: "marden-garage",
  family: "automotive",
  visualDirection: "precision-dark",
  heroTreatment: "workshop-geometry",
  sectionOrder: ["hero", "journey", "proof", "owner-cta"],
  journey: {
    type: "mot-request",
    completionMessage: "A live version could send this request to the workshop.",
  },
  copy: {
    businessName: "Marden Garage",
    locality: "Marden",
    headline: "A clearer MOT booking journey.",
    primaryCta: "Request an MOT slot",
  },
  content: {
    businessGoal: "Help drivers book with confidence.",
    homepageSections: {
      schemaVersion: "1.0",
      summary: "Clarify the next step.",
      items: ["MOT booking"],
    },
    conversionPlan: {
      schemaVersion: "1.0",
      summary: "Ask for the right details.",
      items: ["Vehicle registration"],
    },
    trustSignals: {
      schemaVersion: "1.0",
      summary: "Show local workshop confidence.",
      items: ["Marden service"],
    },
  },
  digest: "e".repeat(64),
};

test("renders a source composition in protected review mode without a database lookup", async () => {
  let publicLoaderCalls = 0;
  const loader: ProspectCompositionLoader = async () => {
    publicLoaderCalls += 1;
    return composition;
  };

  const page = await renderProspectCompositionPage({
    slug: composition.slug,
    mode: "review",
    getReviewComposition: () => composition,
    getPublishedComposition: loader,
  });

  assert.ok(page);
  const html = renderToStaticMarkup(page);
  assert.match(html, /Marden Garage/);
  assert.match(html, /Demonstration only/i);
  assert.equal(publicLoaderCalls, 0);
});

test("renders only a database-gated composition in public mode", async () => {
  const page = await renderProspectCompositionPage({
    slug: composition.slug,
    mode: "public",
    getReviewComposition: () => {
      throw new Error("Review source must not be used for public pages.");
    },
    getPublishedComposition: async (slug) =>
      slug === composition.slug ? composition : null,
  });

  assert.ok(page);
  assert.match(renderToStaticMarkup(page), /Marden Garage/);
});

test("returns null for a missing review or unpublished source composition", async () => {
  const review = await renderProspectCompositionPage({
    slug: "unknown",
    mode: "review",
    getReviewComposition: () => null,
    getPublishedComposition: async () => composition,
  });
  const publicPage = await renderProspectCompositionPage({
    slug: composition.slug,
    mode: "public",
    getReviewComposition: () => composition,
    getPublishedComposition: async () => null,
  });

  assert.equal(review, null);
  assert.equal(publicPage, null);
});
