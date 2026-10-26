import { OutreachDrafts } from "@/components/growth/outreach/outreach-drafts";
import { MessageReview } from "@/components/growth/outreach/message-review";
import { createGlobalMessageReview } from "@/lib/growth/dashboard/global-message-review";
import { createGlobalResearchFixture } from "@/lib/growth/research/global-test-fixture";

export function ResearchEmailReviewScenario(): React.JSX.Element {
  const email = createGlobalResearchFixture().prospects[0]!.firstEmail;
  const result = createGlobalMessageReview(
    {
      id: "11111111-1111-4111-8111-111111111111",
      prospectId: "22222222-2222-4222-8222-222222222222",
      status: "completed",
      outputSnapshot: {
        schemaVersion: "2.0",
        reviewState: "research_only",
        email,
      },
      completedAt: new Date("2026-10-26T08:00:00Z"),
      businessName: "Research Review Example",
      websiteUrl: "https://example.test",
      prospectVersion: 1,
      fitScore: 72,
      recommendedOffer: "Customer portal",
      estimatedOneOffMinPence: 0,
      estimatedOneOffMaxPence: 0,
      contactFirstName: null,
      contactLastName: null,
      contactEmail: "business@example.test",
      normalisedEmail: "business@example.test",
      subscriberType: "uncertain",
      corporateStatus: "active",
    },
    "founder@example.test",
    false,
    [],
  );
  return (
    <main style={{ padding: 20, maxWidth: 1440, margin: "auto" }}>
      <OutreachDrafts
        result={{
          status: "ready",
          rows: [
            {
              draftTaskId: "11111111-1111-4111-8111-111111111111",
              businessName: "Research Review Example",
              contactName: "Business contact",
              completedAt: "2026-10-26T08:00:00Z",
            },
            {
              draftTaskId: "33333333-3333-4333-8333-333333333333",
              businessName: "Second Example",
              contactName: "Second contact",
              completedAt: "2026-10-26T08:00:00Z",
            },
            {
              draftTaskId: "44444444-4444-4444-8444-444444444444",
              businessName: "Blocked Example",
              contactName: "Blocked contact",
              completedAt: "2026-10-26T08:00:00Z",
            },
          ],
        }}
      />
      <MessageReview result={result} />
    </main>
  );
}
