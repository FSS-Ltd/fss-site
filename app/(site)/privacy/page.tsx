import type { Metadata } from "next";

import styles from "./privacy.module.css";

export const metadata: Metadata = {
  title: "Privacy notice",
  description: "How Faithful Software Solutions Ltd handles personal data.",
  alternates: { canonical: "/privacy" },
};

const providers = [
  ["Vercel", "website hosting, deployment, logs and security"],
  ["Supabase", "database, authentication and encrypted application storage"],
  [
    "Google",
    "Google Workspace, sign-in, Gmail API and consent-based Google Analytics",
  ],
  ["Resend", "transactional and newsletter email delivery"],
  ["HubSpot", "customer relationship and enquiry management"],
] as const;

export default function PrivacyPage() {
  return (
    <article className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>PRIVACY NOTICE</p>
        <h1>How we handle personal data</h1>
        <p className={styles.intro}>
          This notice explains what Faithful Software Solutions Ltd collects,
          why we use it and the choices available to you.
        </p>
        <p className={styles.effective}>Effective 26 August 2026</p>
      </header>

      <div className={styles.content}>
        <section>
          <h2>Who is responsible</h2>
          <p>
            Faithful Software Solutions Ltd is the controller. We are registered
            in England and Wales under company number 16682725. Our registered
            office is 51 Hurst Road, Kennington, Ashford, England, TN24 9RS.
          </p>
          <p>
            Privacy questions can be sent to{" "}
            <a href="mailto:hello@faithfulsoftware.dev">
              hello@faithfulsoftware.dev
            </a>
            .
          </p>
        </section>

        <section>
          <h2>Information we use</h2>
          <p>We may process the following information:</p>
          <ul>
            <li>
              Details you submit through website enquiries, resource requests
              and project intake forms.
            </li>
            <li>
              Business correspondence, meeting notes, project records and
              service-delivery information.
            </li>
            <li>
              Account identity and security records when an authorised user
              signs in to Growth OS.
            </li>
            <li>
              Public corporate and business contact information used for
              relevant business-to-business research.
            </li>
            <li>
              Technical records such as IP address, browser data, security logs
              and your analytics preference.
            </li>
          </ul>
        </section>

        <section>
          <h2>Growth OS research and outreach</h2>
          <p>
            Growth OS helps us identify organisations that may have a relevant
            software need. Research is limited to public company evidence,
            public business contact details, professional roles and work email
            addresses. We record the evidence used, correspondence, delivery
            events and suppression decisions so that outreach is relevant and
            stops when requested.
          </p>
          <p>
            We rely on legitimate interests for proportionate corporate
            outreach. We consider the likely effect on the recipient, do not use
            sensitive personal data for targeting and provide a clear way to opt
            out. Suppression records are retained so an opt-out is respected.
          </p>
        </section>

        <section>
          <h2>Google sign-in and Gmail</h2>
          <p>
            Our private Growth OS requests the openid and email scopes for
            identity, plus https://www.googleapis.com/auth/gmail.modify for a
            dedicated company mailbox. Gmail data is used only to create and
            send founder-approved business email, reconcile sent mail, sync
            replies and bounces, and stop sequences when required.
          </p>
          <p>
            OAuth tokens are encrypted. We never sell Google user data, use it
            for advertising or use it for general-purpose AI training. Access is
            limited to the application functions described above.
          </p>
        </section>

        <section>
          <h2>Why we use information</h2>
          <ul>
            <li>
              Contract and pre-contract steps for enquiries, proposals and
              service delivery.
            </li>
            <li>
              Legitimate interests for proportionate corporate outreach, service
              improvement, fraud prevention and security.
            </li>
            <li>Consent for newsletters and non-essential analytics.</li>
            <li>
              Legal obligation and legitimate interests for accounting,
              compliance, audit and dispute records.
            </li>
          </ul>
        </section>

        <section>
          <h2>Cookies and analytics</h2>
          <p>
            Essential cookies and local storage support security, sign-in and
            remembering your privacy choice. We load Google Analytics only after
            you accept analytics. You can reject it without losing access to the
            site.
          </p>
          <p>
            Use Cookie settings in the site footer to change your choice and
            withdraw your consent. If analytics was active, we remove its
            cookies and reload the page without analytics.
          </p>
        </section>

        <section>
          <h2>Service providers and transfers</h2>
          <p>We use selected processors to operate our services:</p>
          <dl className={styles.providers}>
            {providers.map(([name, purpose]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>{purpose}</dd>
              </div>
            ))}
          </dl>
          <p>
            Some providers may process information outside the UK. Where this
            happens, we use an adequacy decision or approved contractual
            safeguards and apply access controls appropriate to the data.
          </p>
        </section>

        <section>
          <h2>Retention and security</h2>
          <p>
            We keep information only for as long as needed for the stated
            purpose, legal obligations, agreed service records or a live claim.
            Retention depends on the relationship, record type and risk. Access
            is restricted, credentials and OAuth tokens are protected, and
            sensitive operations are logged.
          </p>
        </section>

        <section>
          <h2>Your rights</h2>
          <p>
            Depending on the circumstances, you may ask for access, correction,
            deletion, restriction, portability or an objection to processing.
            You may withdraw consent at any time. Contact us using the address
            above and we will respond under applicable UK data-protection law.
          </p>
          <p>
            You can also complain to the Information Commissioner&apos;s Office
            at{" "}
            <a
              href="https://ico.org.uk/make-a-complaint/"
              rel="noreferrer"
              target="_blank"
            >
              ico.org.uk
            </a>
            .
          </p>
        </section>

        <section>
          <h2>Changes to this notice</h2>
          <p>
            We will update this page when our processing changes. Material
            changes will be dated and communicated where appropriate.
          </p>
        </section>
      </div>
    </article>
  );
}
