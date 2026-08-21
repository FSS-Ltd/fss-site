import { notFound } from "next/navigation";

import { SiteEmailReview } from "@/components/growth/newsletter/site-email-review";
import styles from "@/components/growth/newsletter/newsletter.module.css";
import {
  getEmailTemplateList,
  getEmailTemplateReview,
} from "@/lib/growth/dashboard/newsletter";

type EmailTemplatesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EmailTemplatesPage({
  searchParams,
}: EmailTemplatesPageProps) {
  const params = await searchParams;
  const requestedTemplateId =
    typeof params.templateId === "string" ? params.templateId : undefined;

  const listResult = await getEmailTemplateList();

  if (listResult.status === "error") {
    return (
      <div className={styles.errorState} role="alert">
        <p>{listResult.message}</p>
        <p className={styles.errorCorrelation}>
          Reference: {listResult.correlationId}
        </p>
      </div>
    );
  }

  if (listResult.rows.length === 0) {
    return (
      <div className={styles.card}>
        <p className={styles.emptyState}>No email templates are on file yet.</p>
      </div>
    );
  }

  const selectedId = requestedTemplateId ?? listResult.rows[0]!.templateId;
  const reviewResult = await getEmailTemplateReview(selectedId);

  if (reviewResult.status === "not_found") {
    notFound();
  }

  if (reviewResult.status === "error") {
    return (
      <div className={styles.errorState} role="alert">
        <p>{reviewResult.message}</p>
        <p className={styles.errorCorrelation}>
          Reference: {reviewResult.correlationId}
        </p>
      </div>
    );
  }

  return (
    <SiteEmailReview
      fromEmail={process.env.RESEND_FROM_EMAIL?.trim() || null}
      replyToEmail={process.env.RESEND_REPLY_TO_EMAIL?.trim() || null}
      selected={reviewResult.data}
      templates={listResult.rows}
    />
  );
}
