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
const navigations: string[] = [];
loader._load = function (request, ...rest) {
  if (request === "next/navigation")
    return {
      useRouter: () => ({
        push(path: string) {
          navigations.push(path);
        },
        refresh() {},
      }),
    };
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
Object.assign(dom.window.HTMLElement.prototype, {
  attachEvent() {},
  detachEvent() {},
});
Object.assign(globalThis, {
  window: dom.window,
  self: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  CustomEvent: dom.window.CustomEvent,
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

async function setupFacebookForm() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      createElement(CrmRefreshProvider, null, createElement(LeadCaptureForm)),
    ),
  );
  const selector =
    container.querySelector<HTMLSelectElement>("select:not([name])");
  assert.ok(selector);
  await act(async () => {
    selector.value = "facebook";
    selector.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  });
  const form = container.querySelector<HTMLFormElement>(
    'form[aria-label="Capture Facebook prospect"]',
  );
  assert.ok(form);
  const set = (name: string, value: string) => {
    (form.elements.namedItem(name) as HTMLInputElement).value = value;
  };
  for (const [name, value] of Object.entries({
    sourceUrl: "https://facebook.com/example",
    businessName: "Example",
    opportunity: "Website review",
    offer: "Website",
    observedAt: "2026-01-01T10:00",
  }))
    set(name, value);
  const submit = async () => {
    await act(async () => {
      form.dispatchEvent(
        new dom.window.Event("submit", { bubbles: true, cancelable: true }),
      );
    });
  };
  const cleanup = async () => {
    await act(async () => root.unmount());
    container.remove();
  };
  return { container, form, set, submit, cleanup };
}

test("identical retries reuse payload and edited retries use a new request ID", async () => {
  const bodies: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    bodies.push(String(init?.body));
    throw new Error("Connection lost");
  };
  const view = await setupFacebookForm();
  try {
    await view.submit();
    await view.submit();
    assert.equal(bodies[0], bodies[1]);
    view.set("offer", "New offer");
    await view.submit();
    assert.notEqual(
      JSON.parse(bodies[1]).requestId,
      JSON.parse(bodies[2]).requestId,
    );
    assert.equal(JSON.parse(bodies[2]).offer, "New offer");
  } finally {
    await view.cleanup();
    globalThis.fetch = originalFetch;
  }
});

test("existing result keeps the form and links to saved details without navigation", async () => {
  const originalFetch = globalThis.fetch;
  const id = "11111111-1111-4111-8111-111111111111";
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ prospectId: id, alreadyExisted: true }), {
      status: 200,
    });
  const view = await setupFacebookForm();
  navigations.length = 0;
  try {
    await view.submit();
    assert.equal(navigations.length, 0);
    assert.match(view.container.textContent ?? "", /record already exists/i);
    const link = view.container.querySelector<HTMLAnchorElement>(
      `a[href="/growth/prospects/${id}"]`,
    );
    assert.ok(link);
    assert.equal(
      (view.form.elements.namedItem("offer") as HTMLInputElement).value,
      "Website",
    );
    assert.doesNotMatch(view.container.textContent ?? "", /Saved\./);
  } finally {
    await view.cleanup();
    globalThis.fetch = originalFetch;
  }
});

test("invalid required and future source fields show feedback and focus without sending", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response("{}");
  };
  const view = await setupFacebookForm();
  try {
    for (const name of ["businessName", "opportunity", "offer"]) {
      const old = (view.form.elements.namedItem(name) as HTMLInputElement)
        .value;
      view.set(name, "   ");
      await view.submit();
      assert.equal(document.activeElement, view.form.elements.namedItem(name));
      assert.equal(
        (view.form.elements.namedItem(name) as HTMLInputElement).getAttribute(
          "aria-invalid",
        ),
        "true",
      );
      view.set(name, old);
    }
    view.set("observedAt", "2099-01-01T10:00");
    await view.submit();
    assert.equal(
      document.activeElement,
      view.form.elements.namedItem("observedAt"),
    );
    assert.match(view.container.textContent ?? "", /future/i);
    assert.equal(calls, 0);
  } finally {
    await view.cleanup();
    globalThis.fetch = originalFetch;
  }
});
