import { ratio, type Ratio } from "./definitions";
export type Movements = {
  start: bigint;
  new: bigint;
  expansion: bigint;
  reactivation: bigint;
  contraction: bigint;
  churn: bigint;
  end: bigint;
};
export function retention(
  start: ReadonlyMap<string, bigint>,
  end: ReadonlyMap<string, bigint>,
): {
  logoRetention: Ratio;
  logoChurn: Ratio;
  grossRevenueRetention: Ratio;
  netRevenueRetention: Ratio;
} {
  const cohort = [...start].filter(([, value]) => value > BigInt(0));
  let retained = BigInt(0),
    startMrr = BigInt(0),
    cappedEnd = BigInt(0),
    cohortEnd = BigInt(0);
  for (const [id, value] of cohort) {
    const finish = end.get(id) ?? BigInt(0);
    if (finish > BigInt(0)) retained++;
    startMrr += value;
    cappedEnd += finish < value ? finish : value;
    cohortEnd += finish;
  }
  return {
    logoRetention: ratio(retained, BigInt(cohort.length)),
    logoChurn: ratio(BigInt(cohort.length) - retained, BigInt(cohort.length)),
    grossRevenueRetention: ratio(cappedEnd, startMrr),
    netRevenueRetention: ratio(cohortEnd, startMrr),
  };
}
/** Net period movements per client. Earlier activity distinguishes reactivation from new. */
export function movements(
  start: ReadonlyMap<string, bigint>,
  end: ReadonlyMap<string, bigint>,
  previouslyActive: ReadonlySet<string>,
): Movements {
  const result: Movements = {
    start: BigInt(0),
    new: BigInt(0),
    expansion: BigInt(0),
    reactivation: BigInt(0),
    contraction: BigInt(0),
    churn: BigInt(0),
    end: BigInt(0),
  };
  for (const id of new Set([...start.keys(), ...end.keys()])) {
    const before = start.get(id) ?? BigInt(0),
      after = end.get(id) ?? BigInt(0);
    if (before < BigInt(0) || after < BigInt(0))
      throw new Error("MRR cannot be negative.");
    result.start += before;
    result.end += after;
    if (before === BigInt(0) && after > BigInt(0))
      result[previouslyActive.has(id) ? "reactivation" : "new"] += after;
    else if (before > BigInt(0) && after === BigInt(0)) result.churn += before;
    else if (after > before) result.expansion += after - before;
    else result.contraction += before - after;
  }
  if (
    result.start +
      result.new +
      result.expansion +
      result.reactivation -
      result.contraction -
      result.churn !==
    result.end
  )
    throw new Error("MRR movement identity failed.");
  return result;
}
