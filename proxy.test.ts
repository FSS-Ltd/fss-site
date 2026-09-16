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

test("rewrites prefix-free portal UI paths to their internal routes", async () => {
  const request = new NextRequest(
    "https://portal.faithfulsoftware.dev/projects/project-123",
  );

  const response = await proxy(request, unusedEvent);

  assert.equal(
    response?.headers.get("x-middleware-rewrite"),
    "https://portal.faithfulsoftware.dev/portal/projects/project-123",
  );
});

test("redirects legacy portal paths while preserving search parameters", async () => {
  const request = new NextRequest(
    "https://portal.faithfulsoftware.dev/portal/login?invite=token",
  );

  const response = await proxy(request, unusedEvent);

  assert.equal(response?.status, 307);
  assert.equal(
    response?.headers.get("location"),
    "https://portal.faithfulsoftware.dev/login?invite=token",
  );
});
