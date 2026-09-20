import Link from "next/link";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import styles from "@/components/portal/projects.module.css";
import { getPortalPageContext } from "@/lib/operations/auth/page-context";
import { portalPath } from "@/lib/operations/auth/portal-url";

export const dynamic = "force-dynamic";

export default async function HelpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const context = await getPortalPageContext(
    (await searchParams).organisationId,
  );
  if (!context) return <PortalUnavailable />;
  return (
    <div className={styles.page}>
      <Link className={styles.breadcrumb} href={portalPath("/portal")}>
        Your workspace
      </Link>
      <p className={styles.eyebrow}>Support</p>
      <h1 className={styles.title}>Help</h1>
      <p className={styles.copy}>
        Use your agreed FSS contact for delivery questions, changes to work, or
        anything that needs a prompt decision.
      </p>
      <section className={styles.overview} aria-labelledby="help-steps-heading">
        <h2 id="help-steps-heading">Where to start</h2>
        <ul className={styles.deliverables}>
          <li>Use Requests for new work, feedback, and review responses.</li>
          <li>
            Use Documents for files that FSS has cleared for your workspace.
          </li>
          <li>Use Billing for invoices and payment details when available.</li>
        </ul>
        <p className={styles.copy}>
          For access support, email{" "}
          <a
            className={styles.breadcrumb}
            href="mailto:hello@faithfulsoftware.dev"
          >
            hello@faithfulsoftware.dev
          </a>
          . Include your organisation name, but never include payment details or
          confidential files in an email.
        </p>
      </section>
    </div>
  );
}
