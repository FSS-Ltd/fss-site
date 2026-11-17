import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = { __esModule: true, default: {} };
};
const { FacebookWorkspace } =
  require("./workspace") as typeof import("./workspace");
const dom = new JSDOM("<!doctype html><body></body>", {
  url: "http://localhost/growth/facebook",
});
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  FormData: dom.window.FormData,
  Element: dom.window.Element,
  IS_REACT_ACT_ENVIRONMENT: true,
});
class Events extends EventTarget {
  static instance: Events;
  onerror = null;
  constructor() {
    super();
    Events.instance = this;
  }
  close() {}
  emit(name: string) {
    this.dispatchEvent(new Event(name));
  }
}
Object.assign(globalThis, { EventSource: Events });
const item = (id: string, version = 1) => ({
  id,
  name: id,
  url: "https://facebook.com/page",
  kind: "page",
  locality: null,
  websiteUrl: null,
  version,
  observations: [],
  observationsHaveMore: false,
  latestObservation: null,
  review: null,
  postReadiness: "unknown",
  activities: [],
  activitiesHaveMore: false,
  prospects: [],
  prospectsHaveMore: false,
  nextManualAction: "follow",
});
const page = (
  destinations: ReturnType<typeof item>[],
  nextCursor: string | null = null,
) => ({
  status: "ready",
  destinations,
  nextCursor,
  historyLimit: 20,
  pilots: { total: 2, used: 0, remaining: 2, allocations: [] },
});
const button = (element: Element, label: string) => {
  const found = [...element.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === label,
  );
  assert.ok(found, label);
  return found;
};
const tick = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

test("retains multiple edited rows through paging and committed refresh; rebases a rules conflict explicitly", async () => {
  const originalFetch = globalThis.fetch;
  let version = 1;
  const commands: Array<{ expectedVersion: number; requestId: string }> = [];
  globalThis.fetch = async (input, init) => {
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      commands.push(body);
      if (commands.length === 1) {
        version = 2;
        return new Response("{}", { status: 409 });
      }
      return Response.json({ id: "ok" });
    }
    const url = new URL(String(input), "http://localhost");
    const selected = url.searchParams.get("selectedId");
    if (selected) return Response.json(page([item(selected, version)]));
    return Response.json(
      url.searchParams.has("cursor")
        ? page([item("C", version), item("D", version)])
        : page([item("A", version)], "cursor"),
    );
  };
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(createElement(FacebookWorkspace));
    });
    await act(async () => {
      Events.instance.emit("ready");
      await tick();
    });
    await act(async () => {
      button(container, "Next directory page").click();
      await tick();
    });
    const first = container.querySelector("#C");
    assert.ok(first);
    await act(async () => {
      button(first, "Record completed follow").click();
    });
    const disclosures = first.querySelectorAll("details");
    assert.equal(disclosures[0]?.open, true);
    assert.equal(
      [...disclosures].find(
        (entry) =>
          entry.querySelector("summary")?.textContent ===
          "Record completed activity",
      )?.open,
      true,
    );
    assert.equal(container.querySelectorAll("main").length, 0);
    for (const id of ["C", "D"]) {
      const row = container.querySelector(`#${id}`);
      assert.ok(row);
      await act(async () => {
        button(row, "Review rules").click();
      });
      const input = row.querySelector<HTMLInputElement>(
        'input[name="summary"]',
      );
      assert.ok(input);
      await act(async () => {
        input.value = `draft ${id}`;
        input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      });
    }
    await act(async () => {
      Events.instance.emit("change");
      await tick();
    });
    for (const id of ["C", "D"])
      assert.equal(
        container.querySelector<HTMLInputElement>(
          `#${id} input[name="summary"]`,
        )?.value,
        `draft ${id}`,
      );
    const row = container.querySelector("#C");
    assert.ok(row);
    const form = row.querySelector("form");
    assert.ok(form);
    for (const [name, value] of [
      ["source", "https://facebook.com/rules"],
      ["observed", "2026-11-17T10:00"],
      ["expires", "2026-11-18T10:00"],
    ]) {
      const field = form.querySelector<HTMLInputElement>(`[name="${name}"]`);
      assert.ok(field);
      field.value = value;
    }
    await act(async () => {
      form.dispatchEvent(
        new dom.window.Event("submit", { bubbles: true, cancelable: true }),
      );
      await tick();
    });
    assert.equal(commands[0].expectedVersion, 1);
    await act(async () => {
      button(row, "Close rules review").click();
    });
    await act(async () => {
      button(row, "Review rules").click();
    });
    assert.equal(
      form.querySelector<HTMLInputElement>('input[name="summary"]')?.value,
      "draft C",
    );
    await act(async () => {
      button(row, "Use current version").click();
    });
    await act(async () => {
      form.dispatchEvent(
        new dom.window.Event("submit", { bubbles: true, cancelable: true }),
      );
      await tick();
    });
    assert.equal(commands[1].expectedVersion, 2);
    assert.notEqual(commands[0].requestId, commands[1].requestId);
    assert.equal(
      container.querySelector<HTMLInputElement>('#D input[name="summary"]')
        ?.value,
      "draft D",
    );
  } finally {
    await act(async () => root.unmount());
    container.remove();
    globalThis.fetch = originalFetch;
  }
});
