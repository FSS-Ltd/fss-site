import Image from "next/image";
import styles from "./home-story.module.css";

const chapters = [
  {
    label: "01 / THE FOUNDATION",
    title: "Custom software. Shaped around your people.",
    copy: "Portals and operational systems built around the way your organisation actually works.",
  },
  {
    label: "02 / THE CONNECTION",
    title: "Connected workflows. Less repeated work.",
    copy: "Bring your tools, teams and information together, with clear review and exception handling.",
  },
  {
    label: "03 / THE OUTCOME",
    title: "Your mission. Supported by better systems.",
    copy: "From the first workflow to the finished interface. Practical software for the people who care for others.",
  },
] as const;

const values = [
  {
    title: "Built around your mission.",
    copy: "Software should support the work you exist to do, not make your people work around it.",
  },
  {
    title: "Less admin. More time for people.",
    copy: "Take repeated tasks off your team's plate. Make room for the work that needs a person.",
  },
  {
    title: "One connected view. Fewer loose ends.",
    copy: "Bring people, information and next steps together, so your team knows what needs attention.",
  },
  {
    title: "Clearer information. More confident decisions.",
    copy: "Give the right people the context they need, with access and oversight built in.",
  },
  {
    title: "Your team, supported. Your mission, moving.",
    copy: "Practical systems that fit your organisation today and can develop as your needs change.",
  },
] as const;

export function HomeValueStory() {
  return (
    <section
      className={`${styles.story} ${styles.values}`}
      data-motion-story="values"
      aria-label="What better software makes possible"
    >
      <div className={styles.stage} data-story-stage>
        <canvas
          data-hero-canvas
          data-value-particles
          className="pointer-events-none absolute inset-0 h-full w-full opacity-70"
          aria-hidden="true"
        />
        <div className={`${styles.chapters} relative z-10`} data-story-chapters>
          {values.map((value, index) => (
            <article
              className={styles.chapter}
              data-story-chapter={index}
              data-motion-reveal="mask"
              key={value.title}
            >
              <p className={styles.label}>
                WHAT BETTER SOFTWARE MAKES POSSIBLE · 0{index + 1} / 05
              </p>
              <h2>{value.title}</h2>
              <p>{value.copy}</p>
            </article>
          ))}
        </div>
        <div className={styles.progress} data-story-progress aria-hidden="true">
          <span />
        </div>
      </div>
    </section>
  );
}

export function HomeStory() {
  return (
    <section
      className={styles.story}
      data-motion-story
      aria-label="From operational problem to working software"
    >
      <div className={styles.stage} data-story-stage>
        <div className={styles.chapters} data-story-chapters>
          {chapters.map((chapter, index) => (
            <article
              className={styles.chapter}
              data-story-chapter={index}
              data-motion-reveal="mask"
              key={chapter.label}
            >
              <p className={styles.label}>{chapter.label}</p>
              <h2>{chapter.title}</h2>
              <p>{chapter.copy}</p>
            </article>
          ))}
        </div>
        <div className={styles.visual} data-story-visual aria-hidden="true">
          <div className={styles.orbit}>
            <i />
            <i />
            <i />
          </div>
          <div className={styles.device} data-story-device>
            <div className={styles.underlay} />
            <svg
              className={styles.blueprint}
              data-story-blueprint
              viewBox="0 0 1000 585"
              fill="none"
            >
              <rect x="1" y="1" width="998" height="583" rx="16" />
              <path d="M180 0v585M180 65h820M0 65h180M35 100h108M35 145h108M35 190h108M35 235h108M35 280h108M35 500h108" />
              {[0, 1, 2, 3].map((n) => (
                <rect
                  key={n}
                  x={215 + n * 190}
                  y="102"
                  width="168"
                  height="98"
                  rx="9"
                />
              ))}
              <rect x="215" y="235" width="735" height="305" rx="9" />
              {[0, 1, 2, 3, 4].map((n) => (
                <path key={n} d={`M240 ${280 + n * 49}h682`} />
              ))}
              <path d="M415 255v265M680 255v265M805 255v265" />
            </svg>
            <Image
              className={styles.finished}
              data-story-finished
              src="/redesign/products/admin-dashboard.png"
              alt=""
              width={4112}
              height={2406}
              sizes="(max-width: 900px) 90vw, 58vw"
            />
            <div className={styles.particleEdge} data-story-particles />
          </div>
          <p className={styles.caption}>
            FSS / SYSTEMS · WORKFLOW → WIREFRAME → WORKING SOFTWARE{" "}
            <span>NEXSTEPS / BUILT BY FSS</span>
          </p>
        </div>
        <div className={styles.progress} data-story-progress aria-hidden="true">
          <span />
        </div>
      </div>
    </section>
  );
}
