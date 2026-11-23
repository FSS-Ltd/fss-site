import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import test from "node:test";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = { __esModule: true, default: {} };
};
const loader = Module as unknown as {
  _load: (request: string, ...rest: unknown[]) => unknown;
};
const originalLoad = loader._load;
loader._load = function (request, ...rest) {
  if (request === "next/navigation")
    return { useRouter: () => ({ push() {}, refresh() {} }) };
  return originalLoad.call(this, request, ...rest);
};
const { LeadCaptureForm } =
  require("./lead-capture-form") as typeof import("./lead-capture-form");
const { CrmRefreshProvider } =
  require("./crm-refresh-provider") as typeof import("./crm-refresh-provider");
loader._load = originalLoad;
const dom = new JSDOM("<!doctype html><body></body>", {
  url: "http://localhost",
});
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  FormData: dom.window.FormData,
  IS_REACT_ACT_ENVIRONMENT: true,
});

test("source selection submits Facebook capture and preserves the company form", async () => {
  const requests: unknown[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    requests.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ message: "Try again" }), {
      status: 503,
    });
  };
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        createElement(CrmRefreshProvider, null, createElement(LeadCaptureForm)),
      ),
    );
    const selector =
      container.querySelector<HTMLSelectElement>("select:not([name])");
    const company = container.querySelector<HTMLFormElement>(
      'form[aria-label="Capture lead"]',
    );
    assert.ok(selector && company);
    const companyName = company.elements.namedItem(
      "businessName",
    ) as HTMLInputElement;
    companyName.value = "Existing entry";
    await act(async () => {
      selector.value = "facebook";
      selector.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    const form = container.querySelector<HTMLFormElement>(
      'form[aria-label="Capture Facebook prospect"]',
    );
    assert.ok(form);
    for (const [name, value] of Object.entries({
      sourceUrl: "https://facebook.com/example",
      businessName: "Example",
      opportunity: "Website review",
      offer: "Website",
      observedAt: "2026-11-20T10:00",
    })) {
      (form.elements.namedItem(name) as HTMLInputElement).value = value;
    }
    await act(async () =>
      form.dispatchEvent(
        new dom.window.Event("submit", { bubbles: true, cancelable: true }),
      ),
    );
    assert.equal(requests.length, 1);
    assert.deepEqual(
      Object.fromEntries(
        Object.entries(requests[0] as Record<string, unknown>).filter(([key]) =>
          [
            "kind",
            "sourceType",
            "sourceUrl",
            "businessName",
            "registrationNumber",
          ].includes(key),
        ),
      ),
      {
        kind: "capture_source",
        sourceType: "facebook_page",
        sourceUrl: "https://facebook.com/example",
        businessName: "Example",
        registrationNumber: null,
      },
    );
    await act(async () => {
      selector.value = "company";
      selector.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    assert.equal(companyName.value, "Existing entry");
    for (const [name, value] of Object.entries({
      companyNumber: "01234567",
      sector: "Retail",
      locality: "Leeds",
      sourceUrl: "https://example.com",
      opportunitySummary: "Website review",
      recommendedOffer: "Website",
    })) {
      (company.elements.namedItem(name) as HTMLInputElement).value = value;
    }
    await act(async () =>
      company.dispatchEvent(
        new dom.window.Event("submit", { bubbles: true, cancelable: true }),
      ),
    );
    assert.equal(requests.length, 2);
    const legacy = requests[1] as Record<string, unknown>;
    assert.equal(legacy.kind, "capture");
    assert.equal(legacy.companyNumber, "01234567");
    assert.equal(legacy.businessName, "Existing entry");
    assert.equal(legacy.sourceUrl, "https://example.com");
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
  }
});
