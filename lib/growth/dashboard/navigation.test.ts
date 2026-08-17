import assert from "node:assert/strict";
import test from "node:test";

import {
  GROWTH_NAVIGATION_ITEMS,
  getActiveGrowthNavigationItem,
} from "./navigation";

test("defines the approved founder dashboard navigation", () => {
  assert.deepEqual(
    GROWTH_NAVIGATION_ITEMS.map(({ label, href }) => ({ label, href })),
    [
      { label: "Overview", href: "/growth" },
      { label: "Prospects", href: "/growth/prospects" },
      { label: "Outreach", href: "/growth/outreach" },
      { label: "Pipeline", href: "/growth/pipeline" },
      { label: "Deals", href: "/growth/deals" },
      { label: "Clients", href: "/growth/clients" },
      { label: "Analytics", href: "/growth/analytics" },
      { label: "Newsletter", href: "/growth/newsletter" },
      { label: "Settings", href: "/growth/settings" },
    ],
  );

  for (const item of GROWTH_NAVIGATION_ITEMS) {
    assert.ok(item.label.trim().length > 0);
    assert.ok(item.accessibleLabel.includes(item.label));
  }
});

test("resolves exact and nested dashboard routes", () => {
  assert.equal(getActiveGrowthNavigationItem("/growth")?.label, "Overview");
  assert.equal(
    getActiveGrowthNavigationItem("/growth/prospects/123/visual")?.label,
    "Prospects",
  );
  assert.equal(
    getActiveGrowthNavigationItem("/growth/outreach/messages/123")?.label,
    "Outreach",
  );
  assert.equal(
    getActiveGrowthNavigationItem("/growth/settings/")?.label,
    "Settings",
  );
});

test("does not treat unrelated or partial paths as active", () => {
  assert.equal(getActiveGrowthNavigationItem("/growth/login"), null);
  assert.equal(
    getActiveGrowthNavigationItem("/growth/prospects-archive"),
    null,
  );
  assert.equal(getActiveGrowthNavigationItem("/contact"), null);
});
