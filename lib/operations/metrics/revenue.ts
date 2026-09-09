export type ServiceTerm = {
  id: string;
  organisationId: string;
  netPence: bigint;
  recurrenceMonths: 0 | 1 | 3 | 12;
  startDate: string;
  endDate: string | null;
  activatedDate: string | null;
  pauses: readonly {
    startDate: string;
    endDate: string | null;
    billable: boolean;
  }[];
  discounts: readonly { startDate: string; endDate: string; pence: bigint }[];
};
export function serviceMrr(term: ServiceTerm, date: string): bigint {
  if (
    !term.recurrenceMonths ||
    !term.activatedDate ||
    term.activatedDate > date ||
    term.startDate > date ||
    (term.endDate !== null && term.endDate < date)
  )
    return BigInt(0);
  if (
    term.pauses.some(
      (p) =>
        !p.billable &&
        p.startDate <= date &&
        (p.endDate === null || p.endDate >= date),
    )
  )
    return BigInt(0);
  const discount = term.discounts
    .filter((d) => d.startDate <= date && d.endDate >= date)
    .reduce((sum, d) => sum + d.pence, BigInt(0));
  if (
    discount > term.netPence ||
    discount < BigInt(0) ||
    term.netPence < BigInt(0)
  )
    throw new Error("Invalid contracted discount.");
  return (
    (term.netPence - discount) * (BigInt(12) / BigInt(term.recurrenceMonths))
  );
}
export function awaitingActivationMrr(term: ServiceTerm, date: string): bigint {
  return (!term.activatedDate || term.activatedDate > date) &&
    term.recurrenceMonths > 0 &&
    (term.endDate === null || term.endDate >= date)
    ? term.netPence * (BigInt(12) / BigInt(term.recurrenceMonths))
    : BigInt(0);
}
export function clientMrr(
  terms: readonly ServiceTerm[],
  date: string,
): Map<string, bigint> {
  const clients = new Map<string, bigint>();
  for (const term of terms)
    clients.set(
      term.organisationId,
      (clients.get(term.organisationId) ?? BigInt(0)) + serviceMrr(term, date),
    );
  return clients;
}
export type CashPayment = {
  id: string;
  state: string;
  receivedPence: bigint;
  confirmedAt: string | null;
};
export function collectedCash(
  payments: readonly CashPayment[],
  start: string,
  end: string,
): bigint {
  const unique = new Map(payments.map((payment) => [payment.id, payment]));
  return [...unique.values()].reduce(
    (sum, p) =>
      sum +
      (p.state === "succeeded" &&
      p.confirmedAt &&
      Date.parse(p.confirmedAt) >= Date.parse(start) &&
      Date.parse(p.confirmedAt) < Date.parse(end)
        ? p.receivedPence
        : BigInt(0)),
    BigInt(0),
  );
}
