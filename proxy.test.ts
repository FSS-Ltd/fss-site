import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest, type NextFetchEvent } from "next/server";
import { proxy } from "./proxy";

// Public and portal host requests return before accessing the framework event.
const unusedEvent = undefined as unknown as NextFetchEvent;

test("leaves the public homepage outside Growth authentication", async () => {
  const request = new NextRequest("http://localhost/");

  const response = await proxy(request, unusedEvent);

  assert.equal(response?.headers.get("x-middleware-next"), "1");
});

test("rewrites the portal hostname root to the portal route", async () => {
  const request = new NextRequest("https://portal.faithfulsoftware.dev/");

  const response = await proxy(request, unusedEvent);

  assert.equal(
    response?.headers.get("x-middleware-rewrite"),
    "https://portal.faithfulsoftware.dev/portal",
  );
});
