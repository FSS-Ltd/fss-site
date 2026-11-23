import { TZDateMini } from "@date-fns/tz";
import {
  campaignReportInputSchema,
  type CampaignReport,
  type CampaignReportInput,
} from "./schemas";
import { londonDayKey } from "./time";

function addLondonDays(date: Date, days: number): Date {
  const value = new TZDateMini(date.getTime(), "Europe/London");
  value.setDate(value.getDate() + days);
  return new Date(value.getTime());
}

function interval(successes: number, total: number): [number, number] | null {
  if (!total) return null;
  const z = 1.959963984540054;
  const proportion = successes / total;
  const denominator = 1 + (z * z) / total;
  const center = (proportion + (z * z) / (2 * total)) / denominator;
  const margin =
    (z *
      Math.sqrt(
        (proportion * (1 - proportion)) / total + (z * z) / (4 * total * total),
      )) /
    denominator;
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
}

export function buildCampaignReport(raw: CampaignReportInput): CampaignReport {
  const input = campaignReportInputSchema.parse(raw);
  if (input.anchor.observedAt > input.cutoff)
    throw new Error("invalid_report_cutoff");
  const members = new Map<string, CampaignReportInput["members"][number]>();
  const conflicts = new Set<string>();
  for (const member of input.members) {
    const previous = members.get(member.membershipId);
    if (previous && JSON.stringify(previous) !== JSON.stringify(member))
      conflicts.add(member.membershipId);
    else if (!previous) members.set(member.membershipId, member);
  }
  const evidence = new Map<string, { owner: string; value: string }>();
  const ambiguous = new Set<string>();
  for (const member of members.values()) {
    for (const item of [
      ...member.replies.map((reply) => ({
        key: `reply:${reply.id}`,
        value: reply,
      })),
      ...member.outcomes.flatMap((outcome) => [
        { key: `outcome:${outcome.outcomeId}`, value: outcome },
        { key: `source:${outcome.kind}:${outcome.evidenceId}`, value: outcome },
      ]),
    ]) {
      const value = JSON.stringify(item.value);
      const previous = evidence.get(item.key);
      if (
        previous &&
        (previous.owner !== member.membershipId || previous.value !== value)
      )
        ambiguous.add(item.key);
      else if (!previous)
        evidence.set(item.key, { owner: member.membershipId, value });
    }
  }
  const anchorMatches = [...members.values()].some(
    (member) =>
      !conflicts.has(member.membershipId) &&
      member.confirmation.basis === input.anchor.basis &&
      member.confirmation.observedAt.getTime() ===
        input.anchor.observedAt.getTime(),
  );
  const earlierConfirmation = [...members.values()].some(
    (member) => member.confirmation.observedAt < input.anchor.observedAt,
  );
  const groups = new Map<string, CampaignReport["groups"][number]>();
  const cohortStart = londonDayKey(input.anchor.observedAt);
  const cohortEnd = londonDayKey(addLondonDays(input.anchor.observedAt, 14));
  for (const member of members.values()) {
    if (conflicts.has(member.membershipId)) continue;
    const observed = member.confirmation.observedAt;
    if (observed > input.cutoff || londonDayKey(observed) < cohortStart)
      continue;
    const key = JSON.stringify([
      member.market,
      member.offer,
      member.policyVersion,
      member.variantId,
      member.variantVersion,
      member.cta,
      member.comparisonFingerprint,
      member.commercialTermsFingerprint,
      member.confirmation.basis,
    ]);
    let group = groups.get(key);
    if (!group) {
      group = {
        market: member.market,
        offer: member.offer,
        policyVersion: member.policyVersion,
        variantId: member.variantId,
        variantVersion: member.variantVersion,
        cta: member.cta,
        comparisonFingerprint: member.comparisonFingerprint,
        commercialTermsFingerprint: member.commercialTermsFingerprint,
        basis: member.confirmation.basis,
        mature: 0,
        censored: 0,
        later: 0,
        positiveReplies: 0,
        knownPositiveReplies: 0,
        preAnchorPositiveReplies: 0,
        unknownOriginPositiveReplies: 0,
        qualifiedMeetings: 0,
        unknownOriginMeetings: 0,
        meetingMature: 0,
        meetingUnknown: 0,
        meetingCensored: 0,
        paymentMature: 0,
        paymentUnknown: 0,
        paymentCensored: 0,
        paidConversions: 0,
        unknownOriginPayments: 0,
        missingReplies: 0,
        positiveReplyRate: null,
        interval: null,
      };
      groups.set(key, group);
    }
    if (londonDayKey(observed) >= cohortEnd) {
      group.later++;
      continue;
    }
    const end = addLondonDays(observed, 14);
    const origin = member.confirmation.possibleInvocationFrom;
    const validOrigin = origin !== null && origin <= observed;
    const hasAmbiguousReply = member.replies.some(
      (reply) =>
        ambiguous.has(`reply:${reply.id}`) ||
        (reply.occurredAt <= input.cutoff &&
          reply.occurredAt <= end &&
          (reply.recordedAt > input.cutoff ||
            reply.recordedAt < reply.occurredAt)),
    );
    const positive = member.replies.filter(
      (reply) =>
        !ambiguous.has(`reply:${reply.id}`) &&
        reply.reviewed &&
        reply.kind === "positive" &&
        reply.recordedAt >= reply.occurredAt &&
        reply.recordedAt <= input.cutoff &&
        reply.occurredAt <= input.cutoff &&
        reply.occurredAt <= end &&
        validOrigin &&
        reply.occurredAt >= origin,
    );
    if (positive.length) group.knownPositiveReplies++;
    if (
      !validOrigin &&
      member.replies.some(
        (reply) =>
          !ambiguous.has(`reply:${reply.id}`) &&
          reply.reviewed &&
          reply.kind === "positive" &&
          reply.recordedAt >= reply.occurredAt &&
          reply.recordedAt <= input.cutoff &&
          reply.occurredAt <= input.cutoff &&
          reply.occurredAt <= end,
      )
    )
      group.unknownOriginPositiveReplies++;
    if (positive.some((reply) => reply.occurredAt < observed))
      group.preAnchorPositiveReplies++;
    if (end > input.cutoff || member.replyCoverage === "censored")
      group.censored++;
    else if (
      member.replyCoverage !== "complete" ||
      !validOrigin ||
      hasAmbiguousReply
    )
      group.missingReplies++;
    else {
      group.mature++;
      if (positive.length) group.positiveReplies++;
    }
    const uncertainOutcome = (kind: "meeting" | "payment") =>
      member.outcomes.some(
        (outcome) =>
          outcome.kind === kind &&
          outcome.occurredAt <= input.cutoff &&
          (ambiguous.has(`outcome:${outcome.outcomeId}`) ||
            ambiguous.has(`source:${outcome.kind}:${outcome.evidenceId}`) ||
            outcome.recordedAt > input.cutoff ||
            outcome.recordedAt < outcome.occurredAt),
      );
    if (end > input.cutoff || member.meetingObservation === "censored")
      group.meetingCensored++;
    else if (
      member.meetingObservation === "unknown" ||
      uncertainOutcome("meeting")
    )
      group.meetingUnknown++;
    else group.meetingMature++;
    if (member.paymentObservation === "censored") group.paymentCensored++;
    else if (
      member.paymentObservation === "unknown" ||
      uncertainOutcome("payment")
    )
      group.paymentUnknown++;
    else group.paymentMature++;
    const knownOutcomes = member.outcomes.filter(
      (outcome) =>
        !ambiguous.has(`outcome:${outcome.outcomeId}`) &&
        !ambiguous.has(`source:${outcome.kind}:${outcome.evidenceId}`) &&
        outcome.membershipId === member.membershipId &&
        outcome.reviewed &&
        outcome.recordedAt >= outcome.occurredAt &&
        outcome.recordedAt <= input.cutoff &&
        outcome.occurredAt <= input.cutoff,
    );
    const outcomes = knownOutcomes.filter(
      (outcome) => validOrigin && outcome.occurredAt >= origin,
    );
    if (
      outcomes.some(
        (outcome) => outcome.kind === "meeting" && outcome.occurredAt <= end,
      )
    )
      group.qualifiedMeetings++;
    if (
      outcomes.some(
        (outcome) =>
          outcome.kind === "payment" && (outcome.netClearedPence ?? 0) > 0,
      )
    )
      group.paidConversions++;
    if (
      !validOrigin &&
      knownOutcomes.some(
        (outcome) => outcome.kind === "meeting" && outcome.occurredAt <= end,
      )
    )
      group.unknownOriginMeetings++;
    if (
      !validOrigin &&
      knownOutcomes.some(
        (outcome) =>
          outcome.kind === "payment" && (outcome.netClearedPence ?? 0) > 0,
      )
    )
      group.unknownOriginPayments++;
  }
  const values = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value);
  for (const group of values) {
    group.positiveReplyRate = group.mature
      ? group.positiveReplies / group.mature
      : null;
    group.interval = interval(group.positiveReplies, group.mature);
  }
  let winner: string | null = null;
  let winnerReason: CampaignReport["winnerReason"] = "insufficient_evidence";
  const identities = new Set(
    values.map((group) =>
      JSON.stringify([
        group.market,
        group.offer,
        group.policyVersion,
        group.variantVersion,
        group.comparisonFingerprint,
        group.commercialTermsFingerprint,
        group.basis,
      ]),
    ),
  );
  if (
    !anchorMatches ||
    earlierConfirmation ||
    conflicts.size ||
    ambiguous.size ||
    values.some(
      (group) =>
        group.comparisonFingerprint === null ||
        group.commercialTermsFingerprint === null,
    )
  )
    winnerReason = "unknown";
  else if (
    identities.size > 1 ||
    values.length > 2 ||
    (values.length === 2 &&
      (values[0].variantId === values[1].variantId ||
        values[0].cta === values[1].cta))
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
    anchor: input.anchor,
    cutoff: input.cutoff,
    groups: values,
    ambiguousEvidence: ambiguous.size + conflicts.size,
    winner,
    winnerReason,
  };
}
