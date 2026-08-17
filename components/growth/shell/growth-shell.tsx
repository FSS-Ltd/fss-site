"use client";

import { usePathname } from "next/navigation";

import { SideNavigation } from "./side-navigation";
import styles from "./shell.module.css";
import { TopNavigation } from "./top-navigation";
import type { GrowthShellFrameProps } from "./types";

export function GrowthShellFrame({
  children,
  founder,
  integrations,
  pathname,
}: GrowthShellFrameProps) {
  const navigationProps = { founder, integrations, pathname };

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#growth-main">
        Skip to dashboard content
      </a>
      <TopNavigation {...navigationProps} />
      <SideNavigation pathname={pathname} />
      <main className={styles.main} id="growth-main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}

export function GrowthShell(props: Omit<GrowthShellFrameProps, "pathname">) {
  const pathname = usePathname();
  return <GrowthShellFrame {...props} pathname={pathname} />;
}
