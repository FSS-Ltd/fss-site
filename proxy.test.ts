import assert from "node:assert/strict";
import test from "node:test";
import {
  NextRequest,
  NextResponse,
  type NextFetchEvent,
  type NextMiddleware,
} from "next/server";
import * as portalProxy from "./proxy";

// Public and portal host requests return before accessing the framework event.
const unusedEvent = undefined as unknown as NextFetchEvent;
const proxyWithPortalResponse = portalProxy.createProxy(
  portalProxy.portalProxyResponse,
);

test("leaves the public homepage outside Growth authentication", async () => {
  const request = new NextRequest("http://localhost/");
  let portalMiddlewareRan = false;
  const proxyWithPortalMiddleware = portalProxy.createProxy(() => {
    portalMiddlewareRan = true;
    return NextResponse.next();
  });

  const response = await proxyWithPortalMiddleware(request, unusedEvent);

  assert.equal(portalMiddlewareRan, false);
  assert.equal(response?.headers.get("x-middleware-next"), "1");
});

test("rewrites the portal hostname root to the portal route", async () => {
  const request = new NextRequest("https://portal.faithfulsoftware.dev/");

  const response = await proxyWithPortalResponse(request, unusedEvent);

  assert.equal(
    response?.headers.get("x-middleware-rewrite"),
    "https://portal.faithfulsoftware.dev/portal",
  );
});

test("rewrites prefix-free portal UI paths to their internal routes", async () => {
  const request = new NextRequest(
    "https://portal.faithfulsoftware.dev/projects/project-123",
  );

  const response = await proxyWithPortalResponse(request, unusedEvent);

  assert.equal(
    response?.headers.get("x-middleware-rewrite"),
    "https://portal.faithfulsoftware.dev/portal/projects/project-123",
  );
});

test("redirects legacy portal paths while preserving search parameters", async () => {
  const request = new NextRequest(
    "https://portal.faithfulsoftware.dev/portal/login?invite=token",
  );

  const response = await proxyWithPortalResponse(request, unusedEvent);

  assert.equal(response?.status, 307);
  assert.equal(
    response?.headers.get("location"),
    "https://portal.faithfulsoftware.dev/login?invite=token",
  );
});

test("restores visible legacy portal paths when prefix-free routing is disabled", async () => {
  const proxyWithLegacyPortalResponse = portalProxy.createProxy(
    portalProxy.createPortalProxyResponse(() => false),
    () => false,
  );
  const request = new NextRequest(
    "https://portal.faithfulsoftware.dev/projects/project-123?view=active",
  );

  const response = await proxyWithLegacyPortalResponse(request, unusedEvent);

  assert.equal(response?.status, 307);
  assert.equal(
    response?.headers.get("location"),
    "https://portal.faithfulsoftware.dev/portal/projects/project-123?view=active",
  );
});

test("runs portal API requests through the injected Clerk middleware", async () => {
  const request = new NextRequest(
    "https://portal.faithfulsoftware.dev/api/portal/access/claim",
  );
  let clerkMiddlewareRan = false;
  const clerkMiddleware: NextMiddleware = () => {
    clerkMiddlewareRan = true;
    return NextResponse.next();
  };
  const response = await portalProxy.createProxy(clerkMiddleware)(
    request,
    unusedEvent,
  );

  assert.equal(clerkMiddlewareRan, true);
  assert.equal(response?.headers.get("x-middleware-next"), "1");
});

test("portal sign-out receives Clerk session middleware", async () => {
  let ran = false;
  const middleware = portalProxy.createProxy(() => {
    ran = true;
    return NextResponse.next();
  });
  await middleware(
    new NextRequest("https://portal.faithfulsoftware.dev/api/auth/sign-out", {
      method: "POST",
    }),
    unusedEvent,
  );
  assert.equal(ran, true);
});
