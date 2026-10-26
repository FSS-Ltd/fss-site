"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { subscribeCrmChanges } from "@/lib/growth/crm/change-events";
export function CrmReconciliation(): null {
  const router = useRouter();
  useEffect(
    () =>
      subscribeCrmChanges({
        surface: window,
        visibilitySurface: document,
        visible: () => document.visibilityState === "visible",
        refresh: () => router.refresh(),
        openChannel: (receive) => {
          if (typeof BroadcastChannel === "undefined") return null;
          try {
            const channel = new BroadcastChannel("growth-crm");
            channel.addEventListener("message", receive);
            return {
              close: () => {
                channel.removeEventListener("message", receive);
                channel.close();
              },
            };
          } catch {
            return null;
          }
        },
      }),
    [router],
  );
  return null;
}
