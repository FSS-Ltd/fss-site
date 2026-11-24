import {
  FounderAuthorizationError,
  type FounderSession,
} from "../auth/require-founder";
import { readRequestHasRegisteredOrigin } from "../http/founder-request";
import { subscribeFacebookChanges } from "./events";

type Subscription = typeof subscribeFacebookChanges;
type Dependencies = {
  origin: string;
  authorizeFounder: () => Promise<FounderSession>;
  deadline: (request: Request) => Promise<number | null>;
  eventUrl: () => string | undefined;
  subscribe?: Subscription;
};

export function createGrowthEventHandler(
  deps: Dependencies,
): (request: Request) => Promise<Response> {
  return async (request) => {
    if (!readRequestHasRegisteredOrigin(request, deps.origin))
      return new Response(null, { status: 400 });
    try {
      const params = new URL(request.url).searchParams;
      const topics = params.getAll("topic");
      if (
        [...params.keys()].some((key) => key !== "topic") ||
        topics.length > 1 ||
        (topics[0] && topics[0] !== "daily-summary")
      )
        return new Response(null, { status: 400 });
      const topic = topics[0] === "daily-summary" ? "daily-summary" : "audit";
      await deps.authorizeFounder();
      const deadline = await deps.deadline(request);
      if (deadline === null || deadline <= Date.now())
        return new Response(null, { status: 401 });
      const url = deps.eventUrl();
      if (!url)
        return new Response("event: unconfigured\ndata: {}\n\n", {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-store",
          },
        });
      const encoder = new TextEncoder();
      const subscriptionState: { close?: () => Promise<void> } = {};
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      let controller: ReadableStreamDefaultController<Uint8Array>;
      let resolveClosed: () => void = () => undefined;
      const closedPromise = new Promise<"closed">((resolve) => {
        resolveClosed = () => resolve("closed");
      });
      const close = () => {
        if (closed) return;
        closed = true;
        resolveClosed();
        if (timer) clearTimeout(timer);
        if (heartbeat) clearInterval(heartbeat);
        request.signal.removeEventListener("abort", close);
        void subscriptionState.close?.().catch(() => undefined);
        try {
          controller.close();
        } catch {
          /* Already cancelled. */
        }
      };
      const stream = new ReadableStream<Uint8Array>(
        {
          start(c) {
            controller = c;
          },
          cancel() {
            close();
          },
        },
        { highWaterMark: 64 },
      );
      const send = (event: string, data: string) => {
        if (closed) return;
        if (Date.now() >= deadline) {
          close();
          return;
        }
        if ((controller.desiredSize ?? 0) <= 0) {
          close();
          return;
        }
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${data}\n\n`),
        );
      };
      request.signal.addEventListener("abort", close, { once: true });
      const timer = setTimeout(close, Math.max(0, deadline - Date.now()));
      if (request.signal.aborted || Date.now() >= deadline) close();
      if (!closed) {
        let subscription: Awaited<ReturnType<Subscription>> | "closed";
        try {
          const pending = (deps.subscribe ?? subscribeFacebookChanges)(
            url,
            {
              ready: () => send("ready", "{}"),
              change: (id) => {
                if (topic === "daily-summary" && id === "changed")
                  send("change", "{}");
                else if (
                  topic === "audit" &&
                  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
                    id,
                  )
                )
                  send("change", id);
              },
            },
            topic,
          ).then((subscription) => {
            if (subscription.status === "listening") {
              if (closed) void subscription.close().catch(() => undefined);
              else subscriptionState.close = subscription.close;
            }
            return subscription;
          });
          subscription = await Promise.race([pending, closedPromise]);
        } catch (error) {
          close();
          throw error;
        }
        if (
          subscription !== "closed" &&
          subscription.status === "unconfigured"
        ) {
          close();
          return new Response(null, {
            status: 503,
            headers: { "X-Growth-Events": "unconfigured" },
          });
        }
        if (!closed)
          heartbeat = setInterval(() => send("heartbeat", "{}"), 25_000);
      }
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
        },
      });
    } catch (error) {
      return new Response(null, {
        status: error instanceof FounderAuthorizationError ? 401 : 503,
      });
    }
  };
}
