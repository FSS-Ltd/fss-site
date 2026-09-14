import Image from "next/image";
import styles from "./public-page.module.css";

type NexStepsProofProps = {
  className?: string;
  motionTrack?: boolean;
};

export function NexStepsProof({
  className,
  motionTrack = false,
}: NexStepsProofProps) {
  return (
    <section
      id="work"
      aria-labelledby="nexsteps-title"
      className={`${styles.proof} ${styles.grid} ${className ?? ""}`}
      data-motion-track={motionTrack || undefined}
      data-motion-reveal="mask"
    >
      <div>
        <div className={styles.eyebrow}>Our work · NexSteps</div>
        <h2 id="nexsteps-title">
          Software for the people who care for others.
        </h2>
        <p>
          NexSteps is an FSS-built safeguarding, attendance and operations
          platform for schools, churches and community organisations.
        </p>
        <ul className={styles.list}>
          <li>Role-scoped access and support portals</li>
          <li>Attendance and safeguarding handover logs</li>
          <li>Parent onboarding and billing workflows</li>
        </ul>
        <p>
          It brings the practical needs of faith and community settings into the
          software design.
        </p>
      </div>
      <figure>
        <Image
          src="/redesign/products/admin-dashboard.png"
          alt="NexSteps operations dashboard"
          width={4112}
          height={2406}
          sizes="(max-width: 680px) 90vw, 45vw"
          className="h-auto w-full rounded-xl border border-border-soft"
        />
        <figcaption className="mt-3 text-sm text-text-muted">
          NexSteps admin interface, built by FSS.
        </figcaption>
      </figure>
    </section>
  );
}
