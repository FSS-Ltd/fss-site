import assert from "node:assert/strict";
import test from "node:test";
import { currentVisibilityExpiry } from "./account-repository";

const now = new Date("2026-11-18T12:00:00Z");
const scopes = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.modify",
];
const supportedPaths = {
  nativeMailbox: "included",
  fssGmailApi: "included",
  aliases: "native_send_as",
  delegation: "none",
  other: "none",
};
function review(paths: object | undefined, recipientHeaders = "complete") {
  return {
    googleSubject: "subject",
    googleScopes: scopes,
    evidence: {
      source: "review",
      edition: "1",
      path: "gmail",
      observedAt: "2026-11-17T00:00:00Z",
      expiresAt: "2026-11-20T00:00:00Z",
      messages: 100,
      recipients: [100, 100, 100, 100],
      perMessage: 10,
      messageReserve: 50,
      recipientReserve: 0,
      visibility: {
        source: "review",
        reviewedAt: "2026-11-17T00:00:00Z",
        expiresAt: "2026-11-19T00:00:00Z",
        scope: "reviewed",
        paths: {
          mailbox: "covered",
          aliases: "covered",
          delegates: "covered",
          automatic: "covered",
        },
        recipientHeaders,
        ...(paths ? { supportedPaths: paths } : {}),
      },
    },
  };
}

test("only the explicit supported sending paths and complete recipients can pass", () => {
  assert.ok(
    currentVisibilityExpiry(review(supportedPaths), "subject", scopes, now),
  );
  for (const paths of [
    undefined,
    { ...supportedPaths, other: "external_smtp" },
    { ...supportedPaths, other: "relay" },
    { ...supportedPaths, other: "unknown" },
    { ...supportedPaths, delegation: "present" },
    { ...supportedPaths, aliases: "unknown" },
    { ...supportedPaths, nativeMailbox: "unknown" },
  ]) {
    assert.equal(
      currentVisibilityExpiry(review(paths), "subject", scopes, now),
      null,
    );
  }
  assert.equal(
    currentVisibilityExpiry(
      review(supportedPaths, "unknown"),
      "subject",
      scopes,
      now,
    ),
    null,
  );
  assert.equal(
    currentVisibilityExpiry(review(supportedPaths), "different", scopes, now),
    null,
  );
});
