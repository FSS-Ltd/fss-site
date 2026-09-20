import styles from "./portal-ui.module.css";

export type NoticeTone = "info" | "success" | "warning" | "error";

export type NoticeProps = Readonly<{
  tone: NoticeTone;
  children: React.ReactNode;
  action?: React.ReactNode;
}>;

const toneLabels: Record<NoticeTone, string> = {
  info: "Information",
  success: "Success",
  warning: "Warning",
  error: "Error",
};

const toneClassNames: Record<NoticeTone, string> = {
  info: styles.noticeInfo,
  success: styles.noticeSuccess,
  warning: styles.noticeWarning,
  error: styles.noticeError,
};

export function Notice({
  action,
  children,
  tone,
}: NoticeProps): React.JSX.Element {
  const role = tone === "warning" || tone === "error" ? "alert" : "status";

  return (
    <section className={`${styles.notice} ${toneClassNames[tone]}`} role={role}>
      <p className={styles.noticeTitle}>{toneLabels[tone]}</p>
      <div className={styles.noticeBody}>{children}</div>
      {action ? <div className={styles.noticeAction}>{action}</div> : null}
    </section>
  );
}
