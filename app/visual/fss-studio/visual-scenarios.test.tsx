import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);

require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};

const { resolveVisualScenario } =
  require("./[scenario]/visual-scenarios") as typeof import("./[scenario]/visual-scenarios");

test("never exposes visual fixtures unless the non-production test gate is enabled", () => {
  assert.equal(
    resolveVisualScenario("client-overview", false, "development"),
    null,
  );
  assert.equal(
    resolveVisualScenario("client-overview", true, "production"),
    null,
  );
  assert.equal(
    resolveVisualScenario("client-overview", true, "development")?.name,
    "client-overview",
  );
});

test("registers each Phase 2 request and delivery visual fixture", () => {
  for (const name of [
    "client-request-board",
    "client-request-form",
    "client-bug-report",
    "client-request-review",
    "studio-delivery-board",
    "studio-review-package",
  ])
    assert.ok(resolveVisualScenario(name, true, "test"));
});

test("registers each Phase 3 agreement visual fixture", () => {
  for (const name of [
    "client-agreement-list",
    "client-agreement-detail",
    "client-agreement-signing",
    "studio-agreement-list",
    "studio-agreement-drafts",
    "studio-agreement-builder",
    "studio-agreement-signed",
  ])
    assert.ok(resolveVisualScenario(name, true, "test"));
});

test("registers every completed agreement state for Phase 8 visual evidence", () => {
  for (const name of [
    "client-agreement-signed",
    "studio-agreement-builder-scope",
    "studio-agreement-builder-fees",
    "studio-agreement-builder-people",
    "studio-agreement-builder-document",
    "studio-agreement-builder-review",
    "studio-agreement-no-engagement",
    "studio-engagement-provenance",
    "studio-signature-evidence",
    "studio-signing-status",
  ]) {
    assert.ok(resolveVisualScenario(name, true, "test"));
  }
});

test("registers each Phase 4 onboarding and welcome visual fixture", () => {
  for (const name of [
    "client-getting-started",
    "client-onboarding-profile",
    "client-onboarding-assets",
    "client-onboarding-booking",
    "client-onboarding-complete",
    "studio-welcome-journeys",
    "studio-welcome-builder",
    "studio-welcome-content",
    "studio-welcome-access",
    "studio-welcome-schedule",
    "studio-welcome-preflight",
    "studio-welcome-active",
    "studio-welcome-recovery",
    "studio-welcome-templates",
    "studio-checklist-editor",
    "studio-checklist-task-editor",
  ]) {
    assert.ok(resolveVisualScenario(name, true, "test"));
  }
});

test("registers each Phase 5 client support visual fixture", () => {
  for (const name of [
    "client-projects",
    "client-project-detail",
    "client-documents",
    "client-document-detail",
    "client-billing",
    "client-invoice",
    "client-services",
    "client-service-enquiry",
    "client-notifications",
    "client-help",
    "client-preferences",
    "client-team",
    "client-unavailable",
    "client-invitation-expired",
    "client-document-quarantine",
    "client-viewer-access",
  ]) {
    assert.ok(resolveVisualScenario(name, true, "test"));
  }
});

test("registers each Phase 6 Studio workspace visual fixture", () => {
  for (const name of [
    "studio-clients",
    "studio-client-detail",
    "studio-client-create",
    "studio-billing-operations",
    "studio-portal-access",
    "studio-notification-delivery",
    "studio-settings",
    "studio-project-edit",
    "studio-journey-blocked",
  ]) {
    assert.ok(resolveVisualScenario(name, true, "test"));
  }
});

test("registers each Phase 7 request-completion visual fixture", () => {
  for (const name of [
    "client-request-detail",
    "client-request-feedback",
    "client-request-complete",
    "client-request-empty",
    "client-request-no-project",
    "client-request-conflict",
    "client-request-loading",
    "studio-request-detail",
    "studio-request-scope",
    "studio-request-create",
    "studio-request-move",
    "client-review-requested-email",
    "client-work-completed-email",
  ]) {
    assert.ok(resolveVisualScenario(name, true, "test"));
  }
});
