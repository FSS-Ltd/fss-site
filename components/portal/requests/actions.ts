import { z } from "zod";
import type {
  createRequestSchema,
  portalRequestCommandSchema,
} from "@/lib/operations/requests/validation";

export type CreateRequestInput = z.input<typeof createRequestSchema>;
type PortalCommand = z.input<typeof portalRequestCommandSchema>;
export type RequestActionInput = PortalCommand extends infer C
  ? C extends PortalCommand
    ? Omit<C, "requestId">
    : never
  : never;
export type ActionResult =
  | { ok: true; request: { id: string; version: number } }
  | {
      ok: false;
      error: string;
      conflict: boolean;
      fields?: Record<string, string>;
    };
export type CreateRequestAction = (
  input: CreateRequestInput,
) => Promise<ActionResult>;
export type RequestAction = (
  input: RequestActionInput,
) => Promise<ActionResult>;

export const requestActionResponseSchema = z.object({
  request: z.object({ id: z.uuid(), version: z.number().int().positive() }),
});
export const requestActionErrorSchema = z.object({
  error: z.string(),
  fields: z.record(z.string(), z.string()).optional(),
});

export async function postRequestCommand(
  url: string,
  organisationId: string,
  command: CreateRequestInput | RequestActionInput,
): Promise<ActionResult> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organisationId, command }),
    });
    const body: unknown = await response.json().catch(() => null);
    if (response.ok) {
      const result = requestActionResponseSchema.safeParse(body);
      if (result.success) return { ok: true, request: result.data.request };
      return {
        ok: false,
        conflict: false,
        error:
          "We could not confirm the update. Your draft is still here. Try again.",
      };
    }
    const result = requestActionErrorSchema.safeParse(body);
    return {
      ok: false,
      conflict: response.status === 409,
      error:
        response.status === 409
          ? "This request has changed. Refresh its details before trying again. Your draft will stay here."
          : result.success
            ? result.data.error
            : "We could not save this. Your draft is still here. Try again.",
      ...(result.success && result.data.fields
        ? { fields: result.data.fields }
        : {}),
    };
  } catch {
    return {
      ok: false,
      conflict: false,
      error:
        "We could not connect. Your draft is still here. Check your connection and try again.",
    };
  }
}
