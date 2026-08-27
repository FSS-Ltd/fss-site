"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

type RevealElement = "div" | "section";

type RevealOnScrollProps = {
  as?: RevealElement;
  children: ReactNode;
  className?: string;
  delay?: number;
  id?: string;
};

export function RevealOnScroll({
  as: Tag = "div",
  children,
  className,
  delay = 0,
  id,
}: RevealOnScrollProps) {
  const elementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !("IntersectionObserver" in window)) return;

    element.dataset.prospectReveal = "pending";

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;

        element.dataset.prospectReveal = "shown";
        observer.unobserve(element);
      },
      { threshold: 0.12 },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      className={["prospect-reveal", className].filter(Boolean).join(" ")}
      id={id}
      ref={(element) => {
        elementRef.current = element;
      }}
      style={delay > 0 ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
