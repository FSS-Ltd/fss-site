"use client";
import { useEffect } from "react";
import { useCrmRefresh } from "./crm-refresh-provider";
import { subscribeCrmChanges } from "@/lib/growth/crm/change-events";
export function CrmReconciliation(): null {
  const { refresh } = useCrmRefresh();
  useEffect(
    () =>
      subscribeCrmChanges({
        surface: window,
        visibilitySurface: document,
        visible: () => document.visibilityState === "visible",
        refresh,
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
    [refresh],
  );
  return null;
}
