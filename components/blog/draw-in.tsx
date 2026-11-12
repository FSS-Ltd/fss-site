"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

import styles from "@/components/blog/blog.module.css";

/** Draws its children in from the left once, after hydration. Content is
 *  visible by default (no JS, reduced motion, captures); the hidden start is
 *  armed only here, then released a frame later so the CSS transition runs. */
export function DrawIn({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.dataset.armed = "";
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        el.dataset.in = "";
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      delete el.dataset.armed;
      delete el.dataset.in;
    };
  }, []);

  return (
    <div ref={ref} className={`${styles.draw} ${className}`}>
      {children}
    </div>
  );
}
