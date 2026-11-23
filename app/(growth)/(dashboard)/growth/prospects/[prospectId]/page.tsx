import {
  RecordWorkspace,
  parseWorkspaceQuery,
} from "@/components/growth/crm/record-workspace";
import { notFound } from "next/navigation";

import { CampaignReview } from "@/components/growth/prospects/campaign-review";
import { requireFounder } from "@/lib/growth/auth/require-founder";
import { getProspectCampaignOutcomes } from "@/lib/growth/dashboard/prospect-campaign-outcomes";
import { getProspectCampaign } from "@/lib/growth/dashboard/prospect-campaign";
import { ProspectDetailView } from "@/components/growth/prospects/prospect-detail";
import styles from "@/components/growth/prospects/prospects.module.css";
import { getIntegrationHealthSummary } from "@/lib/growth/dashboard/integration-health";
import { getProspectDetail } from "@/lib/growth/dashboard/prospect-detail";

type ProspectDetailPageProps = {
  params: Promise<{ prospectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProspectDetailPage({
  params,
  searchParams,
}: ProspectDetailPageProps) {
  const founder = await requireFounder();
  const { prospectId } = await params;
  const now = new Date().toISOString();
  const [result, integrations, outcomes] = await Promise.all([
    getProspectDetail(prospectId),
    getIntegrationHealthSummary(),
    getProspectCampaignOutcomes(prospectId, founder),
  ]);

  if (result.status === "not_found") {
    notFound();
  }

  if (result.status === "error") {
    return (
      <div className={styles.errorState} role="alert">
        <p>{result.message}</p>
        <p className={styles.errorCorrelation}>
          Reference: {result.correlationId}
        </p>
      </div>
    );
  }

  const campaignReview = await getProspectCampaign(
    prospectId,
    result.data.version,
    founder,
  );

  return (
    <ProspectDetailView
      integrations={integrations}
      now={now}
      prospect={result.data}
      workspace={
        <>
          <CampaignReview
            result={campaignReview}
            outcomes={outcomes}
            prospectId={result.data.id}
            version={result.data.version}
            contact={result.data.contact}
          />
          <RecordWorkspace
            prospectId={result.data.id}
            basePath={`/growth/prospects/${prospectId}`}
            query={parseWorkspaceQuery(await searchParams)}
          />
        </>
      }
    />
  );
}
