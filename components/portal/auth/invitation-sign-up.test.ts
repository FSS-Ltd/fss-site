import assert from "node:assert/strict";
import test from "node:test";
import {
  completeInvitationSignUp,
  invitationAddressWithoutPersonalDetails,
} from "./invitation-sign-up";

test("invitation signup supplies the ticket and password together and routes through the access claim", async () => {
  const calls: unknown[] = [];
  const navigated: string[] = [];
  await completeInvitationSignUp({
    signUp: {
      status: "complete",
      create: async (input) => {
        calls.push(input);
        return { error: null };
      },
      finalize: async (input) => {
        assert.ok(
          input?.navigate,
          "Use Clerk's navigation hook instead of its default redirect",
        );
        await input.navigate({
          session: { currentTask: null },
          decorateUrl: (url) => url,
        });
        return { error: null };
      },
    },
    ticket: "fixture-ticket",
    name: "Invited Person",
    password: "fixture-password",
    claim: async (name) => {
      assert.equal(name, "Invited Person");
      return "/admin";
    },
    navigate: (url) => {
      navigated.push(url);
    },
  });
  assert.deepEqual(calls, [
    {
      strategy: "ticket",
      ticket: "fixture-ticket",
      password: "fixture-password",
      firstName: "Invited",
      lastName: "Person",
    },
  ]);
  assert.deepEqual(navigated, ["/admin"]);
});

test("removing name and email from the invitation URL preserves the ticket after refresh", () => {
  assert.equal(
    invitationAddressWithoutPersonalDetails(
      "/activate",
      "name=Person&email=person%40example.test&__clerk_ticket=fixture&__clerk_status=sign_up",
    ),
    "/activate?__clerk_ticket=fixture&__clerk_status=sign_up",
  );
});

for (const pendingTask of [false, true]) {
  test(
    pendingTask
      ? "session tasks block access claims and navigation"
      : "incomplete signups cannot finalize or claim access",
    async () => {
      let claimed = false;
      await assert.rejects(
        completeInvitationSignUp({
          signUp: {
            status: pendingTask ? "complete" : "missing_requirements",
            create: async () => ({ error: null }),
            finalize: async (input) => {
              assert.ok(pendingTask);
              await input.navigate({
                session: { currentTask: { key: "verification" } },
                decorateUrl: (url) => url,
              });
              return { error: null };
            },
          },
          ticket: "fixture",
          name: "Person",
          password: "fixture-password",
          claim: async () => {
            claimed = true;
            return "/admin";
          },
          navigate: () =>
            assert.fail("An incomplete identity must not navigate"),
        }),
        pendingTask ? /remaining account verification/ : /more information/,
      );
      assert.equal(claimed, false);
    },
  );
}

test("claim errors let Clerk finish activating its session so access can be retried", async () => {
  let sessionActivated = false;
  await assert.rejects(
    completeInvitationSignUp({
      signUp: {
        status: "complete",
        create: async () => ({ error: null }),
        finalize: async (input) => {
          await input.navigate({ session: {}, decorateUrl: (url) => url });
          sessionActivated = true;
          return { error: null };
        },
      },
      ticket: "fixture",
      name: "Person",
      password: "fixture-password",
      claim: async () => {
        throw new Error("Access is temporarily unavailable");
      },
      navigate: () => assert.fail("Failed claims cannot navigate"),
    }),
    /temporarily unavailable/,
  );
  assert.equal(sessionActivated, true);
});
