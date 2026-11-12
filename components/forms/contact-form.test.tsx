import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test, { afterEach, beforeEach, mock } from "node:test";

import { JSDOM } from "jsdom";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, property) => String(property) }),
  };
};

const dom = new JSDOM("<!doctype html><body></body>", {
  url: "http://localhost/contact",
  pretendToBeVisual: true,
});
const { window } = dom;
Object.assign(globalThis, {
  window,
  document: window.document,
  HTMLElement: window.HTMLElement,
  HTMLInputElement: window.HTMLInputElement,
  Node: window.Node,
  MouseEvent: window.MouseEvent,
  Event: window.Event,
  self: window,
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, "navigator", {
  value: window.navigator,
  configurable: true,
});

let reduceMotion = false;
const scrolls: ScrollIntoViewOptions[] = [];
window.matchMedia = ((query: string) => ({
  matches: reduceMotion && query.includes("prefers-reduced-motion"),
  media: query,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
})) as unknown as typeof window.matchMedia;
window.HTMLElement.prototype.scrollIntoView = function (options) {
  scrolls.push(options as ScrollIntoViewOptions);
};

const { act } = require("react") as typeof import("react");
const { createRoot } =
  require("react-dom/client") as typeof import("react-dom/client");
const { ContactForm } =
  require("./contact-form") as typeof import("./contact-form");

let container: HTMLElement;
let root: ReturnType<typeof createRoot>;
let clock = 1000;
const requests: { url: string; body: string }[] = [];

beforeEach(async () => {
  clock = 1000;
  reduceMotion = false;
  scrolls.length = 0;
  requests.length = 0;
  mock.method(performance, "now", () => clock);
  // Fake endpoint: nothing real is ever sent.
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    requests.push({ url: String(url), body: String(init?.body) });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<ContactForm />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  mock.restoreAll();
});

const heading = () => container.querySelector("h2[tabindex='-1']");
const chip = (label: string) => {
  const found = [...container.querySelectorAll("button[aria-pressed]")].find(
    (button) => button.textContent?.includes(label),
  );
  assert.ok(found, `chip "${label}"`);
  return found as HTMLButtonElement;
};
const press = async (element: Element, detail = 0) => {
  await act(async () => {
    element.dispatchEvent(
      new window.MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        detail,
      }),
    );
  });
};
const next = () => {
  const button = container.querySelector("button[type='submit']");
  assert.ok(button);
  return button;
};
const settle = () => {
  clock += 1000;
};

test("choosing a chip moves focus to the new step heading", async () => {
  assert.match(heading()?.textContent ?? "", /stop doing by hand/);
  await press(chip("Reporting"));
  assert.match(heading()?.textContent ?? "", /Which tools/);
  assert.equal(document.activeElement, heading());
});

test("the first step has no detail box, so nothing is lost to auto-advance", async () => {
  assert.equal(container.querySelector("#contact-detail"), null);
  await press(chip("Reporting"));
  await press(next()); // skip tools
  settle();
  await press(chip("2 to 10"));
  settle();
  await press(chip("Within 3 months"));
  assert.match(heading()?.textContent ?? "", /Where should we send/);
  assert.ok(container.querySelector("#contact-detail"));
});

test("continue advances only when the step is valid", async () => {
  await press(next());
  assert.match(heading()?.textContent ?? "", /stop doing by hand/);
  assert.match(
    container.querySelector("[role='alert']")?.textContent ?? "",
    /Choose the option/,
  );
  await press(chip("Reporting"));
  await press(container.querySelector("button.back") as Element); // Back
  assert.equal(chip("Reporting").getAttribute("aria-pressed"), "true");
  await press(next());
  assert.match(heading()?.textContent ?? "", /Which tools/);
});

test("a pointer click just after a step change is ignored, a keyboard click is not", async () => {
  await press(chip("Reporting"));
  await press(next()); // skip tools, now on team size
  assert.match(heading()?.textContent ?? "", /How many people/);
  await press(chip("2 to 10"), 1); // double-click tail, same instant
  assert.match(heading()?.textContent ?? "", /How many people/);
  await press(chip("2 to 10"), 0); // keyboard activation
  assert.match(heading()?.textContent ?? "", /When would you want/);
  settle();
  await press(chip("Just exploring"), 1); // a deliberate click later still works
  assert.match(heading()?.textContent ?? "", /Where should we send/);
});

test("scroll behaviour follows prefers-reduced-motion", async () => {
  reduceMotion = true;
  await press(chip("Reporting"));
  assert.equal(scrolls.at(-1)?.behavior, "auto");
  reduceMotion = false;
  await press(next());
  assert.equal(scrolls.at(-1)?.behavior, "smooth");
});

test("the step entrance animation is switched off for reduced motion", () => {
  const css = readFileSync(
    new URL("./contact-form.module.css", import.meta.url),
    "utf8",
  );
  const reduced = css.slice(
    css.indexOf("@media (prefers-reduced-motion: reduce)"),
  );
  const block = reduced.slice(0, reduced.indexOf("}") + 1);
  assert.match(block, /\.stepBody/);
  assert.match(block, /animation:\s*none/);
});

test("the optional detail is typed on the last step and sent on its own line", async () => {
  await press(chip("Reporting"));
  await press(next());
  settle();
  await press(chip("2 to 10"));
  settle();
  await press(chip("Within 3 months"));

  const fill = async (selector: string, value: string) => {
    const input = container.querySelector(selector) as HTMLInputElement;
    assert.ok(input, selector);
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(input, value);
      input.dispatchEvent(new window.Event("input", { bubbles: true }));
    });
  };
  await fill("#contact-detail", "Attendance reporting");
  await fill("input[autocomplete='given-name']", "Test");
  await fill("input[autocomplete='family-name']", "Person");
  await fill("input[type='email']", "test@example.com");
  await fill("input[autocomplete='organization']", "Example Org");
  await press(next());

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "/api/lead");
  const { challenge } = JSON.parse(requests[0].body) as { challenge: string };
  assert.match(
    challenge,
    /; Timing: Within 3 months\nDetail: Attendance reporting$/,
  );
});
