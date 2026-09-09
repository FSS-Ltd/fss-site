export type RenewalInput = {
  serviceInstanceId: string;
  agreementId: string;
  organisationId: string;
  renewalDate: string;
  noticeDeadline?: string | null;
};

export type RenewalWorkItem = RenewalInput & {
  kind: "renewal_60" | "renewal_30" | "renewal_14";
  dueDate: string;
};

function dateBefore(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function renewalWorkItems(input: RenewalInput): RenewalWorkItem[] {
  const notice = input.noticeDeadline ?? input.renewalDate;
  return ([60, 30, 14] as const).map((days) => ({
    ...input,
    kind: `renewal_${days}` as RenewalWorkItem["kind"],
    dueDate: dateBefore(notice, days),
  }));
}
