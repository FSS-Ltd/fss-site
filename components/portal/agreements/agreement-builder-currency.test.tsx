import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { agreementDraft } from "@/lib/operations/agreements/fixtures";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};
const { AgreementBuilderFeesStep } =
  require("./agreement-builder-fees-step") as typeof import("./agreement-builder-fees-step");

for (const [currency, symbol] of [
  ["GBP", "£"],
  ["USD", "$"],
  ["EUR", "€"],
] as const) {
  test(`fees restore ${currency} and show matching amount labels`, () => {
    const agreement = { ...agreementDraft(), currency };
    const html = renderToStaticMarkup(
      <AgreementBuilderFeesStep
        agreement={agreement}
        content={{ agreement }}
        onSave={async () => undefined}
        pending={false}
      />,
    );
    assert.match(html, /<select[^>]*name="currency"/);
    assert.ok(html.includes(`<option value="${currency}" selected="">`));
    for (const code of ["GBP", "USD", "EUR"]) {
      assert.ok(html.includes(`<option value="${code}"`));
    }
    assert.ok(html.includes(`Rate (${symbol})`));
    assert.ok(html.includes(`Required deposit (${symbol})`));
    assert.ok(html.includes(`Installment 1 amount (${symbol})`));
  });
}
