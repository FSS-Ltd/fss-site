"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import {
  GROWTH_NAVIGATION_ITEMS,
  getActiveGrowthNavigationItem,
} from "@/lib/growth/dashboard/navigation";

import { signOutFounder } from "./actions";
import { IntegrationStatusMenu } from "./integration-status-menu";
import {
  createMobileDialogController,
  type MobileDialogController,
} from "./mobile-dialog-controller";
import { NavigationIcon } from "./navigation-icon";
import styles from "./shell.module.css";
import type { ShellNavigationProps } from "./types";

const primaryItems = GROWTH_NAVIGATION_ITEMS.slice(0, 4);

export function MobileNavigation({
  founder,
  integrations,
  pathname,
}: ShellNavigationProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const controllerRef = useRef<MobileDialogController>(null);
  const previousPathnameRef = useRef(pathname);
  const activeItem = getActiveGrowthNavigationItem(pathname);
  const isDialogRoute =
    activeItem !== null &&
    !primaryItems.some((item) => item.href === activeItem.href);

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = triggerRef.current;
    if (!dialog || !trigger) return;

    const controller = createMobileDialogController({
      bodyStyle: document.body.style,
      dialog,
      mediaQuery: window.matchMedia("(max-width: 767px)"),
      trigger,
    });
    controllerRef.current = controller;

    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (previousPathnameRef.current === pathname) return;
    previousPathnameRef.current = pathname;
    controllerRef.current?.close({ restoreFocus: false });
  }, [pathname]);

  return (
    <>
      <nav aria-label="Mobile dashboard" className={styles.mobileNav}>
        {primaryItems.map((item) => (
          <Link
            aria-current={activeItem?.href === item.href ? "page" : undefined}
            className={styles.mobileNavLink}
            href={item.href}
            key={item.href}
          >
            <NavigationIcon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        ))}
        <button
          aria-current={isDialogRoute ? "page" : undefined}
          aria-haspopup="dialog"
          className={styles.mobileNavLink}
          onClick={() => controllerRef.current?.open()}
          ref={triggerRef}
          type="button"
        >
          <Menu aria-hidden="true" size={21} strokeWidth={1.8} />
          <span>More</span>
        </button>
      </nav>

      <dialog
        aria-labelledby="growth-mobile-menu-title"
        className={styles.mobileDialog}
        onCancel={(event) => {
          event.preventDefault();
          controllerRef.current?.close();
        }}
        ref={dialogRef}
      >
        <div className={styles.mobileDialogHeader}>
          <div>
            <p className={styles.mobileDialogEyebrow}>Founder workspace</p>
            <h2 id="growth-mobile-menu-title">Navigation</h2>
          </div>
          <button
            aria-label="Close navigation"
            className={styles.iconButton}
            onClick={() => controllerRef.current?.close()}
            type="button"
          >
            <X aria-hidden="true" size={22} />
          </button>
        </div>

        <div className={styles.mobileDialogLinks}>
          {GROWTH_NAVIGATION_ITEMS.map((item) => (
            <Link
              aria-current={activeItem?.href === item.href ? "page" : undefined}
              className={styles.mobileDialogLink}
              href={item.href}
              key={item.href}
              onClick={() =>
                controllerRef.current?.close({ restoreFocus: false })
              }
            >
              <NavigationIcon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>

        <div className={styles.mobileAccount}>
          <span className={styles.mobileAccountLabel}>Signed in as</span>
          <strong>{founder.email}</strong>
          <IntegrationStatusMenu integrations={integrations} />
          <form action={signOutFounder}>
            <button className={styles.signOutButton} type="submit">
              Sign out
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}
