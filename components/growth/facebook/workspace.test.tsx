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

// React's legacy input polyfill expects these IE methods when jsdom is installed after React.
Object.defineProperties(dom.window.HTMLElement.prototype, {
  attachEvent: { value: () => {} },
  detachEvent: { value: () => {} },
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
  closed = 0;
  close() {
    this.closed++;
  }
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
    assert.ok(document.activeElement === first.querySelector("select"));
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
    const focused = container.querySelector<HTMLInputElement>(
      '#C input[name="summary"]',
    );
    assert.ok(focused);
    focused.focus();
    await act(async () => {
      Events.instance.emit("change");
      await tick();
    });
    assert.ok(document.activeElement === focused);
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
    assert.ok(
      document.activeElement === form.querySelector('input[name="source"]'),
    );
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
    assert.equal(
      document.activeElement,
      c.querySelector(
        'form[data-command="Confirm allocation"] button[type="submit"]',
      ),
    );
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
    assert.match(c.textContent ?? "", /Pilot allocation recorded/);
    assert.ok(
      document.activeElement ===
        [...c.querySelectorAll("h3")].find(
          (heading) => heading.textContent === "Linked prospects",
        ),
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

test("refreshes once at rules expiry and withholds stale allowed guidance on failure", async () => {
  const originalFetch = globalThis.fetch;
  let reads = 0;
  const expiresAt = new Date(Date.now() + 100).toISOString();
  const allowed: Destination = {
    ...item("A"),
    postReadiness: "allowed",
    nextManualAction: "post",
    review: {
      id: "review",
      destinationId: "A",
      sourceUrl: "https://facebook.com/rules",
      summary: "allowed",
      actorId: "founder",
      createdAt: new Date().toISOString(),
      reviewedVersion: 1,
      observedAt: new Date().toISOString(),
      expiresAt,
      decision: "allowed",
    },
  };
  globalThis.fetch = async () => {
    reads++;
    return reads === 1
      ? Response.json(page([allowed]))
      : new Response("{}", { status: 503 });
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
      await new Promise((resolve) => setTimeout(resolve, 180));
    });
    assert.equal(reads, 2);
    assert.match(
      container.textContent ?? "",
      /Review expired; refresh required/,
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    assert.equal(reads, 2);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    globalThis.fetch = originalFetch;
  }
});

test("manual authentication failure closes the event stream and offers sign in", async () => {
  const originalFetch = globalThis.fetch;
  let reads = 0;
  globalThis.fetch = async () => {
    reads++;
    return reads === 1
      ? Response.json(page([item("A")]))
      : new Response("{}", { status: 401 });
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
    const source = Events.instance;
    await act(async () => {
      button(container, "Refresh").click();
      await tick();
    });
    assert.match(container.textContent ?? "", /session expired/i);
    assert.equal(
      container.querySelector('a[href="/growth/login"]')?.textContent,
      "Sign in",
    );
    assert.equal(button(container, "Refresh").disabled, true);
    await act(async () => {
      source.emit("change");
      await tick();
    });
    assert.equal(reads, 2);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    globalThis.fetch = originalFetch;
  }
});

test("unmount cancels a pending expiry refresh", async () => {
  const originalFetch = globalThis.fetch;
  let reads = 0;
  const now = new Date();
  const allowed: Destination = {
    ...item("A"),
    postReadiness: "allowed",
    nextManualAction: "post",
    review: {
      id: "review",
      destinationId: "A",
      sourceUrl: "https://facebook.com/rules",
      summary: "allowed",
      actorId: "founder",
      createdAt: now.toISOString(),
      reviewedVersion: 1,
      observedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 150).toISOString(),
      decision: "allowed",
    },
  };
  globalThis.fetch = async () => {
    reads++;
    return Response.json(page([allowed]));
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
    await act(async () => root.unmount());
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.equal(reads, 1);
  } finally {
    container.remove();
    globalThis.fetch = originalFetch;
  }
});

test("superseded refresh 401 closes the stream and aborts pagination", async () => {
  const originalFetch = globalThis.fetch;
  let resolveRefresh!: (response: Response) => void;
  let resolvePage!: (response: Response) => void;
  let pageSignal: AbortSignal | undefined;
  let reads = 0;
  globalThis.fetch = async (input, init) => {
    reads++;
    if (reads === 1) return Response.json(page([item("A")], "cursor"));
    if (String(input).includes("cursor=")) {
      pageSignal = init?.signal ?? undefined;
      return new Promise<Response>((resolve) => {
        resolvePage = resolve;
      });
    }
    return new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
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
    const source = Events.instance;
    await act(async () => {
      button(container, "Refresh").click();
    });
    await act(async () => {
      button(container, "Next directory page").click();
    });
    await act(async () => {
      resolveRefresh(new Response("{}", { status: 401 }));
      await tick();
    });
    assert.equal(source.closed, 1);
    assert.equal(pageSignal?.aborted, true);
    assert.ok(container.querySelector('a[href="/growth/login"]'));
    assert.equal(button(container, "Refresh").disabled, true);
    assert.equal(button(container, "Next directory page").disabled, true);
    await act(async () => {
      resolvePage(Response.json(page([item("late")])));
      source.emit("change");
      await tick();
    });
    assert.equal(container.querySelector("#late"), null);
    assert.equal(reads, 3);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    globalThis.fetch = originalFetch;
  }
});

test("a sibling 401 remains terminal after an aggregated read fails", async () => {
  const originalFetch = globalThis.fetch;
  let resolveSelected!: (response: Response) => void;
  let reads = 0;
  window.history.replaceState(null, "", "?selectedId=A");
  globalThis.fetch = async (input) => {
    reads++;
    if (reads <= 2) return Response.json(page([item("A")]));
    if (String(input).includes("selectedId="))
      return new Promise<Response>((resolve) => {
        resolveSelected = resolve;
      });
    return new Response("{}", { status: 500 });
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
    const source = Events.instance;
    await act(async () => {
      button(container, "Refresh").click();
      await tick();
    });
    await act(async () => {
      resolveSelected(new Response("{}", { status: 401 }));
      await tick();
    });
    assert.equal(source.closed, 1);
    assert.ok(container.querySelector('a[href="/growth/login"]'));
  } finally {
    await act(async () => root.unmount());
    container.remove();
    window.history.replaceState(null, "", "/growth/facebook");
    globalThis.fetch = originalFetch;
  }
});

test("pagination 401 is terminal and an obsolete page error is ignored", async () => {
  const originalFetch = globalThis.fetch;
  const pending: Array<(response: Response) => void> = [];
  let reads = 0;
  globalThis.fetch = async (input) => {
    reads++;
    if (!String(input).includes("cursor="))
      return Response.json(page([item("A")], "cursor"));
    return new Promise<Response>((resolve) => {
      pending.push(resolve);
    });
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
    const source = Events.instance;
    await act(async () => {
      button(container, "Next directory page").click();
      button(container, "Next directory page").click();
    });
    await act(async () => {
      pending[0](new Response("{}", { status: 500 }));
      await tick();
    });
    assert.equal(container.querySelector('[role="alert"]'), null);
    await act(async () => {
      pending[1](new Response("{}", { status: 401 }));
      await tick();
    });
    assert.equal(source.closed, 1);
    assert.ok(container.querySelector('a[href="/growth/login"]'));
    assert.equal(button(container, "Next directory page").disabled, true);
    assert.equal(reads, 3);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    globalThis.fetch = originalFetch;
  }
});

test("an unmounted workspace ignores a late 401", async () => {
  const originalFetch = globalThis.fetch;
  let resolveRead!: (response: Response) => void;
  globalThis.fetch = async () =>
    new Promise<Response>((resolve) => {
      resolveRead = resolve;
    });
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(createElement(FacebookWorkspace));
    });
    const source = Events.instance;
    await act(async () => {
      source.emit("ready");
    });
    await act(async () => root.unmount());
    await act(async () => {
      resolveRead(new Response("{}", { status: 401 }));
      await tick();
    });
    assert.equal(source.closed, 1);
    assert.equal(container.textContent, "");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("an obsolete refresh failure cannot replace a newer page", async () => {
  const originalFetch = globalThis.fetch;
  let rejectRefresh!: (error: Error) => void;
  let reads = 0;
  globalThis.fetch = async (input) => {
    reads++;
    if (reads === 1) return Response.json(page([item("A")], "cursor"));
    if (String(input).includes("cursor="))
      return Response.json(page([item("B")]));
    return new Promise<Response>((_resolve, reject) => {
      rejectRefresh = reject;
    });
  };
  const container = document.createElement("div");
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
      button(container, "Refresh").click();
    });
    await act(async () => {
      button(container, "Next directory page").click();
      await tick();
    });
    await act(async () => {
      rejectRefresh(new Error("read"));
      await tick();
    });
    assert.ok(container.querySelector("#B"));
    assert.equal(container.querySelector('[role="alert"]'), null);
    assert.match(container.textContent ?? "", /Live updates: connected/);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
  }
});
