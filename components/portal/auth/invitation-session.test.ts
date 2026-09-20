import assert from "node:assert/strict";
import test from "node:test";
import { switchInvitationAccount } from "./invitation-session";

for (const path of ["/activate", "/portal/activate"]) {
  test(`switching accounts returns to the intact invitation at ${path}`, async () => {
    const destinations: string[] = [];
    let sessionCleared = false;
    await switchInvitationAccount(
      path,
      {
        ticket: "fixture+ticket/value",
        name: "Invited Person",
        email: "invited@example.test",
        clerkStatus: "sign_up",
      },
      async (afterSignOut) => {
        sessionCleared = true;
        afterSignOut();
        assert.deepEqual(destinations, []);
      },
      (url) => {
        assert.equal(sessionCleared, true);
        destinations.push(url);
      },
    );
    assert.deepEqual(destinations, [
      `${path}?__clerk_ticket=fixture%2Bticket%2Fvalue&name=Invited+Person&email=invited%40example.test&__clerk_status=sign_up`,
    ]);
  });
}

test("a failed Clerk sign-out cannot silently continue invitation acceptance", async () => {
  await assert.rejects(
    switchInvitationAccount(
      "/activate",
      { ticket: "fixture", name: "", email: "", clerkStatus: null },
      async () => {
        throw new Error("sign-out failed");
      },
      () => assert.fail("Failed sign-out cannot navigate"),
    ),
    /sign-out failed/,
  );
});

test("account switching cannot redirect an invitation to another origin or unrelated route", async () => {
  for (const path of [
    "https://untrusted.example/activate",
    "//untrusted.example/activate",
    "/login",
    "/activate?next=other",
  ]) {
    await assert.rejects(
      switchInvitationAccount(
        path,
        { ticket: "fixture", name: "", email: "", clerkStatus: null },
        async () => assert.fail("Invalid destinations cannot sign out"),
        () => assert.fail("Invalid destinations cannot navigate"),
      ),
      /could not be reopened/,
    );
  }
});

test("an already-cleared session still reopens the invitation", async () => {
  const destinations: string[] = [];
  await switchInvitationAccount(
    "/activate",
    { ticket: "fixture", name: "", email: "", clerkStatus: null },
    async () => undefined,
    (url) => destinations.push(url),
  );
  assert.deepEqual(destinations, ["/activate?__clerk_ticket=fixture"]);
});
