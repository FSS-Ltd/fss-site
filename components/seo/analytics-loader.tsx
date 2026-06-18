import { GoogleAnalytics } from "@/components/seo/google-analytics";

export function AnalyticsLoader() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  if (!measurementId) {
    return null;
  }

  return <GoogleAnalytics measurementId={measurementId} strategy="lazyOnload" />;
}
