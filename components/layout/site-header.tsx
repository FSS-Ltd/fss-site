"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Services", href: "/services", activePath: "/services" },
  { label: "Work", href: "/#work", activePath: "" },
  { label: "About", href: "/about", activePath: "/about" },
  { label: "Blog", href: "/blog", activePath: "/blog" },
  { label: "Contact", href: "/contact", activePath: "/contact" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const isContactPage = pathname === "/contact";

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
          <Image
            alt="FSS"
            height={316}
            priority
            src="/redesign/brand/fss-monogram-navy.png"
            style={{ height: "26px", width: "auto", display: "block" }}
            width={709}
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

        <nav
          aria-label="Primary"
          data-nav
          style={{ display: "flex", alignItems: "center", gap: "4px" }}
        >
          {navItems.map((item) => {
            const active =
              item.activePath !== "" && pathname === item.activePath;

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
            href={isContactPage ? "#fssroot" : "/contact"}
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
              {isContactPage ? "Email us" : "Start a project"}
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
