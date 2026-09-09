import { z } from "zod";
import {
  readJsonRequestBody,
  requestHasRegisteredOrigin,
} from "../../growth/http/founder-request";
import type { OperationsFounder } from "../organisations/types";
export const metricPrivateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
export function createMetricExportHandler(deps: {
  enabled: boolean;
  origin: string;
  founder: () => Promise<OperationsFounder>;
  enqueue: (founder: OperationsFounder, filters: unknown) => Promise<string>;
  read: (
    founder: OperationsFounder,
    id: string,
    download: boolean,
  ) => Promise<{
    state: string;
    failure: string | null;
    csv: string | null;
  } | null>;
}) {
  return async (request: Request): Promise<Response> => {
    const reply = (data: object, status = 200) =>
      Response.json(data, { status, headers: metricPrivateHeaders });
    if (!deps.enabled) return reply({ error: "Exports unavailable." }, 404);
    if (
      request.method === "POST"
        ? !requestHasRegisteredOrigin(request, deps.origin)
        : new URL(request.url).origin !== deps.origin
    )
      return reply({ error: "Origin is not allowed." }, 403);
    let founder: OperationsFounder;
    try {
      founder = await deps.founder();
    } catch {
      return reply({ error: "Founder access required." }, 403);
    }
    try {
      if (request.method === "POST") {
        if (
          request.headers.get("content-type")?.split(";")[0] !==
          "application/json"
        )
          return reply({ error: "Send JSON." }, 415);
        const raw = await readJsonRequestBody(request, 4096);
        const command = z
          .strictObject({
            action: z.literal("request"),
            filters: z.record(z.string(), z.unknown()),
          })
          .parse(raw);
        return reply({ id: await deps.enqueue(founder, command.filters) }, 202);
      }
      const url = new URL(request.url),
        id = z.uuid().parse(url.searchParams.get("id")),
        download = url.searchParams.get("download") === "1";
      const job = await deps.read(founder, id, download);
      if (!job) return reply({ error: "Export not found." }, 404);
      if (download && job.csv !== null)
        return new Response(job.csv, {
          headers: {
            ...metricPrivateHeaders,
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition":
              'attachment; filename="operations-receivables.csv"',
          },
        });
      return reply({ state: job.state, failure: job.failure });
    } catch (error) {
      return reply(
        {
          error:
            error instanceof z.ZodError
              ? "Invalid export request."
              : "Export unavailable. Check filters and retry.",
        },
        error instanceof z.ZodError ? 400 : 503,
      );
    }
  };
}
