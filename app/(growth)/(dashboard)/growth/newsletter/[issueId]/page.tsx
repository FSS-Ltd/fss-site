import { notFound } from "next/navigation";

import { IssueReview } from "@/components/growth/newsletter/issue-review";
import styles from "@/components/growth/newsletter/newsletter.module.css";
import { getNewsletterIssueReview } from "@/lib/growth/dashboard/newsletter";

type NewsletterIssuePageProps = {
  params: Promise<{ issueId: string }>;
};

export default async function NewsletterIssuePage({
  params,
}: NewsletterIssuePageProps) {
  const { issueId } = await params;
  const result = await getNewsletterIssueReview(issueId);

  if (result.status === "not_found") {
    notFound();
  }

  if (result.status === "error") {
    return (
      <div className={styles.errorState} role="alert">
        <p>{result.message}</p>
        <p className={styles.errorCorrelation}>Reference: {result.correlationId}</p>
      </div>
    );
  }

  return <IssueReview data={result.data} />;
}
