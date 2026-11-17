import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Destination } from "./types";

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
const item = (id: string, version = 1): Destination => ({
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
    const linkInput = row.querySelector<HTMLInputElement>(
      'form[data-command="Link prospect"] input[name="prospect"]',
    );
    assert.ok(linkInput);
    await act(async () => {
      linkInput.value = "second draft";
      linkInput.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
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
    assert.equal(linkInput.value, "second draft");
    assert.ok(button(row, "Discard unsaved entries"));
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

test("keeps an off-page pilot review pinned through refresh and other form completion", async () => {
  const originalFetch = globalThis.fetch;
  let version = 1;
  const commands: Array<{ type: string; expectedVersion?: number }> = [];
  const prospect = {
    destinationId: "C",
    prospectId: "prospect",
    name: "Prospect",
    version: 1,
  };
  const row = () => ({
    ...item("C", version),
    prospects: [{ ...prospect, version }],
  });
  globalThis.fetch = async (input, init) => {
    if (init?.method === "POST") {
      commands.push(JSON.parse(String(init.body)));
      return Response.json({ id: "ok" });
    }
    const url = new URL(String(input), "http://localhost");
    if (url.searchParams.has("selectedId")) return Response.json(page([row()]));
    return Response.json(
      url.searchParams.has("cursor")
        ? page([row()])
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
    const c = container.querySelector("#C");
    assert.ok(c);
    await act(async () => {
      button(c, "Allocate private pilot").click();
    });
    version = 2;
    await act(async () => {
      Events.instance.emit("change");
      await tick();
    });
    assert.match(c.textContent ?? "", /Prospect version 1/);
    await act(async () => {
      button(c, "Review rules").click();
    });
    const rules = c.querySelector<HTMLFormElement>(
      'form[data-command="Save rules review"]',
    );
    assert.ok(rules);
    for (const [name, value] of [
      ["source", "https://facebook.com/rules"],
      ["summary", "draft"],
      ["observed", "2026-11-17T10:00"],
      ["expires", "2026-11-18T10:00"],
    ]) {
      const input = rules.querySelector<HTMLInputElement>(`[name="${name}"]`);
      assert.ok(input);
      input.value = value;
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    }
    await act(async () => {
      rules.dispatchEvent(
        new dom.window.Event("submit", { bubbles: true, cancelable: true }),
      );
      await tick();
    });
    assert.ok(container.querySelector("#C"));
    assert.match(c.textContent ?? "", /Prospect version 1/);
    const pilot = c.querySelector<HTMLFormElement>(
      'form[data-command="Confirm allocation"]',
    );
    assert.ok(pilot);
    await act(async () => {
      pilot.dispatchEvent(
        new dom.window.Event("submit", { bubbles: true, cancelable: true }),
      );
      await tick();
    });
    assert.equal(
      commands.find((command) => command.type === "allocate_pilot")
        ?.expectedVersion,
      1,
    );
  } finally {
    await act(async () => root.unmount());
    container.remove();
    globalThis.fetch = originalFetch;
  }
});

test("reconciles drafts started during a pending snapshot against page and off-page reads", async () => {
  const originalFetch = globalThis.fetch;
  let resolvePage: ((response: Response) => void) | undefined;
  let pending = false;
  const lookups: string[] = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input), "http://localhost");
    const id = url.searchParams.get("selectedId");
    if (id) {
      lookups.push(id);
      return Response.json(
        page([{ ...item(id, 2), postReadiness: "prohibited" }]),
      );
    }
    if (pending)
      return new Promise<Response>((resolve) => {
        resolvePage = resolve;
      });
    return Response.json(page([item("A"), item("C")]));
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
    pending = true;
    await act(async () => {
      Events.instance.emit("change");
      await tick();
    });
    for (const id of ["A", "C"]) {
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
      resolvePage?.(
        Response.json(page([{ ...item("A", 2), postReadiness: "prohibited" }])),
      );
      await tick();
    });
    assert.deepEqual(lookups, ["C"]);
    for (const id of ["A", "C"]) {
      const row = container.querySelector(`#${id}`);
      assert.ok(row);
      assert.match(row.textContent ?? "", /prohibited/);
      assert.match(row.textContent ?? "", /Reviewing version 1/);
      assert.equal(
        row.querySelector<HTMLInputElement>('input[name="summary"]')?.value,
        `draft ${id}`,
      );
    }
  } finally {
    await act(async () => root.unmount());
    container.remove();
    globalThis.fetch = originalFetch;
  }
});
