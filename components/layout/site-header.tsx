import Link from "next/link";
import { SiteHeaderNavigation } from "./site-header-controls";
import styles from "./site-header.module.css";

export function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-90 border-b border-border-soft bg-background">
      <a href="#main-content" className={styles.skip}>
        Skip to content
      </a>
      <div className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between gap-2 px-4 py-2.5 sm:gap-5 sm:px-6">
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
            className="h-auto w-[59px]"
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
