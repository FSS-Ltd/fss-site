"use client";

import { useRef, useState } from "react";
import type {
  ActionResult,
  RequestAction,
  RequestActionInput,
} from "./actions";

export function useRequestAction(
  action: RequestAction,
  onRefresh: () => void,
): {
  pending: boolean;
  result: ActionResult | null;
  message: string;
  run: (
    command: RequestActionInput,
    successMessage: string,
  ) => Promise<boolean>;
} {
  const locked = useRef(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [message, setMessage] = useState("");
  async function run(
    command: RequestActionInput,
    successMessage: string,
  ): Promise<boolean> {
    if (locked.current) return false;
    locked.current = true;
    setPending(true);
    setResult(null);
    setMessage("");
    try {
      const next = await action(command);
      setResult(next);
      setMessage(next.ok ? successMessage : next.error);
      if (next.ok) onRefresh();
      return next.ok;
    } catch {
      setMessage(
        "We could not save this. Your draft is still here. Try again.",
      );
      return false;
    } finally {
      locked.current = false;
      setPending(false);
    }
  }
  return { pending, result, message, run };
}
