import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { portalRoleOptions } from "@/lib/operations/auth/access-dashboard-metrics";
import type { PortalRole } from "@/lib/operations/auth/types";

const require = createRequire(import.meta.url);

require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, property) => String(property) }),
  };
};

const { PortalRolePicker } =
  require("./portal-role-picker") as typeof import("./portal-role-picker");

type ElementProps = {
  children?: ReactNode;
  "aria-label"?: string;
  "aria-expanded"?: boolean;
  onClick?: () => void;
  onFocus?: () => void;
};

function findElement(
  node: ReactNode,
  predicate: (props: ElementProps) => boolean,
): ElementProps | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findElement(child, predicate);
      if (match) return match;
    }
    return null;
  }

  if (!isValidElement(node)) return null;

  const props = node.props as ElementProps;
  if (predicate(props)) return props;

  return findElement(props.children, predicate);
}

function createPickerStateHarness(): {
  render: () => ReactNode;
  dispose: () => void;
} {
  const react = require("react") as typeof import("react");
  const originalUseState = react.useState;
  const values: (PortalRole | null)[] = ["viewer", null];
  let index = 0;

  Object.defineProperty(react, "useState", {
    configurable: true,
    value: <State extends PortalRole | null,>(initial: State) => {
      const stateIndex = index++;
      const state = (values[stateIndex] ?? initial) as State;
      const setState = (next: State | ((previous: State) => State)) => {
        values[stateIndex] =
          typeof next === "function"
            ? (next as (previous: State) => State)(state)
            : next;
      };

      return [state, setState];
    },
  });
  delete require.cache[require.resolve("./portal-role-picker")];
  const { PortalRolePicker: Picker } = require("./portal-role-picker") as typeof import("./portal-role-picker");

  return {
    render: () => {
      index = 0;
      return Picker({
        name: "role",
        defaultValue: "viewer",
        disabled: false,
        options: portalRoleOptions,
      });
    },
    dispose: () => {
      Object.defineProperty(react, "useState", {
        configurable: true,
        value: originalUseState,
      });
      delete require.cache[require.resolve("./portal-role-picker")];
    },
  };
}

test("role picker exposes native radios, help buttons and persistent selection description", () => {
  const html = renderToStaticMarkup(
    <PortalRolePicker
      name="role"
      defaultValue="viewer"
      disabled={false}
      options={portalRoleOptions}
    />,
  );

  assert.match(html, /type="radio"/);
  assert.match(html, /name="role"/);
  assert.match(html, /aria-describedby="portal-role-description"/);
  assert.match(html, /aria-label="More about Owner"/);
  assert.match(html, /Read-only projects, documents, and services/);
});

test("clicking an unfocused help control leaves its focused tooltip open", () => {
  const harness = createPickerStateHarness();
  const ownerHelp = findElement(harness.render(), (props) =>
    props["aria-label"] === "More about Owner",
  );

  try {
    assert.ok(ownerHelp?.onFocus);
    assert.ok(ownerHelp?.onClick);
    ownerHelp.onFocus();
    const focusedOwnerHelp = findElement(harness.render(), (props) =>
      props["aria-label"] === "More about Owner",
    );

    assert.equal(focusedOwnerHelp?.["aria-expanded"], true);
    focusedOwnerHelp?.onClick?.();
    const clickedOwnerHelp = findElement(harness.render(), (props) =>
      props["aria-label"] === "More about Owner",
    );

    assert.equal(clickedOwnerHelp?.["aria-expanded"], true);
  } finally {
    harness.dispose();
  }
});
