import assert from "node:assert/strict";
import test from "node:test";
import { NextResponse } from "next/server";
import { dispatchPortalProxy } from "./proxy-dispatch";
test("portal proxy preserves the founder guard and separates client routes", async () => {
  const seen: string[] = [];
  for (const path of [
    "/growth",
    "/growth/operations/clients",
    "/portal",
    "/portal/login",
    "/api/portal/requests",
    "/growth-spoof",
  ]) {
    await dispatchPortalProxy(
      path,
      () => {
        seen.push(`founder:${path}`);
        return NextResponse.next();
      },
      () => {
        seen.push(`portal:${path}`);
        return NextResponse.next();
      },
    );
  }
  assert.deepEqual(seen, [
    "founder:/growth",
    "founder:/growth/operations/clients",
    "portal:/portal",
    "portal:/portal/login",
    "portal:/api/portal/requests",
    "portal:/growth-spoof",
  ]);
});
