import { randomUUID } from "node:crypto";
import { PortalAccessDenied } from "../auth/types";
import { hasPortalCapability } from "../auth/permissions";
import { getPortalIdentity } from "../auth/server";
import {
  portalAuthConfigured,
  resolvePortalOrigin,
} from "../auth/configuration";
import { portalUrl } from "../auth/portal-url";
import { getPortalDb, withPortalTransaction } from "../db/portal-client";
import { readBillingConfiguration } from "../billing/configuration";
import { createOperationsBillingClient } from "../billing/client";
import { hostedBillingProvider } from "../billing/portal-session";
import { createPortalBillingHandler } from "./billing-handler";
import { executePortalBillingCommand } from "./billing-access";

export function portalBillingRoute(): (request: Request) => Promise<Response> {
  const origin = resolvePortalOrigin();
  return createPortalBillingHandler({
    enabled:
      process.env.OPERATIONS_ENABLED === "true" &&
      process.env.OPERATIONS_BILLING_ENABLED === "true",
    configured: portalAuthConfigured(),
    origin,
    createCorrelationId: randomUUID,
    getIdentity: getPortalIdentity,
    consumeRateLimit: (identity, organisationId, correlationId) =>
      withPortalTransaction(
        getPortalDb(),
        identity,
        organisationId,
        correlationId,
        async (tx, context) => {
          if (!hasPortalCapability(context.role, "billing.read"))
            throw new PortalAccessDenied();
          const [row] = await tx<
            { allowed: boolean }[]
          >`select operations.consume_billing_limit(${organisationId}) as allowed`;
          return row.allowed;
        },
      ),
    execute: async (identity, command, correlationId) => {
      const configuration = readBillingConfiguration();
      if (!configuration.enabled) throw new Error("Billing is disabled.");
      const stripe = await createOperationsBillingClient();
      if (!stripe) throw new Error("Billing is disabled.");
      return executePortalBillingCommand(
        getPortalDb(),
        identity,
        {
          organisationId: command.organisationId,
          accountId: configuration.accountId,
          mode: configuration.mode,
        },
        command,
        hostedBillingProvider(stripe),
        process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID,
        portalUrl(
          `/billing?organisationId=${encodeURIComponent(command.organisationId)}`,
          origin,
        ).href,
        correlationId,
        stripe,
      );
    },
    reportUnexpectedError: (report) =>
      console.error("Portal billing action failed.", report),
  });
}
