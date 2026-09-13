import type { ReactNode } from "react";
import Image from "next/image";
import styles from "./app-journey.module.css";

const appImage = "/images/editorial/community-app-concept-v1.webp";

export function AppJourney({ children }: { children: ReactNode }) {
  return (
    <section
      className={styles.journey}
      data-motion-app
      aria-label="From services to a mobile app concept"
    >
      <div data-app-viewport>
        <div data-app-track>
          <div data-app-panel="services">{children}</div>
          <div className={styles.panel} data-app-panel="concept">
            <div className={styles.copy}>
              <p>FROM POSSIBILITY TO PRODUCT</p>
              <h2>
                A clearer day.
                <br />
                In the palm of your hand.
              </h2>
              <p>
                People, sessions and the next step. A connected experience built
                around the work your team needs to do.
              </p>
              <p className={styles.caption}>
                Illustrative app concept · AI-generated design
              </p>
            </div>
            <div className={styles.phone} data-app-phone aria-hidden="true">
              <svg
                className={styles.wire}
                data-app-wire
                viewBox="0 0 360 630"
                fill="none"
              >
                <rect x="1" y="1" width="358" height="628" rx="24" />
                <path d="M20 32h68M20 68h260M20 86h220" />
                <rect x="20" y="105" width="320" height="150" rx="12" />
                <rect x="20" y="270" width="153" height="66" rx="12" />
                <rect x="187" y="270" width="153" height="66" rx="12" />
                <path d="M20 363h180" />
                {[0, 1, 2].map((row) => (
                  <rect
                    key={row}
                    x="20"
                    y={380 + row * 42}
                    width="320"
                    height="36"
                    rx="8"
                  />
                ))}
                <rect x="20" y="520" width="320" height="52" rx="10" />
                <path d="M20 594h320" />
              </svg>
              <Image
                src={appImage}
                alt=""
                width={720}
                height={1260}
                className={styles.image}
                data-app-image
                sizes="(max-width: 900px) 80vw, 340px"
              />
              <canvas
                className={styles.atoms}
                data-app-atoms
                data-app-source={appImage}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
