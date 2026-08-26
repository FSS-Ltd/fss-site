import assert from "node:assert/strict";
import test from "node:test";

import { GrowthNavigationLink } from "./navigation-link";

test("disables eager prefetch for database-backed dashboard navigation", () => {
  const element = GrowthNavigationLink({
    children: "Prospects",
    href: "/growth/prospects",
  });

  assert.equal(element.props.prefetch, false);
});
