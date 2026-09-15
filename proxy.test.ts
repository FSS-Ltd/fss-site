import assert from "node:assert/strict";
import test from "node:test";
import {
  NextRequest,
  NextResponse,
  type NextFetchEvent,
  type NextMiddleware,
} from "next/server";
import { createProxy, proxy, portalProxyResponse } from "./proxy";

// Public and portal host requests return before accessing the framework event.
const unusedEvent = undefined as unknown as NextFetchEvent;

test("leaves the public homepage outside Growth authentication", async () => {
  const request = new NextRequest("http://localhost/");

  const response = await proxy(request, unusedEvent);

  assert.equal(response?.headers.get("x-middleware-next"), "1");
});

test("rewrites the portal hostname root to the portal route", async () => {
  const request = new NextRequest("https://portal.faithfulsoftware.dev/");
  let portalMiddlewareRan = false;
  const portalMiddleware: NextMiddleware = (portalRequest) => {
    portalMiddlewareRan = true;
    return portalProxyResponse(portalRequest);
  };

  const response = await createProxy(portalMiddleware)(request, unusedEvent);

  assert.equal(portalMiddlewareRan, true);
  assert.equal(
    response?.headers.get("x-middleware-rewrite"),
    "https://portal.faithfulsoftware.dev/portal",
  );
});

test("routes portal API requests through Clerk middleware", async () => {
  const request = new NextRequest(
    "https://portal.faithfulsoftware.dev/api/portal/access/claim",
  );
  let portalMiddlewareRan = false;
  const portalMiddleware: NextMiddleware = () => {
    portalMiddlewareRan = true;
    return NextResponse.next();
  };

  const response = await createProxy(portalMiddleware)(request, unusedEvent);

  assert.equal(portalMiddlewareRan, true);
  assert.equal(response?.headers.get("x-middleware-next"), "1");
});
