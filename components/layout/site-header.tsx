import Link from "next/link";
import { SiteHeaderNavigation } from "./site-header-controls";
import styles from "./site-header.module.css";

export function SiteHeader() {
  return (
    <header
      className="fixed inset-x-0 top-0 z-90 border-b border-border-soft bg-background"
      // A named header stays still while page content transitions under it.
      style={{ viewTransitionName: "site-header" }}
    >
      <a href="#main-content" className={styles.skip}>
        Skip to content
      </a>
      {/* Same gutter as public page content and the footer, so all left edges
          align; it eases down to 16px on the narrowest phones so the logo,
          call to action and menu do not crowd. */}
      <div
        className="flex min-h-[72px] items-center justify-between gap-2 py-2.5 sm:gap-5"
        style={{
          paddingInline:
            "max(clamp(16px, 7.5vw - 8px, 24px), calc((100% - 1120px) / 2))",
        }}
      >
        <Link
          href="/"
          prefetch={false}
          aria-label="Faithful Software Solutions home"
          className="inline-flex min-h-11 shrink-0 items-center gap-4"
        >
          {/* Small, pre-sized local brand asset avoids image runtime overhead. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/redesign/brand/fss-monogram-navy-small.png"
            alt="FSS"
            width={128}
            height={57}
            decoding="async"
            className="h-auto w-[59px] [filter:brightness(0)]"
          />
          <span className="hidden max-w-32 text-sm leading-tight font-semibold xl:block">
            Faithful Software Solutions
          </span>
        </Link>
        <SiteHeaderNavigation />
      </div>
    </header>
  );
}
