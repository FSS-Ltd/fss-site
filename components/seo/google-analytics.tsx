"use client";

import Script from "next/script";

type GoogleAnalyticsProps = {
  measurementId?: string;
  strategy?: "afterInteractive" | "lazyOnload";
};

export function GoogleAnalytics({
  measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
  strategy = "lazyOnload",
}: GoogleAnalyticsProps) {
  if (!measurementId) {
    return null;
  }

  return (
    <>
      <Script
        id="google-analytics-loader"
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy={strategy}
      />
      <Script id="google-analytics-config" strategy={strategy}>
        {`if (!window.__fssGaInitialized) {
window.__fssGaInitialized = true;
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${measurementId}');
}`}
      </Script>
    </>
  );
}
