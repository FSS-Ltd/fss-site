import { z } from "zod";
import {
  healthReviewSchema,
  limitsReviewSchema,
} from "../campaigns/account-contracts";
import {
  loadConfiguredAccountReadiness,
  sameAccountScopes,
} from "../campaigns/account-repository";
import { getGrowthDb, withGrowthTransaction } from "../db/client";
import type { GrowthDb } from "../db/types";
import type { FounderSession } from "../auth/require-founder";
import { requireCampaignFounder } from "../campaigns/authorization";
import { loadResendAccountReadiness } from "../campaigns/resend-account-repository";
import { readResendOutreachRuntime } from "../campaigns/resend-account-runtime";

export type CampaignAccount = {
  id: string;
  provider: "gmail" | "resend";
  sender: string;
  selectable: boolean;
  readiness: { status: "ready" } | { status: "held"; reason: string };
  recordedRamp: number | null;
  limitsEvidence: { observedAt: string; expiresAt: string } | null;
  healthEvidence: { observedAt: string; expiresAt: string } | null;
  usageObservation: { observedAt: string; expiresAt: string } | null;
};
export type CampaignAccountsResult =
  | {
      status: "ready";
      accounts: CampaignAccount[];
      resendConfiguration: "available" | "unknown";
    }
  | { status: "unavailable" };

const envelope = z.object({
  evidence: z.unknown(),
  googleSubject: z.string(),
  googleScopes: z.array(z.string()),
});
function gmailEvidence(
  value: unknown,
  subject: string | null,
  scopes: string[],
  kind: "limits" | "health",
) {
  const parsed = envelope.safeParse(value);
  if (
    !parsed.success ||
    !subject ||
    parsed.data.googleSubject !== subject ||
    !sameAccountScopes(parsed.data.googleScopes, scopes)
  )
    return null;
  if (kind === "limits") {
    const review = limitsReviewSchema.safeParse(parsed.data.evidence);
    return review.success
      ? {
          observedAt: review.data.observedAt.toISOString(),
          expiresAt: review.data.expiresAt.toISOString(),
        }
      : null;
  }
  const review = healthReviewSchema.safeParse(parsed.data.evidence);
  return review.success
    ? {
        observedAt: review.data.observedUntil.toISOString(),
        expiresAt: review.data.expiresAt.toISOString(),
      }
    : null;
}
// No credentials, raw review evidence or provider calls cross this boundary.
export async function getCampaignAccounts(
  founder: FounderSession,
  db: GrowthDb = getGrowthDb(),
  runtime = readResendOutreachRuntime(),
): Promise<CampaignAccountsResult> {
  requireCampaignFounder(founder);
  try {
    return await withGrowthTransaction(db, async (tx) => {
      const gmailRows = await tx<
        {
          id: string;
          sender: string;
          status: string;
          subject: string | null;
          scopes: string[];
          ramp: number | null;
          limits: unknown;
          health: unknown;
          usageAt: Date | null;
          usageExpires: Date | null;
        }[]
      >`
        select i.id, i.subject_email as sender, i.status, i.google_subject as subject,
          i.granted_scopes as scopes, c.ramp, l.evidence as limits, h.evidence as health,
          u.captured_at as "usageAt", u.fresh_until as "usageExpires"
        from growth.integration_connections i
        left join growth.outreach_account_controls c on c.connection_id=i.id and c.provider='gmail'
        left join growth.outreach_account_reviews l on l.id=c.limits_review_id and l.connection_id=i.id
        left join growth.outreach_account_reviews h on h.id=c.health_review_id and h.connection_id=i.id
        left join lateral (
          select min(captured_at) as captured_at, min(fresh_until) as fresh_until
          from growth.outreach_provider_usage where connection_id=i.id having count(*)=1
        ) u on true
        where i.provider='gmail' and i.subject_email=${founder.email}
        limit 1
      `;
      const accounts: CampaignAccount[] = [];
      const gmail = gmailRows[0];
      if (gmail) {
        const readiness = await loadConfiguredAccountReadiness(
          tx,
          gmail.id,
          "active",
        );
        accounts.push({
          id: gmail.id,
          provider: "gmail",
          sender: gmail.sender,
          selectable:
            gmail.status === "connected" &&
            !!gmail.subject &&
            gmail.scopes.includes(
              "https://www.googleapis.com/auth/gmail.modify",
            ),
          readiness,
          recordedRamp: gmail.ramp,
          limitsEvidence: gmailEvidence(
            gmail.limits,
            gmail.subject,
            gmail.scopes,
            "limits",
          ),
          healthEvidence: gmailEvidence(
            gmail.health,
            gmail.subject,
            gmail.scopes,
            "health",
          ),
          usageObservation:
            gmail.usageAt && gmail.usageExpires
              ? {
                  observedAt: gmail.usageAt.toISOString(),
                  expiresAt: gmail.usageExpires.toISOString(),
                }
              : null,
        });
      }
      const usableRuntime =
        runtime && runtime.binding.replyTo === founder.email ? runtime : null;
      if (usableRuntime) {
        const resendRows = await tx<
          { id: string; sender: string; ramp: number }[]
        >`
          select i.id, i.subject_email as sender, c.ramp
          from growth.integration_connections i
          join growth.outreach_account_controls c on c.connection_id=i.id and c.provider='resend'
          where i.provider='resend' and i.subject_email=${usableRuntime.binding.sender}
            and c.resend_team=${usableRuntime.binding.team} and c.resend_environment=${usableRuntime.binding.environment}
          limit 1
        `;
        const resend = resendRows[0];
        if (resend) {
          const readiness = await loadResendAccountReadiness(
            tx,
            resend.id,
            usableRuntime,
            "active",
          );
          accounts.push({
            id: resend.id,
            provider: "resend",
            sender: resend.sender,
            selectable: readiness.status === "ready",
            readiness:
              readiness.status === "ready" ? { status: "ready" } : readiness,
            recordedRamp: resend.ramp,
            limitsEvidence: null,
            healthEvidence: null,
            usageObservation: null,
          });
        }
      }
      return {
        status: "ready",
        accounts,
        resendConfiguration: usableRuntime ? "available" : "unknown",
      };
    });
  } catch {
    return { status: "unavailable" };
  }
}
