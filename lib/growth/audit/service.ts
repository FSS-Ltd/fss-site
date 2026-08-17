import type { GrowthQueryExecutor } from "../db/types";

export type AuditMetadata = {
  approved?: boolean;
  fitScore?: number;
  reasonCode?: string | null;
};

export type AuditInput = {
  correlationId: string;
  actorType: "founder" | "agent" | "cron" | "provider" | "system";
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: AuditMetadata;
};

const REASON_CODE_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

function validateAuditMetadata(
  metadata: AuditInput["metadata"],
): AuditMetadata {
  if (metadata === undefined) return {};

  if (
    metadata === null ||
    Array.isArray(metadata) ||
    (Object.getPrototypeOf(metadata) !== Object.prototype &&
      Object.getPrototypeOf(metadata) !== null)
  ) {
    throw new TypeError("Audit metadata must be a plain object");
  }

  const validated: AuditMetadata = {};

  for (const [key, value] of Object.entries(metadata)) {
    switch (key) {
      case "approved":
        if (typeof value !== "boolean") break;
        validated.approved = value;
        continue;
      case "fitScore":
        if (
          typeof value !== "number" ||
          !Number.isInteger(value) ||
          value < 0 ||
          value > 100
        ) {
          break;
        }
        validated.fitScore = value;
        continue;
      case "reasonCode":
        if (
          value !== null &&
          (typeof value !== "string" ||
            value.length > 64 ||
            !REASON_CODE_PATTERN.test(value))
        ) {
          break;
        }
        validated.reasonCode = value;
        continue;
      default:
        throw new TypeError(`Audit metadata key "${key}" is not allowed`);
    }

    throw new TypeError(`Audit metadata value for "${key}" is invalid`);
  }

  return validated;
}

export async function appendAuditEvent(
  db: GrowthQueryExecutor,
  input: AuditInput,
): Promise<void> {
  const metadata = validateAuditMetadata(input.metadata);

  await db`
    insert into growth.audit_log (
      correlation_id, actor_type, actor_id, action,
      entity_type, entity_id, metadata
    ) values (
      ${input.correlationId},
      ${input.actorType},
      ${input.actorId},
      ${input.action},
      ${input.entityType},
      ${input.entityId},
      ${JSON.stringify(metadata)}::jsonb
    )
  `;
}
