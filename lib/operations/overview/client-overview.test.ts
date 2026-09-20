import assert from "node:assert/strict";
import test from "node:test";
import {
  selectClientAttention,
  type ClientOverview,
} from "./client-overview";

const overview: ClientOverview = {
  checklist: {
    agreementSigned: false,
    billingReady: true,
    filesReady: true,
    serviceReady: true,
  },
  notifications: [],
  organisationId: "f334b7c3-69f4-4e9f-8b2c-d4f6b8ed9821",
  projects: [
    {
      id: "d4ff8502-70e2-4bc0-96c6-7a3d2b5314c6",
      status: "active",
      summary: "A secure client workspace.",
      targetDate: null,
      title: "Member portal",
    },
  ],
  requests: [
    {
      id: "c6eacee2-f799-4207-a66d-8492471ee329",
      nextAction: "Review the latest delivery.",
      publicSummary: "A new version is ready.",
      status: "ready_for_review",
      targetDate: null,
      title: "Review booking flow",
    },
  ],
};

const emptyOverview: ClientOverview = {
  checklist: null,
  notifications: null,
  organisationId: "41fd838a-9418-4c1c-ac34-bff39778fbdc",
  projects: null,
  requests: null,
};

test("prioritises an authorised review over setup and project summaries", () => {
  assert.equal(selectClientAttention(overview)?.kind, "review");
  assert.equal(
    selectClientAttention({ ...overview, requests: [] })?.kind,
    "setup",
  );
  assert.equal(
    selectClientAttention({
      ...overview,
      checklist: {
        agreementSigned: true,
        billingReady: true,
        filesReady: true,
        serviceReady: true,
      },
      requests: [],
    })?.kind,
    "project",
  );
  assert.equal(selectClientAttention(emptyOverview), null);
});
