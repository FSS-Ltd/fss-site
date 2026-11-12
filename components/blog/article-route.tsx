"use client";

import { useEffect, useRef } from "react";

import type { ArticleHeading } from "@/lib/blog-presentation";
import styles from "@/components/blog/blog.module.css";

/** Where the reader's "current section" line sits, as a share of the viewport. */
const READ_LINE = 0.35;

/** The article contents as a route: each h2 is a node on a vertical line, the
 *  line fills as the reader scrolls and the current node is lit. The markup is
 *  a plain ordered list of anchors, so it reads the same without JS; the
 *  script only sets data-state on the nodes and one custom property. */
export function ArticleRoute({ headings }: { headings: ArticleHeading[] }) {
  const nav = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = nav.current;
    if (!root) return;
    const items = [...root.querySelectorAll<HTMLElement>("li")];
    const targets = headings.map((heading) => document.getElementById(heading.id));
    if (items.length < 2 || targets.some((target) => !target)) return;
    const sections = targets as HTMLElement[];
    let frame = 0;
    let last = "";

    const update = () => {
      frame = 0;
      const line = window.innerHeight * READ_LINE;
      let current = -1;
      sections.forEach((section, index) => {
        if (section.getBoundingClientRect().top <= line) current = index;
      });

      // Dot centres, so the fill lands on a node however long its title is.
      const centres = items.map((item) => item.offsetTop + item.offsetHeight / 2);
      const total = centres[centres.length - 1] - centres[0];
      let fill = 0;
      if (current >= 0 && total > 0) {
        const top = sections[current].getBoundingClientRect().top;
        const next = sections[current + 1]?.getBoundingClientRect().top;
        const span = next === undefined ? 0 : next - top;
        const part = span > 0 ? Math.min(1, Math.max(0, (line - top) / span)) : 0;
        const end = centres[current + 1] ?? centres[current];
        const y = centres[current] + part * (end - centres[current]);
        fill = Math.min(1, (y - centres[0]) / total);
      }

      const key = `${current}:${fill.toFixed(3)}`;
      if (key === last) return;
      last = key;
      root.style.setProperty("--fill", String(fill));
      items.forEach((item, index) => {
        item.dataset.state =
          index < current ? "passed" : index === current ? "current" : "upcoming";
        if (index === current) item.firstElementChild?.setAttribute("aria-current", "location");
        else item.firstElementChild?.removeAttribute("aria-current");
      });
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [headings]);

  return (
    <nav ref={nav} className={styles.toc} aria-labelledby="article-contents">
      <p id="article-contents" className={styles.label}>
        In this article
      </p>
      <ol>
        {headings.map((heading) => (
          <li key={heading.id}>
            <a href={`#${heading.id}`}>
              <span>{heading.text}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
