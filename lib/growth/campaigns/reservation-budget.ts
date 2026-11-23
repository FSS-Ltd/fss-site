export type ReservationBudgetInput = {
  globalUsed: number;
  accountUsed: number;
  campaignUsed: number | null;
  accountRamp: number;
  sharedRamp: number;
  campaignCeiling: number | null;
  messages: number;
  recipients: number;
  messageLimit: number;
  recipientLimits: readonly [number, number, number, number];
  perMessage: number;
  messageReserve: number;
  recipientReserve: number;
  providerIds: readonly string[];
  outstanding: readonly {
    state: "reserved" | "submitting" | "uncertain" | "accepted";
    providerId: string | null;
    recipientCount: number;
  }[];
  recipientCount: number;
};

export function assessReservationBudget(
  input: ReservationBudgetInput,
):
  | "ready"
  | "invalid_budget"
  | "global_limit"
  | "account_limit"
  | "campaign_limit"
  | "recipient_limit"
  | "provider_limit" {
  const counts = [
    input.globalUsed,
    input.accountUsed,
    input.messages,
    input.recipients,
    input.recipientReserve,
  ];
  const positive = [
    input.accountRamp,
    input.sharedRamp,
    input.messageLimit,
    ...input.recipientLimits,
    input.perMessage,
    input.recipientCount,
    ...input.outstanding.map((item) => item.recipientCount),
  ];
  if (
    counts.some((n) => !Number.isSafeInteger(n) || n < 0) ||
    positive.some((n) => !Number.isSafeInteger(n) || n <= 0) ||
    ![25, 50, 100, 150].includes(input.accountRamp) ||
    ![25, 50, 100, 150].includes(input.sharedRamp) ||
    input.sharedRamp < input.accountRamp ||
    (input.campaignCeiling !== null &&
      ![25, 50, 100, 150].includes(input.campaignCeiling)) ||
    !Number.isSafeInteger(input.messageReserve) ||
    input.messageReserve < 50 ||
    (input.campaignUsed !== null &&
      (!Number.isSafeInteger(input.campaignUsed) || input.campaignUsed < 0)) ||
    (input.campaignCeiling !== null &&
      (!Number.isSafeInteger(input.campaignCeiling) ||
        input.campaignCeiling <= 0)) ||
    (input.campaignUsed === null) !== (input.campaignCeiling === null)
  )
    return "invalid_budget";
  if (input.globalUsed >= input.sharedRamp) return "global_limit";
  if (input.accountUsed >= input.accountRamp) return "account_limit";
  if (
    input.campaignUsed !== null &&
    input.campaignCeiling !== null &&
    input.campaignUsed >= input.campaignCeiling
  )
    return "campaign_limit";
  if (input.recipientCount > input.perMessage) return "recipient_limit";
  const ids = new Set(input.providerIds);
  const pending = input.outstanding.filter(
    (item) =>
      item.state !== "accepted" ||
      !item.providerId ||
      !ids.has(item.providerId),
  );
  const totalRecipients = pending.reduce(
    (sum, item) => sum + item.recipientCount,
    input.recipients + input.recipientCount,
  );
  if (
    !Number.isSafeInteger(totalRecipients) ||
    input.messages + pending.length + 1 + input.messageReserve >
      input.messageLimit ||
    totalRecipients + input.recipientReserve >
      Math.min(...input.recipientLimits)
  )
    return "provider_limit";
  return "ready";
}
