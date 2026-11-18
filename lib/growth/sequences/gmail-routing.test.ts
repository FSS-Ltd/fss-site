import assert from "node:assert/strict";
import test from "node:test";
import { assessGmailRouting } from "./gmail-routing";

const enrollment = {
  id: "one",
  status: "active",
  prospectId: "p",
  contactId: "c",
};
const missing = { kind: "missing" } as const;
const valid = { kind: "valid", ids: ["<a@example.test>"] } as const;
const base = {
  thread: { kind: "none" } as const,
  references: missing,
  candidates: [],
  candidatesOverflow: false,
  possibleExposure: false,
  contactSignal: false,
  connectionId: "account",
};
test("holds known, malformed, pending and contact routing without inventing attribution", () => {
  assert.equal(assessGmailRouting(base).kind, "none");
  for (const change of [
    { possibleExposure: true },
    { contactSignal: true },
    { references: { kind: "malformed" } as const },
    { references: { kind: "over_limit" } as const },
    {
      candidates: [
        {
          sequenceId: "one",
          connectionId: null,
          identityConflict: false,
          channel: "gmail",
        },
      ],
    },
  ])
    assert.equal(assessGmailRouting({ ...base, ...change }).kind, "uncertain");
});
test("permits a bound thread with consistent references but holds conflicts", () => {
  const thread = { kind: "unique", enrollment } as const;
  assert.equal(
    assessGmailRouting({ ...base, thread, references: missing }).kind,
    "unique",
  );
  assert.equal(
    assessGmailRouting({
      ...base,
      thread,
      references: valid,
      candidates: [
        {
          sequenceId: "one",
          connectionId: "account",
          identityConflict: false,
          channel: "gmail",
        },
        {
          sequenceId: "one",
          connectionId: null,
          identityConflict: false,
          channel: "gmail",
        },
      ],
    }).kind,
    "unique",
  );
  for (const change of [
    {
      candidates: [
        {
          sequenceId: "one",
          connectionId: "account",
          identityConflict: true,
          channel: "gmail",
        },
      ],
    },
    {
      candidates: [
        {
          sequenceId: "two",
          connectionId: "account",
          identityConflict: false,
          channel: "gmail",
        },
      ],
    },
    {
      candidates: [
        {
          sequenceId: "one",
          connectionId: "foreign",
          identityConflict: false,
          channel: "gmail",
        },
      ],
    },
    { candidatesOverflow: true },
  ])
    assert.equal(
      assessGmailRouting({ ...base, thread, references: valid, ...change })
        .kind,
      "ambiguous",
    );
  assert.equal(
    assessGmailRouting({ ...base, thread, references: { kind: "malformed" } })
      .kind,
    "uncertain",
  );
});
