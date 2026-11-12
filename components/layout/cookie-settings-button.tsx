"use client";

import { ANALYTICS_SETTINGS_EVENT } from "@/lib/analytics/consent";
import cta from "@/components/ui/cta-motion.module.css";

export function CookieSettingsButton() {
  return (
    <button
      className={cta.link}
      onClick={(event) =>
        window.dispatchEvent(
          new CustomEvent(ANALYTICS_SETTINGS_EVENT, {
            detail: { returnFocusTo: event.currentTarget },
          }),
        )
      }
      style={{
        border: 0,
        background: "transparent",
        padding: "4px 0",
        color: "#8aa0b8",
        fontSize: "13px",
        cursor: "pointer",
        textDecoration: "underline",
        textDecorationColor: "rgba(138,160,184,.45)",
        textUnderlineOffset: "3px",
      }}
      type="button"
    >
      Cookie settings
    </button>
  );
}
