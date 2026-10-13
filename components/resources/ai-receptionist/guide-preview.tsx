"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowDownRight, Check } from "lucide-react";

import { guideChapters } from "./chapters";
import styles from "./guide-preview.module.css";

export function GuidePreview() {
  const steps = useRef<Array<HTMLLIElement | null>>([]);
  const [active, setActive] = useState(0);
  const [enhanced, setEnhanced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(
      "(min-width: 960px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)",
    );
    let observer: IntersectionObserver | undefined;

    const configure = () => {
      observer?.disconnect();
      const enabled = media.matches && "IntersectionObserver" in window;
      setEnhanced(enabled);
      if (!enabled) return;

      const visible = new Map<number, number>();
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const index = steps.current.findIndex(
              (step) => step === entry.target,
            );
            if (entry.isIntersecting)
              visible.set(index, entry.intersectionRatio);
            else visible.delete(index);
          }
          const next = [...visible].sort((a, b) => b[1] - a[1])[0];
          if (next) setActive(next[0]);
        },
        { rootMargin: "-20% 0px -25% 0px", threshold: [0, 0.2, 0.5, 0.8] },
      );
      steps.current.forEach((step) => {
        if (step) observer?.observe(step);
      });
    };

    configure();
    media.addEventListener("change", configure);
    return () => {
      observer?.disconnect();
      media.removeEventListener("change", configure);
    };
  }, []);

  return (
    <section
      id="inside-guide"
      className={styles.section}
      aria-labelledby="inside-title"
    >
      <div className={styles.heading} data-motion-reveal="up">
        <div>
          <p className={styles.eyebrow}>A LOOK INSIDE</p>
          <h2 id="inside-title">
            From first idea
            <br />
            to a <em>tested pilot.</em>
          </h2>
        </div>
        <p>
          Real pages. Practical steps.
          <br />
          Here is what you will work through.{" "}
          <ArrowDownRight size={20} aria-hidden="true" />
        </p>
      </div>
      <div className={styles.sequence} data-enhanced={enhanced}>
        <div className={styles.stage} aria-hidden="true">
          <div className={styles.stageTop}>
            <span>THE WORKING GUIDE</span>
            <span>PDF / 28 PAGES</span>
          </div>
          <div className={styles.pages}>
            {guideChapters.map((chapter, index) => (
              <div
                key={chapter.number}
                className={styles.frame}
                data-active={active === index}
              >
                <Image
                  src={chapter.image}
                  alt=""
                  width={990}
                  height={1400}
                  sizes="440px"
                />
              </div>
            ))}
          </div>
          <div className={styles.stageBottom}>
            <span>{guideChapters[active].label}</span>
            <span>
              {guideChapters[active].page}{" "}
              <span className={styles.pageTotal}>/ 28</span>
            </span>
          </div>
        </div>
        <ol className={styles.chapters}>
          {guideChapters.map((chapter, index) => (
            <li
              key={chapter.number}
              ref={(element) => {
                steps.current[index] = element;
              }}
              className={styles.chapter}
            >
              <div className={styles.chapterText} data-motion-reveal="up">
                <p className={styles.chapterLabel}>
                  <span>{chapter.number}</span>
                  {chapter.label}
                </p>
                <h3>{chapter.title}</h3>
                <p className={styles.description}>{chapter.description}</p>
                <ul className={styles.points}>
                  {chapter.points.map((point) => (
                    <li key={point}>
                      <Check size={15} aria-hidden="true" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <figure className={styles.inlinePreview}>
                <Image
                  src={chapter.image}
                  alt={chapter.imageAlt}
                  width={990}
                  height={1400}
                  sizes="(max-width: 760px) 85vw, 440px"
                />
                <figcaption>
                  From the guide · Page {chapter.page} of 28
                </figcaption>
              </figure>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
