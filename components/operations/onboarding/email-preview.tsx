import type { ApprovedEmail } from "@/lib/operations/onboarding/types";
import styles from "../agreements/agreements.module.css";
export function EmailPreview({
  email,
}: {
  email: ApprovedEmail;
}): React.JSX.Element {
  return (
    <details>
      <summary>
        {email.subject} · {email.to}
      </summary>
      <dl className={styles.facts}>
        <div>
          <dt>From</dt>
          <dd>{email.from}</dd>
        </div>
        <div>
          <dt>Reply to</dt>
          <dd>{email.replyTo}</dd>
        </div>
        <div>
          <dt>Recipient</dt>
          <dd>{email.to}</dd>
        </div>
      </dl>
      <pre
        style={{
          whiteSpace: "pre-wrap",
          font: "inherit",
          overflowWrap: "anywhere",
        }}
      >
        {email.text}
      </pre>
      <details>
        <summary>HTML email</summary>
        <iframe
          title={`${email.subject} for ${email.to}`}
          srcDoc={email.html}
          sandbox=""
          referrerPolicy="no-referrer"
          style={{ width: "100%", height: 480, border: "1px solid #dce3e8" }}
        />
      </details>
    </details>
  );
}
