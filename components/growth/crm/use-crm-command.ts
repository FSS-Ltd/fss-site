"use client";
import { useState } from "react";
import { useCrmRefresh } from "./crm-refresh-provider";
import { z } from "zod";
import { publishCrmChange } from "@/lib/growth/crm/change-events";
import {
  crmCommandSchema,
  type CrmCommand,
  type CrmCommandResult,
} from "@/lib/growth/crm/schemas";

const resultSchema = z.union([
  z.object({
    prospectId: z.uuid(),
    recordId: z.uuid().optional(),
    alreadyExisted: z.boolean().optional(),
  }),
  z.object({ recordId: z.uuid(), alreadyExisted: z.boolean().optional() }),
]);
export function useCrmCommand() {
  const [saving, setBusy] = useState(false);
  const shared = useCrmRefresh();
  const busy = saving || shared.busy;
  const [feedback, setFeedback] = useState<{
    error: boolean;
    message: string;
    href?: string;
  } | null>(null);
  async function run(command: CrmCommand): Promise<CrmCommandResult | null> {
    if (busy) return null;
    setBusy(true);
    shared.beginCommand();
    setFeedback(null);
    try {
      const parsed = crmCommandSchema.safeParse(command);
      if (!parsed.success) {
        setFeedback({
          error: true,
          message: parsed.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join(" "),
        });
        return null;
      }
      const target =
        "prospectId" in command
          ? command.prospectId
          : "viewId" in command
            ? command.viewId
            : command.requestId;
      const response = await fetch(`/api/growth/crm/${target}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const error = z.object({ message: z.string() }).safeParse(body);
        const location = response.headers.get("location");
        setFeedback({
          error: true,
          message: error.success
            ? error.data.message
            : "Could not save. Try again.",
          href:
            location && /^\/growth\/prospects\/[a-f0-9-]{36}$/.test(location)
              ? location
              : undefined,
        });
        return null;
      }
      const result = resultSchema.safeParse(body);
      if (!result.success) throw new Error("Invalid response");
      setFeedback({ error: false, message: "Saved." });
      publishCrmChange();
      return result.data;
    } catch {
      setFeedback({
        error: true,
        message: "Could not save. Check your connection and try again.",
      });
      return null;
    } finally {
      setBusy(false);
      shared.endCommand();
    }
  }
  function report(message: string) {
    setFeedback({ error: true, message });
  }
  return { busy, saving, feedback, run, report };
}
