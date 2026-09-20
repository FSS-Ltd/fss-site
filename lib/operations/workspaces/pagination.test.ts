import assert from "node:assert/strict";
import test from "node:test";
import {
  parseWorkspacePage,
  toWorkspaceCollectionPage,
  workspacePageOffset,
  workspacePageSize,
} from "./pagination";

test("workspace collection pages reject ambiguous input and retain a bounded next page", () => {
  assert.equal(parseWorkspacePage(undefined), 1);
  assert.equal(parseWorkspacePage("3"), 3);
  assert.equal(workspacePageOffset(3), workspacePageSize * 2);
  assert.throws(() => parseWorkspacePage(["1", "2"]));
  assert.throws(() => parseWorkspacePage("0"));

  const page = toWorkspaceCollectionPage(
    Array.from({ length: workspacePageSize + 1 }, (_, index) => index),
    2,
  );
  assert.equal(page.page, 2);
  assert.equal(page.items.length, workspacePageSize);
  assert.equal(page.hasNext, true);
});
