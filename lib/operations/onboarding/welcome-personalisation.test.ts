import assert from "node:assert/strict";
import test from "node:test";
import {
  interpolateWelcomeCopy,
  resolveWelcomePack,
} from "./welcome-personalisation";

test("personalisation rejects missing client facts instead of silently erasing them", () => {
  assert.throws(
    () => interpolateWelcomeCopy("Hello {{contact_first_name}}", {}),
    /contact_first_name/,
  );
  assert.throws(
    () => interpolateWelcomeCopy("{{agreement_goal}}", { agreement_goal: " " }),
    /agreement_goal/,
  );
  assert.equal(
    interpolateWelcomeCopy("Hello {{contact_first_name}}", {
      contact_first_name: "Alex",
    }),
    "Hello Alex",
  );
});

test("personalisation resolves a legacy pack without mutating its published copy", () => {
  const pack = {
    emailSubject: "Hello {{client_name}}",
    emailBody: "Welcome {{contact_first_name}}",
    guide: [{ title: "Your project", paragraphs: ["{{agreement_scope}}"] }],
    thankYou: {
      subject: "Thank you",
      intro: "{{client_name}}",
      nextStep: "Review",
      requiredAction: "Confirm",
    },
    tasks: [],
  };
  const resolved = resolveWelcomePack(
    pack,
    {
      client_name: "Northstar",
      contact_first_name: "Alex",
      agreement_scope: "Website",
    },
    48,
  );
  assert.equal(resolved.guide[0]?.paragraphs[0], "Website");
  assert.equal(pack.guide[0]?.paragraphs[0], "{{agreement_scope}}");
  assert.equal(resolved.emailSubject, "Hello Northstar");
});

test("designed personalisation keeps the narrative without full agreement terms", async () => {
  const { createDesignedWelcomePack } = await import("./packet-editions");
  const source = createDesignedWelcomePack("website_build");
  const resolved = resolveWelcomePack(
    source,
    {
      client_name: "Northstar",
      contact_first_name: "Alex",
      agreement_goal: "Clear booking",
      agreement_scope: "Website and booking",
      sender_name: "Jean-Fidele",
    },
    24,
  );
  assert.equal(resolved.rendererVersion, 2);
  assert.equal(resolved.guide.length, 9);
  assert.equal(resolved.guide[4].layout, "timeline");
  assert.ok(!JSON.stringify(resolved.guide).includes("Website and booking"));
  assert.ok(
    resolved.guide[7].paragraphs.some((copy) => copy.includes("24 hours")),
  );
  assert.ok(
    !source.guide[7].paragraphs.some((copy) => copy.includes("24 hours")),
  );
});
