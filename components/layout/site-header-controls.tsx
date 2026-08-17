"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { navItems } from "@/components/layout/site-header-nav-items";

export function SiteHeaderNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      data-nav
      style={{ display: "flex", alignItems: "center", gap: "4px" }}
    >
      {navItems.map((item) => {
        const active = item.activePath !== "" && pathname === item.activePath;

        return (
          <Link
            data-navlink={active ? undefined : ""}
            href={item.href}
            key={item.href}
            prefetch={false}
            style={{
              padding: "9px 14px",
              fontSize: "14px",
              fontWeight: active ? 600 : 500,
              color: active ? "#0a1a2e" : "#41506a",
              borderRadius: "9px",
              display: active ? "inline-flex" : undefined,
              alignItems: active ? "center" : undefined,
              gap: active ? "7px" : undefined,
              transition: active ? undefined : "color .2s,background .2s",
            }}
          >
            {active && (
              <span
                style={{
                  width: "5px",
                  height: "5px",
                  borderRadius: "50%",
                  background: "#14989e",
                }}
              />
            )}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SiteHeaderActions() {
  const isStartPage = usePathname() === "/start";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        flex: "none",
      }}
    >
      <Link
        data-cta-head
        data-magnetic
        href={isStartPage ? "#fssroot" : "/start"}
        prefetch={false}
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          gap: "9px",
          padding: "11px 20px",
          borderRadius: "999px",
          background: "#0a1a2e",
          color: "#fff",
          fontSize: "14px",
          fontWeight: 600,
          transition:
            "transform .35s cubic-bezier(.2,.7,.2,1),background .25s",
        }}
      >
        <span
          data-mag-label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "9px",
            transition: "transform .35s cubic-bezier(.2,.7,.2,1)",
          }}
        >
          Start a project
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "#46c7d8",
              boxShadow: "0 0 0 4px rgba(70,199,216,.25)",
            }}
          />
        </span>
      </Link>

      <button
        aria-expanded="false"
        aria-label="Menu"
        data-menu-btn
        style={{
          display: "none",
          width: "44px",
          height: "44px",
          border: "1px solid rgba(10,26,46,.14)",
          background: "#fff",
          borderRadius: "11px",
          cursor: "pointer",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "4px",
        }}
        type="button"
      >
        <span
          style={{
            width: "16px",
            height: "1.6px",
            background: "#0a1a2e",
            display: "block",
          }}
        />
        <span
          style={{
            width: "16px",
            height: "1.6px",
            background: "#0a1a2e",
            display: "block",
          }}
        />
      </button>
    </div>
  );
}
