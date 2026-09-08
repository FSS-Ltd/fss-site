"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { JourneyCommandResult } from "@/lib/operations/onboarding/command-types";
export function useJourneyCommand(organisationId: string) {
  const router = useRouter();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(
    command: unknown,
  ): Promise<JourneyCommandResult | null> {
    if (busy.current) return null;
    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/growth/operations/clients/${organisationId}/journey`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(command),
        },
      );
      const result: JourneyCommandResult & { message?: string } =
        await response.json();
      if (!response.ok) {
        setMessage(result.message ?? "The journey could not be updated.");
        return null;
      }
      if ("journeyId" in result) {
        setMessage("Saved.");
        router.refresh();
      }
      return result;
    } catch {
      setMessage(
        "We could not confirm the result. Refresh the journey before trying again.",
      );
      return null;
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return { pending, message, submit };
}
