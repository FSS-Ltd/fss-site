"use client";

import { useRef, useState } from "react";
import styles from "./faq.module.css";

export type FaqItem = { id: string; question: string; answer: string };

function FaqAnswer({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  return (
    <div
      className={styles.item}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          setOpen(false);
          button.current?.focus();
        }
      }}
    >
      <h3>
        <button
          ref={button}
          id={`${item.id}-question`}
          className={styles.question}
          type="button"
          aria-expanded={open}
          aria-controls={`${item.id}-answer`}
          onClick={() => setOpen(!open)}
        >
          {item.question}
          <span aria-hidden="true">{open ? "−" : "+"}</span>
        </button>
      </h3>
      <div
        id={`${item.id}-answer`}
        role="region"
        aria-labelledby={`${item.id}-question`}
        hidden={!open}
      >
        <p className={styles.answer}>{item.answer}</p>
      </div>
    </div>
  );
}

export function Faq({ items }: { items: readonly FaqItem[] }) {
  return (
    <div>
      {items.map((item) => (
        <FaqAnswer key={item.id} item={item} />
      ))}
    </div>
  );
}
