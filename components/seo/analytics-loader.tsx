import { AnalyticsConsentController } from "@/components/seo/analytics-consent";

export function AnalyticsLoader() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  if (!measurementId) {
    return null;
  }

  return <AnalyticsConsentController measurementId={measurementId} />;
}
