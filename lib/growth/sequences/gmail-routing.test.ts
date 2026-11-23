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

test("exact confirmed references can bind an otherwise unassociated Gmail thread", () => {
  const attribution = {
    basis: "gmail_exact_reference_v1" as const,
    outboundProvider: "resend" as const,
    reservationId: "reservation",
    rfcMessageId: "<a@example.test>",
    connectionId: "account",
    googleSubject: "subject",
    grantEpoch: 1,
    recipient: "owner@example.test",
  };
  const proven = [{ enrollment, attribution }];
  assert.notEqual(
    assessGmailRouting({
      ...base,
      references: valid,
      candidates: [
        {
          sequenceId: enrollment.id,
          connectionId: "resend-account",
          channel: "resend",
          identityConflict: false,
          reservationId: "historical-no-monitor",
        },
      ],
    }).kind,
    "unique",
  );
  const candidates = [
    {
      sequenceId: enrollment.id,
      connectionId: "resend-account",
      channel: "resend",
      identityConflict: false,
      reservationId: "reservation",
    },
  ];
  assert.deepEqual(
    assessGmailRouting({
      ...base,
      references: valid,
      candidates,
      proven,
      possibleExposure: true,
    }),
    { kind: "unique", enrollment, attribution },
  );
  assert.equal(
    assessGmailRouting({
      ...base,
      references: valid,
      candidates,
      proven: [...proven, ...proven],
    }).kind,
    "ambiguous",
  );
  assert.equal(
    assessGmailRouting({
      ...base,
      references: valid,
      candidates: [
        ...candidates,
        { ...candidates[0]!, reservationId: "other" },
      ],
      proven,
    }).kind,
    "ambiguous",
  );
  assert.equal(
    assessGmailRouting({
      ...base,
      references: { kind: "malformed" },
      candidates,
      proven,
    }).kind,
    "uncertain",
  );
  assert.equal(
    assessGmailRouting({
      ...base,
      thread: {
        kind: "unknown",
        enrollment: { ...enrollment, id: "other" },
        safeToPause: false,
      },
      references: valid,
      candidates,
      proven,
    }).kind,
    "ambiguous",
  );
});

test("a bound Gmail thread accepts multiple confirmed references from its own sequence", () => {
  const gmail = {
    basis: "gmail_exact_reference_v1" as const,
    outboundProvider: "gmail" as const,
    connectionId: "account",
    googleSubject: "subject",
    grantEpoch: 1,
    recipient: "owner@example.test",
  };
  const first = {
    enrollment,
    attribution: {
      ...gmail,
      reservationId: "one",
      rfcMessageId: "<one@example.test>",
    },
  };
  const second = {
    enrollment,
    attribution: {
      ...gmail,
      reservationId: "two",
      rfcMessageId: "<two@example.test>",
    },
  };
  const candidates = ["one", "two"].map((reservationId) => ({
    sequenceId: enrollment.id,
    connectionId: "account",
    channel: "gmail",
    identityConflict: false,
    reservationId,
  }));
  const thread = { kind: "unique" as const, enrollment };
  assert.equal(
    assessGmailRouting({
      ...base,
      thread,
      references: {
        kind: "valid",
        ids: [first.attribution.rfcMessageId, second.attribution.rfcMessageId],
      },
      candidates,
      proven: [first, second],
    }).kind,
    "unique",
  );
  assert.equal(
    assessGmailRouting({
      ...base,
      thread,
      references: valid,
      candidates,
      proven: [
        first,
        { ...second, enrollment: { ...enrollment, id: "other" } },
      ],
    }).kind,
    "ambiguous",
  );
  assert.equal(
    assessGmailRouting({
      ...base,
      thread,
      references: valid,
      candidates,
      proven: [first, second],
      candidatesOverflow: true,
    }).kind,
    "ambiguous",
  );
});

test("changed thread selects one direct Resend reply only when all resolved references agree", () => {
  const common = {
    basis: "gmail_exact_reference_v1" as const,
    outboundProvider: "resend" as const,
    connectionId: "account",
    googleSubject: "subject",
    grantEpoch: 1,
    recipient: "owner@example.test",
  };
  const first = {
    enrollment,
    attribution: {
      ...common,
      reservationId: "first",
      rfcMessageId: "<first@example.test>",
    },
  };
  const second = {
    enrollment,
    attribution: {
      ...common,
      reservationId: "second",
      rfcMessageId: "<second@example.test>",
    },
  };
  const candidates = [first, second].map((item) => ({
    sequenceId: enrollment.id,
    connectionId: "resend-account",
    channel: "resend",
    identityConflict: false,
    reservationId: item.attribution.reservationId,
  }));
  const references = {
    kind: "valid" as const,
    ids: [first.attribution.rfcMessageId, second.attribution.rfcMessageId],
  };
  const input = {
    ...base,
    references,
    inReplyTo: {
      kind: "valid" as const,
      ids: [second.attribution.rfcMessageId],
    },
    candidates,
    proven: [first, second],
  };
  assert.deepEqual(assessGmailRouting(input), {
    kind: "unique",
    enrollment,
    attribution: second.attribution,
  });
  for (const change of [
    { inReplyTo: missing },
    { inReplyTo: references },
    {
      proven: [
        first,
        { ...second, enrollment: { ...enrollment, id: "other" } },
      ],
    },
    {
      proven: [
        first,
        {
          ...second,
          attribution: {
            ...second.attribution,
            recipient: "other@example.test",
          },
        },
      ],
    },
    {
      candidates: [
        ...candidates,
        { ...candidates[0]!, reservationId: "unconfirmed" },
      ],
    },
    {
      candidates: [
        candidates[0]!,
        { ...candidates[1]!, connectionId: "other-account" },
      ],
    },
    {
      proven: [
        first,
        {
          ...second,
          attribution: {
            ...second.attribution,
            rfcMessageId: first.attribution.rfcMessageId,
          },
        },
      ],
    },
  ])
    assert.equal(assessGmailRouting({ ...input, ...change }).kind, "ambiguous");
});
