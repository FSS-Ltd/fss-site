import assert from "node:assert/strict";
import test from "node:test";

import { parseStoredProspectPreviewSnapshot } from "./types";

const validSnapshot = {
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
};

test("parses a public preview snapshot with only publishable website content", () => {
  const preview = parseStoredProspectPreviewSnapshot(validSnapshot);

  assert.equal(preview.businessName, "Example Heating Ltd");
  assert.equal(preview.homepageSections.items[0], "Hero section");
});

test("rejects a preview snapshot containing a contact email", () => {
  assert.throws(
    () =>
      parseStoredProspectPreviewSnapshot({
        ...validSnapshot,
        contactEmail: "owner@example.test",
      }),
    /unrecognized key/i,
  );
});
