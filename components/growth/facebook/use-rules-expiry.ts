"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Destination } from "./types";

const MAX_TIMEOUT = 2_147_483_647;
export function useRulesExpiry(
  rows: Destination[],
  invalidate: () => void,
): number {
  const [now, setNow] = useState(() => Date.now());
  const attempted = useRef(new Set<string>());
  const deadlines = useMemo(
    () =>
      rows.flatMap((row) =>
        row.postReadiness === "allowed" && row.review
          ? [
              {
                key: `${row.id}:${row.review.id}:${row.review.expiresAt}`,
                at: Date.parse(row.review.expiresAt),
              },
            ]
          : [],
      ),
    [rows],
  );
  useEffect(() => {
    const currentKeys = new Set(deadlines.map(({ key }) => key));
    for (const key of attempted.current)
      if (!currentKeys.has(key)) attempted.current.delete(key);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      const current = Date.now();
      const next = deadlines
        .filter(({ key }) => !attempted.current.has(key))
        .sort((a, b) => a.at - b.at)[0];
      if (!next) return;
      const delay = Math.min(MAX_TIMEOUT, Math.max(0, next.at - current));
      timer = setTimeout(() => {
        const time = Date.now();
        setNow(time);
        const due = deadlines.filter(
          ({ key, at }) => at <= time && !attempted.current.has(key),
        );
        if (due.length) {
          due.forEach(({ key }) => attempted.current.add(key));
          invalidate();
        }
        schedule();
      }, delay);
    };
    const foreground = () => {
      if (document.visibilityState !== "visible") return;
      const time = Date.now();
      setNow(time);
      if (deadlines.some(({ at }) => at <= time)) invalidate();
    };
    schedule();
    document.addEventListener("visibilitychange", foreground);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", foreground);
    };
  }, [deadlines, invalidate]);
  return now;
}
