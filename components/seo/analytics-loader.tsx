"use client";

import { usePathname } from "next/navigation";

import { GoogleAnalytics } from "@/components/seo/google-analytics";

function isHighIntentRoute(pathname: string | null) {
  if (!pathname) {
    return false;
  }

  return pathname === "/contact" || pathname.endsWith("/thank-you");
}

export function AnalyticsLoader() {
  const pathname = usePathname();
  const strategy = isHighIntentRoute(pathname) ? "afterInteractive" : "lazyOnload";

  return <GoogleAnalytics strategy={strategy} />;
}
