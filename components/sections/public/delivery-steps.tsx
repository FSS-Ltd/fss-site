import styles from "./public-page.module.css";

export function DeliverySteps() {
  return (
    <section className={styles.section} aria-labelledby="delivery-title">
      <h2 id="delivery-title">
        A clear path from problem to working software.
      </h2>
      <ol className={styles.steps}>
        <li>
          <h3>Understand and scope</h3>
          <p>
            Map the people, workflows and constraints. Agree what success looks
            like before committing to a build.
          </p>
        </li>
        <li>
          <h3>Build and review</h3>
          <p>
            Work through a defined scope with working updates, explicit
            decisions and review points for your team.
          </p>
        </li>
        <li>
          <h3>Launch and hand over</h3>
          <p>
            Plan migration, testing, documentation and support so the software
            can be operated and maintained.
          </p>
        </li>
      </ol>
    </section>
  );
}
