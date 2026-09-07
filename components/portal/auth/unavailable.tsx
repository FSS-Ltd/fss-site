import styles from "./portal.module.css";
export function PortalUnavailable(): React.JSX.Element {
  return (
    <section className={styles.card} aria-labelledby="portal-heading">
      <p className={styles.eyebrow}>Client portal</p>
      <h1 id="portal-heading" className={styles.heading}>
        Please try again later
      </h1>
      <p className={styles.copy}>
        The portal is temporarily unavailable. If you need help with your
        account, contact your FSS team.
      </p>
    </section>
  );
}
