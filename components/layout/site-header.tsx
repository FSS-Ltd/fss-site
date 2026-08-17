import Link from "next/link";

import {
  SiteHeaderActions,
  SiteHeaderNav,
} from "@/components/layout/site-header-controls";
import { navItems } from "@/components/layout/site-header-nav-items";

export function SiteHeader() {
  return (
    <header
      data-header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 90,
        background: "rgba(242,243,245,0.55)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid transparent",
        transition: "background .4s,border-color .4s,box-shadow .4s",
      }}
    >
      <div
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "0 28px",
          height: "72px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "24px",
        }}
      >
        <Link
          href="/"
          prefetch={false}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "13px",
            flex: "none",
          }}
        >
          {/* The dedicated 256px asset keeps the displayed logo crisp without
              loading the client-side Next Image runtime. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="FSS"
            decoding="async"
            fetchPriority="high"
            height={114}
            loading="eager"
            src="/redesign/brand/fss-monogram-navy-small.png"
            style={{ height: "26px", width: "auto", display: "block" }}
            width={256}
          />
          <span
            data-wordmark
            style={{ display: "none", alignItems: "center", gap: "8px" }}
          >
            <span
              style={{
                width: "1px",
                height: "20px",
                background: "rgba(10,26,46,.18)",
              }}
            />
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: ".16em",
                color: "#33455c",
              }}
            >
              FAITHFUL&nbsp;SOFTWARE&nbsp;SOLUTIONS
            </span>
          </span>
        </Link>

        <SiteHeaderNav />
        <SiteHeaderActions />
      </div>

      <div
        data-menu
        style={{
          display: "none",
          borderTop: "1px solid rgba(10,26,46,.08)",
          background: "rgba(242,243,245,.96)",
          backdropFilter: "blur(16px)",
        }}
      >
        <div
          style={{
            padding: "14px 28px",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
        >
          {navItems.map((item, index) => (
            <Link
              href={item.href}
              key={item.href}
              prefetch={false}
              style={{
                padding: "13px 4px",
                fontSize: "18px",
                fontWeight: 600,
                borderBottom:
                  index === navItems.length - 1
                    ? undefined
                    : "1px solid rgba(10,26,46,.06)",
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
