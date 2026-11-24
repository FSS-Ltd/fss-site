import type { GrowthTransaction } from "../db/types";
import type { AuthorityBounds } from "./authority-bounds";
import type { SendWindow } from "./dispatch-authority";

export function authorityGate(
  tx: GrowthTransaction,
  day: string,
  bounds: AuthorityBounds,
  window: SendWindow | null,
) {
  const localWindow = window
    ? tx`extract(isodow from (at at time zone ${window.timezone})) = any(${tx.array(window.weekdays)}::int[])
      and (at at time zone ${window.timezone})::time >= ${window.start}::time
      and (at at time zone ${window.timezone})::time < ${window.end}::time`
    : tx`true`;
  return tx`transition_clock as materialized (select clock_timestamp() as at),
    authority_gate as materialized (
      select at, (at at time zone 'Europe/London')::date = ${day}::date as day_ok,
        (at >= ${bounds.validatedAt} and at < ${bounds.expiresAt}
          and (${bounds.validThrough}::timestamptz is null or at <= ${bounds.validThrough}::timestamptz)) as interval_ok,
        (${localWindow}) as window_ok
      from transition_clock
    )`;
}

export type GateResult = {
  dayOk: boolean;
  intervalOk: boolean;
  windowOk: boolean;
  writes: number;
};
export function gateFailure(gate: GateResult | undefined): string | null {
  if (!gate) throw new Error("authority_gate_missing");
  if (!gate.dayOk) return "day_changed";
  if (!gate.intervalOk) return "authority_expired";
  if (!gate.windowOk) return "outside_window";
  return null;
}
