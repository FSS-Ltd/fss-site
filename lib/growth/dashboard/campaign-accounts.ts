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
  control: {
    state: "paused" | "active" | "halted";
    version: number;
    ramp: 25 | 50 | 100 | 150;
    prerequisites: { status: "ready" } | { status: "held"; reason: string };
    advance: {
      next: 50 | 100 | 150;
      readiness: { status: "ready" } | { status: "held"; reason: string };
    } | null;
  } | null;
  limitsEvidence: { observedAt: string; expiresAt: string } | null;
  healthEvidence: { observedAt: string; expiresAt: string } | null;
  usageObservation: { observedAt: string; expiresAt: string } | null;
};
export type CampaignAccountsResult =
  | {
      status: "ready";
      accounts: CampaignAccount[];
      resendConfiguration: "available" | "unknown";
      resendSetup:
        | { status: "available"; sender: string; expectedVersion: number }
        | { status: "held"; reason: string };
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
type ControlRow = {
  state: string | null;
  controlVersion: number | null;
  ramp: number | null;
  lastRampAt: Date | null;
};
function controlFields(row: ControlRow) {
  if (
    (row.state !== "paused" &&
      row.state !== "active" &&
      row.state !== "halted") ||
    !row.controlVersion ||
    !Number.isSafeInteger(row.controlVersion) ||
    row.controlVersion < 1 ||
    ![25, 50, 100, 150].includes(row.ramp ?? 0)
  )
    return null;
  const state: "paused" | "active" | "halted" = row.state;
  const ramp = z
    .union([z.literal(25), z.literal(50), z.literal(100), z.literal(150)])
    .parse(row.ramp);
  return {
    state,
    version: row.controlVersion,
    ramp,
    lastRampAt: row.lastRampAt,
  };
}
function nextRamp(ramp: 25 | 50 | 100 | 150): 50 | 100 | 150 | null {
  return ramp === 25 ? 50 : ramp === 50 ? 100 : ramp === 100 ? 150 : null;
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
          state: string | null;
          controlVersion: number | null;
          lastRampAt: Date | null;
          limits: unknown;
          health: unknown;
          usageAt: Date | null;
          usageExpires: Date | null;
        }[]
      >`
        select i.id, i.subject_email as sender, i.status, i.google_subject as subject,
          i.granted_scopes as scopes, c.ramp,c.state,c.version as "controlVersion",c.last_ramp_at as "lastRampAt", l.evidence as limits, h.evidence as health,
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
        const known = controlFields(gmail);
        const prerequisites = known
          ? await loadConfiguredAccountReadiness(tx, gmail.id, "prerequisites")
          : null;
        const next = known?.state === "active" ? nextRamp(known.ramp) : null;
        const advanceReadiness =
          next && known?.lastRampAt
            ? await loadConfiguredAccountReadiness(
                tx,
                gmail.id,
                "prerequisites",
                known.lastRampAt,
              )
            : null;
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
          control:
            known && prerequisites
              ? {
                  state: known.state,
                  version: known.version,
                  ramp: known.ramp,
                  prerequisites,
                  advance: next
                    ? {
                        next,
                        readiness: advanceReadiness ?? {
                          status: "held",
                          reason: "ramp_history_unknown",
                        },
                      }
                    : null,
                }
              : null,
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
      let resendSetup: Extract<
        CampaignAccountsResult,
        { status: "ready" }
      >["resendSetup"] = { status: "held", reason: "runtime_binding_unknown" };
      if (
        usableRuntime &&
        usableRuntime.binding.webhookGeneration &&
        !usableRuntime.webhookSecret
      ) {
        resendSetup = { status: "held", reason: "webhook_secret_unknown" };
      } else if (usableRuntime) {
        const resendRows = await tx<
          {
            id: string;
            sender: string;
            ramp: number | null;
            state: string | null;
            controlVersion: number | null;
            lastRampAt: Date | null;
            provider: string | null;
            team: string | null;
            environment: string | null;
          }[]
        >`
          select i.id,i.subject_email as sender,c.ramp,c.state,c.version as "controlVersion",c.last_ramp_at as "lastRampAt",c.provider,c.resend_team as team,c.resend_environment as environment
          from growth.integration_connections i left join growth.outreach_account_controls c on c.connection_id=i.id
          where i.provider='resend' and i.subject_email=${usableRuntime.binding.sender} limit 1`;
        const resend = resendRows[0];
        const matching =
          !resend ||
          resend.provider === null ||
          (resend.provider === "resend" &&
            resend.team === usableRuntime.binding.team &&
            resend.environment === usableRuntime.binding.environment);
        if (matching)
          resendSetup = {
            status: "available",
            sender: usableRuntime.binding.sender,
            expectedVersion: resend?.controlVersion ?? 0,
          };
        else
          resendSetup = { status: "held", reason: "existing_binding_differs" };
        const known = resend && matching ? controlFields(resend) : null;
        if (resend && known && resend.provider === "resend") {
          const readiness = await loadResendAccountReadiness(
            tx,
            resend.id,
            usableRuntime,
            "active",
          );
          const prerequisites = await loadResendAccountReadiness(
            tx,
            resend.id,
            usableRuntime,
            "prerequisites",
          );
          const next = known.state === "active" ? nextRamp(known.ramp) : null;
          const advanceReadiness =
            prerequisites.status === "held"
              ? prerequisites
              : !known.lastRampAt ||
                  prerequisites.healthObservedFrom <= known.lastRampAt
                ? { status: "held" as const, reason: "health_review_reused" }
                : { status: "ready" as const };
          accounts.push({
            id: resend.id,
            provider: "resend",
            sender: resend.sender,
            selectable: readiness.status === "ready",
            readiness:
              readiness.status === "ready" ? { status: "ready" } : readiness,
            recordedRamp: resend.ramp,
            control: {
              state: known.state,
              version: known.version,
              ramp: known.ramp,
              prerequisites:
                prerequisites.status === "ready"
                  ? { status: "ready" }
                  : prerequisites,
              advance: next ? { next, readiness: advanceReadiness } : null,
            },
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
        resendSetup,
      };
    });
  } catch {
    return { status: "unavailable" };
  }
}
