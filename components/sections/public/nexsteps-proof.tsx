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
          Hours of admin, turned into time with families.
        </h2>
        <ul className={styles.list}>
          <li>
            Problem: a learning centre needed complete school management
            software that understood the ACE system.
          </li>
          <li>Idea: FSS built NexSteps for that.</li>
          <li>
            Outcome: hours of admin became more time with the children and
            families.
          </li>
          <li>
            Direction: a platform that adapts to the systems a real school uses,
            rather than forcing them into an old way of doing things.
          </li>
        </ul>
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
