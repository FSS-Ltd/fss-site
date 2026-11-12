import assert from "node:assert/strict";
import test from "node:test";

import { createRequire } from "node:module";

import type * as ReactTypes from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  focusMainContent,
  PageTransition,
  pageTransitionProps,
} from "./page-transition";

test("renders the page unchanged when React has no ViewTransition", () => {
  const html = renderToStaticMarkup(
    <PageTransition>
      <p>Page body</p>
    </PageTransition>,
  );

  assert.equal(html, "<p>Page body</p>");
});

test("enter and exit use the named page animations and nothing else animates", () => {
  assert.deepEqual(pageTransitionProps, {
    enter: "fss-page-in",
    exit: "fss-page-out",
    default: "none",
  });
});

test("wraps the page in a ViewTransition carrying those props when React ships one", () => {
  const received: Record<string, unknown>[] = [];
  const Stub = (props: Record<string, unknown>) => {
    received.push(props);
    return <>{props.children as ReactTypes.ReactNode}</>;
  };
  // The real CommonJS exports object: a namespace import is a read-only copy.
  const target = createRequire(import.meta.url)("react") as {
    ViewTransition?: unknown;
  };
  target.ViewTransition = Stub;
  try {
    const html = renderToStaticMarkup(
      <PageTransition>
        <p>Page body</p>
      </PageTransition>,
    );

    assert.equal(html, "<p>Page body</p>");
    assert.equal(received[0]?.enter, "fss-page-in");
    assert.equal(received[0]?.exit, "fss-page-out");
    assert.equal(received[0]?.default, "none");
  } finally {
    delete target.ViewTransition;
  }
});

test("focus moves to main#main-content without scrolling", () => {
  const calls: unknown[] = [];
  focusMainContent({
    getElementById: (id: string) => {
      assert.equal(id, "main-content");
      return { focus: (options: unknown) => calls.push(options) } as never;
    },
  });

  assert.deepEqual(calls, [{ preventScroll: true }]);
});

test("a page without main content is left alone", () => {
  assert.doesNotThrow(() => focusMainContent({ getElementById: () => null }));
});
