"use client";

import { useState } from "react";
import {
  isPortalAppearance,
  PORTAL_APPEARANCE_COOKIE,
  type PortalAppearance,
} from "@/lib/operations/design/portal-appearance";
import styles from "./portal-shell.module.css";

export function PortalAppearanceControl({
  initialAppearance,
}: Readonly<{ initialAppearance: PortalAppearance }>): React.JSX.Element {
  const [appearance, setAppearance] = useState(initialAppearance);

  function changeAppearance(value: string): void {
    if (!isPortalAppearance(value)) return;
    const next: PortalAppearance = value;
    setAppearance(next);
    document
      .querySelector(".portal-theme")
      ?.setAttribute("data-appearance", next);
    document.cookie = `${PORTAL_APPEARANCE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  }

  return (
    <label className={styles.appearanceControl}>
      <span className={styles.visuallyHidden}>Colour appearance</span>
      <select
        aria-label="Colour appearance"
        onChange={(event) => changeAppearance(event.currentTarget.value)}
        value={appearance}
      >
        <option value="system">System appearance</option>
        <option value="light">Light appearance</option>
        <option value="dark">Dark appearance</option>
      </select>
    </label>
  );
}
