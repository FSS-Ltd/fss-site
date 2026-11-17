import { TZDateMini } from "@date-fns/tz";
import type { CampaignReport, CampaignReportInput } from "./schemas";
import { londonDayKey } from "./time";

function addLondonDays(date: Date, days: number): Date {
  const d = new TZDateMini(date.getTime(), "Europe/London");
  d.setDate(d.getDate() + days);
  return new Date(d.getTime());
}
function interval(successes: number, n: number): [number, number] | null {
  if (!n) return null;
  const z = 1.959963984540054,
    p = successes / n,
    den = 1 + (z * z) / n,
    center = (p + (z * z) / (2 * n)) / den,
    margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / den;
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
}
export function buildCampaignReport(
  input: CampaignReportInput,
): CampaignReport {
  const groups = new Map<string, CampaignReport["groups"][number]>();
  const members = new Set<string>();
  const replies = new Set<string>();
  const outcomes = new Set<string>();
  const cohortEnd = londonDayKey(addLondonDays(input.firstSentAt, 14));
  for (const member of input.members) {
    if (
      members.has(member.membershipId) ||
      member.firstSentAt > input.cutoff ||
      londonDayKey(member.firstSentAt) < londonDayKey(input.firstSentAt)
    )
      continue;
    members.add(member.membershipId);
    const key = JSON.stringify([
      member.market,
      member.offer,
      member.policyVersion,
      member.variantId,
    ]);
    let group = groups.get(key);
    if (!group) {
      group = {
        market: member.market,
        offer: member.offer,
        policyVersion: member.policyVersion,
        variantId: member.variantId,
        mature: 0,
        censored: 0,
        later: 0,
        positiveReplies: 0,
        qualifiedMeetings: 0,
        meetingMature: 0,
        meetingUnknown: 0,
        meetingCensored: 0,
        paymentMature: 0,
        paymentUnknown: 0,
        paymentCensored: 0,
        paidConversions: 0,
        missingReplies: 0,
        positiveReplyRate: null,
        interval: null,
      };
      groups.set(key, group);
    }
    if (londonDayKey(member.firstSentAt) >= cohortEnd) {
      group.later++;
      continue;
    }
    const end = addLondonDays(member.firstSentAt, 14);
    if (end > input.cutoff) group.censored++;
    else if (!member.replyObservationComplete) group.missingReplies++;
    else {
      group.mature++;
      let positive = false;
      for (const reply of member.replies) {
        if (
          replies.has(reply.id) ||
          reply.occurredAt < member.firstSentAt ||
          reply.occurredAt > end
        )
          continue;
        replies.add(reply.id);
        if (reply.reviewed && reply.kind === "positive") positive = true;
      }
      if (positive) group.positiveReplies++;
    }
    if (end > input.cutoff || member.meetingObservation === "censored")
      group.meetingCensored++;
    else if (member.meetingObservation === "unknown") group.meetingUnknown++;
    else group.meetingMature++;
    if (member.paymentObservation === "censored") group.paymentCensored++;
    else if (member.paymentObservation === "unknown") group.paymentUnknown++;
    else group.paymentMature++;
    let meeting = false,
      paid = false;
    for (const outcome of member.outcomes) {
      if (
        outcomes.has(outcome.outcomeId) ||
        outcome.membershipId !== member.membershipId ||
        !outcome.reviewed ||
        outcome.occurredAt < member.firstSentAt ||
        outcome.occurredAt > input.cutoff
      )
        continue;
      outcomes.add(outcome.outcomeId);
      if (outcome.kind === "meeting" && outcome.occurredAt <= end)
        meeting = true;
      if (outcome.kind === "payment" && (outcome.netClearedPence ?? 0) > 0)
        paid = true;
    }
    if (meeting) group.qualifiedMeetings++;
    if (paid) group.paidConversions++;
  }
  for (const group of groups.values()) {
    group.positiveReplyRate = group.mature
      ? group.positiveReplies / group.mature
      : null;
    group.interval = interval(group.positiveReplies, group.mature);
  }
  const values = [...groups.values()];
  let winner: string | null = null;
  let winnerReason: CampaignReport["winnerReason"] = "insufficient_evidence";
  if (
    values.length > 2 ||
    (values.length === 2 &&
      (values[0].market !== values[1].market ||
        values[0].offer !== values[1].offer ||
        values[0].policyVersion !== values[1].policyVersion))
  )
    winnerReason = "confounded";
  else if (
    values.length === 2 &&
    values.every(
      (group) =>
        group.mature >= 30 &&
        group.interval !== null &&
        group.censored === 0 &&
        group.missingReplies === 0,
    )
  ) {
    const [a, b] = values;
    if (a.interval && b.interval && a.interval[0] > b.interval[1])
      winner = a.variantId;
    else if (a.interval && b.interval && b.interval[0] > a.interval[1])
      winner = b.variantId;
    if (winner) winnerReason = "clear_interval";
  }
  return {
    firstSentAt: input.firstSentAt,
    cutoff: input.cutoff,
    groups: values,
    winner,
    winnerReason,
  };
}
