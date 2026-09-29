import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const redirects: string[] = [];

const clerkModulePath = require.resolve("@clerk/nextjs");
const clerkMock = new Module(clerkModulePath);

clerkMock.filename = clerkModulePath;
clerkMock.loaded = true;
clerkMock.exports = {
  SignOutButton: ({
    children,
    redirectUrl,
  }: {
    children: React.ReactNode;
    redirectUrl?: string;
  }) => {
    if (redirectUrl) redirects.push(redirectUrl);
    return children;
  },
};
require.cache[clerkModulePath] = clerkMock;

const { PortalSignOutButton } =
  require("./portal-sign-out") as typeof import("./portal-sign-out");

test("uses Clerk's sign-out control and returns to the portal login page", () => {
  redirects.length = 0;
  const props: Parameters<typeof PortalSignOutButton>[0] = {
    children: "Sign out",
    redirectUrl: "/login",
  };

  const markup = renderToStaticMarkup(
    createElement(PortalSignOutButton, props),
  );

  assert.match(markup, /<button[^>]*>Sign out<\/button>/);
  assert.deepEqual(redirects, ["/login"]);
});
