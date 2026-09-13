import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Operations screens preserve the Growth shell's single main landmark", () => {
  const shell = readFileSync(
    new URL("../../growth/shell/growth-shell.tsx", import.meta.url),
    "utf8",
  );
  assert.match(shell, /<main\b[^>]*id="growth-main"/);

  // The request route needs founder/database context, so inspect its JSX boundary.
  for (const path of [
    "../clients/client-list.tsx",
    "../billing/exception-list.tsx",
    "../overview/overview.tsx",
    "../../../app/(growth)/(dashboard)/growth/operations/clients/[organisationId]/requests/[requestId]/page.tsx",
  ]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.doesNotMatch(source, /<main\b/, path);
  }
});
