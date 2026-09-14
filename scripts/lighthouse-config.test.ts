import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

type LighthouseAssertion = [
  level: "error" | "warn",
  options: {
    aggregationMethod?: string;
    maxNumericValue?: number;
  },
];

test("mobile LCP allows measured runner variance without accepting a three-second regression", () => {
  const config = JSON.parse(
    readFileSync(
      new URL("../.lighthouserc.mobile.json", import.meta.url),
      "utf8",
    ),
  ) as {
    ci: {
      assert: {
        assertions: Record<string, LighthouseAssertion>;
      };
    };
  };
  const [, lcp] = config.ci.assert.assertions["largest-contentful-paint"];

  assert.equal(lcp.aggregationMethod, "median");
  assert.equal(lcp.maxNumericValue, 2_800);
  assert.ok(lcp.maxNumericValue < 3_000);
});
