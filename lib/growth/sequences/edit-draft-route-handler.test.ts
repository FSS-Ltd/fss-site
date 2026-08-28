import assert from "node:assert/strict";
import test from "node:test";

import { FounderAuthorizationError } from "../auth/require-founder";
import { InvalidFirstEmailRevisionContentError } from "./edit-first-email";
import { createEditDraftHandler } from "./edit-draft-route-handler";
import { FirstEmailRevisionError } from "./first-email-revisions";

const routeOrigin = "https://example.test";
const context = { params: Promise.resolve({ id: "draft-id" }) };

function createRequest(
  body: unknown,
  origin: string | null = routeOrigin,
): Request {
  return new Request(`${routeOrigin}/api/growth/messages/draft-id/edit-draft`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(origin === null ? {} : { Origin: origin }),
    },
    body: JSON.stringify(body),
  });
}

const validBody = {
  expectedVersion: 1,
  subject: "New subject",
  paragraphs: ["Body paragraph"],
};

function createHandler(
  overrides: Partial<Parameters<typeof createEditDraftHandler>[0]> = {},
) {
  return createEditDraftHandler({
    db: {} as never,
    config: { origin: routeOrigin },
    authorizeFounder: async () => ({
      email: "j.ntagengwa@faithfulsoftware.dev",
      actorId: "a".repeat(64),
    }),
    reviseDraft: async () => ({
      draftTaskId: "draft-id",
      version: 2,
      editedAt: "2026-08-18T09:00:00.000Z",
      email: {
        subject: "New subject",
        html: "<p>Body</p>",
        text: "Body",
        wordCount: 1,
        optOutSentence: "Opt out.",
        conceptDisclaimer: "Disclaimer.",
      },
    }),
    createCorrelationId: () => "correlation-id",
    reportUnexpectedError: () => undefined,
    ...overrides,
  });
}

test("revises a draft for the authorised founder", async () => {
  let receivedInput: unknown;
  const handler = createHandler({
    reviseDraft: async (_db, input) => {
      receivedInput = input;
      return {
        draftTaskId: input.draftTaskId,
        version: input.expectedVersion + 1,
        editedAt: "2026-08-18T09:00:00.000Z",
        email: {
          subject: input.subject,
          html: "<p>Body</p>",
          text: "Body",
          wordCount: 1,
          optOutSentence: "Opt out.",
          conceptDisclaimer: "Disclaimer.",
        },
      };
    },
  });

  const response = await handler(createRequest(validBody), context);
  const json = (await response.json()) as { ok: boolean; version: number };

  assert.equal(response.status, 200);
  assert.equal(json.ok, true);
  assert.equal(json.version, 2);
  assert.deepEqual(receivedInput, {
    draftTaskId: "draft-id",
    expectedVersion: 1,
    founder: {
      email: "j.ntagengwa@faithfulsoftware.dev",
      actorId: "a".repeat(64),
    },
    correlationId: "correlation-id",
    subject: "New subject",
    paragraphs: ["Body paragraph"],
  });
});

test("rejects a request from an unregistered origin", async () => {
  const handler = createHandler();

  const response = await handler(
    createRequest(validBody, "https://attacker.test"),
    context,
  );

  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "invalid_origin");
});

test("rejects an unauthorised founder", async () => {
  const handler = createHandler({
    authorizeFounder: async () => {
      throw new FounderAuthorizationError();
    },
  });

  const response = await handler(createRequest(validBody), context);

  assert.equal(response.status, 401);
});

test("rejects a malformed body", async () => {
  const handler = createHandler();

  const response = await handler(
    createRequest({ subject: "Missing version" }),
    context,
  );

  assert.equal(response.status, 422);
  assert.equal((await response.json()).code, "invalid_body");
});

test("maps each revision error code to its documented HTTP status", async () => {
  const cases: Array<[FirstEmailRevisionError["code"], number]> = [
    ["not_found", 404],
    ["not_editable", 409],
    ["version_conflict", 409],
    ["revision_limit_reached", 422],
    ["invalid_stored_draft", 422],
  ];

  for (const [code, status] of cases) {
    const handler = createHandler({
      reviseDraft: async () => {
        throw new FirstEmailRevisionError(code);
      },
    });
    const response = await handler(createRequest(validBody), context);
    assert.equal(
      response.status,
      status,
      `expected ${code} to map to ${status}`,
    );
    assert.equal((await response.json()).code, code);
  }
});

test("returns a validation error when the revised email content is invalid", async () => {
  const handler = createHandler({
    reviseDraft: async () => {
      throw new InvalidFirstEmailRevisionContentError(
        "First-email content must contain 140 to 220 words.",
      );
    },
  });

  const response = await handler(createRequest(validBody), context);

  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), {
    ok: false,
    code: "invalid_content",
    message:
      "The first-email content must use 140 to 220 words and retain the opt-out and concept disclaimer exactly once.",
    correlationId: "correlation-id",
  });
});

test("keeps unrelated type errors as server errors", async () => {
  const handler = createHandler({
    reviseDraft: async () => {
      throw new TypeError("Unexpected implementation error");
    },
  });

  const response = await handler(createRequest(validBody), context);

  assert.equal(response.status, 500);
});

test("reports and maps an unexpected error to a 500", async () => {
  const reports: unknown[] = [];
  const handler = createHandler({
    reviseDraft: async () => {
      throw new Error("boom");
    },
    reportUnexpectedError: (report) => {
      reports.push(report);
    },
  });

  const response = await handler(createRequest(validBody), context);

  assert.equal(response.status, 500);
  assert.equal(reports.length, 1);
});
