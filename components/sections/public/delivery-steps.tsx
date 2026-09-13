import styles from "./public-page.module.css";

export function DeliverySteps() {
  return (
    <section
      className={styles.section}
      aria-labelledby="delivery-title"
      data-motion-reveal="mask"
    >
      <h2 id="delivery-title">
        A clear path from problem to working software.
      </h2>
      <svg
        data-process-svg
        aria-hidden="true"
        viewBox="0 0 1000 20"
        preserveAspectRatio="none"
        style={{ width: "100%", height: 20, overflow: "visible" }}
      >
        <line
          data-process-line
          x1="0"
          y1="10"
          x2="1000"
          y2="10"
          stroke="#14989e"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <ol className={styles.steps}>
        <li data-motion-reveal="left">
          <h3>Understand and scope</h3>
          <p>
            Map the people, workflows and constraints. Agree what success looks
            like before committing to a build.
          </p>
        </li>
        <li data-motion-reveal="up">
          <h3>Build and review</h3>
          <p>
            Work through a defined scope with working updates, explicit
            decisions and review points for your team.
          </p>
        </li>
        <li data-motion-reveal="right">
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
