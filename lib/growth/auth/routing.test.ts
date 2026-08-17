import assert from "node:assert/strict";
import test from "node:test";
import { ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies";

import {
  GROWTH_HOME_PATH,
  GROWTH_LOGIN_PATH,
  deleteGrowthCallbackCookie,
  isGrowthLoginPath,
  resolveGrowthCallbackPath,
} from "./routing";

test("accepts only internal Growth OS callback paths", () => {
  assert.equal(resolveGrowthCallbackPath("/growth"), "/growth");
  assert.equal(
    resolveGrowthCallbackPath("/growth/prospects?status=new#queue"),
    "/growth/prospects?status=new#queue",
  );
});

test("falls back to the Growth OS home for unsafe callback paths", () => {
  const unsafeValues = [
    undefined,
    ["/growth", "https://attacker.example"],
    "https://attacker.example/growth",
    "//attacker.example/growth",
    "/contact",
    GROWTH_LOGIN_PATH,
    `${GROWTH_LOGIN_PATH}/`,
    `/growth?query=${"a".repeat(2_048)}`,
  ];

  for (const value of unsafeValues) {
    assert.equal(resolveGrowthCallbackPath(value), GROWTH_HOME_PATH);
  }
});

test("recognises only the Growth OS login route", () => {
  assert.equal(isGrowthLoginPath(GROWTH_LOGIN_PATH), true);
  assert.equal(isGrowthLoginPath(`${GROWTH_LOGIN_PATH}/`), true);
  assert.equal(isGrowthLoginPath("/growth/login/help"), false);
  assert.equal(isGrowthLoginPath(GROWTH_HOME_PATH), false);
});

test("deletes the callback cookie from its original Growth OS path", () => {
  const headers = new Headers();
  const cookieStore = new ResponseCookies(headers);

  deleteGrowthCallbackCookie(cookieStore);

  assert.match(
    headers.get("set-cookie") ?? "",
    /^growth\.callback_path=; Path=\/growth; Expires=/,
  );
});
