import Image from "next/image";

const sitemapLinks = [
  { label: "Services", href: "/services" },
  { label: "Work", href: "/#work" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
] as const;

export function SiteFooter() {
  return (
    <footer
      style={{
        background: "#07182e",
        color: "#9fb1c6",
        padding: "clamp(56px,7vw,84px) 28px 36px",
        borderTop: "1px solid rgba(255,255,255,.07)",
      }}
    >
      <div style={{ maxWidth: "1180px", margin: "0 auto" }}>
        <div
          data-foot-grid
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr 1fr",
            gap: "40px",
            paddingBottom: "48px",
            borderBottom: "1px solid rgba(255,255,255,.08)",
          }}
        >
          <div style={{ maxWidth: "340px" }}>
            <Image
              alt="FSS"
              height={316}
              src="/redesign/brand/fss-monogram-white.png"
              style={{
                height: "34px",
                width: "auto",
                display: "block",
                marginBottom: "20px",
              }}
              width={709}
            />
            <p style={{ margin: 0, fontSize: "14.5px", lineHeight: 1.6 }}>
              Engineering clarity out of complexity. Bespoke software, apps and
              private AI — built faithfully, in the UK.
            </p>
            <a
              href="mailto:info@faithfulsoftware.dev"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "9px",
                marginTop: "22px",
                fontSize: "14.5px",
                fontWeight: 500,
                color: "#e9eef5",
                borderBottom: "1px solid rgba(255,255,255,.2)",
                paddingBottom: "3px",
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "#14989e",
                }}
              />
              info@faithfulsoftware.dev
            </a>
          </div>

          <div>
            <p
              style={{
                margin: "0 0 18px",
                fontFamily: "'Geist Mono','JetBrains Mono',monospace",
                fontSize: "11px",
                letterSpacing: ".14em",
                color: "#5d7088",
              }}
            >
              SITEMAP
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "13px",
                fontSize: "14.5px",
              }}
            >
              {sitemapLinks.map((item) => (
                <a
                  data-foot
                  href={item.href}
                  key={item.href}
                  style={{ transition: "color .2s" }}
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>

          <div>
            <p
              style={{
                margin: "0 0 18px",
                fontFamily: "'Geist Mono','JetBrains Mono',monospace",
                fontSize: "11px",
                letterSpacing: ".14em",
                color: "#5d7088",
              }}
            >
              CONNECT
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "13px",
                fontSize: "14.5px",
              }}
            >
              <a
                href="https://www.linkedin.com/company/faithful-software-solutions-ltd"
                data-foot
                style={{ transition: "color .2s" }}
              >
                LinkedIn ↗
              </a>
              <a href="/contact" data-foot style={{ transition: "color .2s" }}>
                Start a project
              </a>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "20px",
            flexWrap: "wrap",
            paddingTop: "26px",
          }}
        >
          <span style={{ fontSize: "13px", color: "#5d7088" }}>
            © 2026 Faithful Software Solutions Ltd. All rights reserved.
          </span>
          <span
            style={{
              fontFamily: "'Geist Mono','JetBrains Mono',monospace",
              fontSize: "11px",
              letterSpacing: ".1em",
              color: "#5d7088",
            }}
          >
            FAITHFUL · SOFTWARE · SOLUTIONS
          </span>
        </div>
      </div>
    </footer>
  );
}
