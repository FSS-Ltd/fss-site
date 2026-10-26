"use client";

import {
  useId,
  useRef,
  useState,
  type ReactNode,
  type KeyboardEvent,
} from "react";
import styles from "./outreach-workspace.module.css";

const TABS = ["Email drafts", "Sequences", "Audit follow-ups"] as const;

export function OutreachWorkspace({
  drafts,
  sequences,
  audits,
}: {
  drafts: ReactNode;
  sequences: ReactNode;
  audits: ReactNode;
}): React.JSX.Element {
  const id = useId();
  const [active, setActive] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const panels = [drafts, sequences, audits];

  function navigate(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ): void {
    let next: number;
    switch (event.key) {
      case "ArrowRight":
        next = (index + 1) % TABS.length;
        break;
      case "ArrowLeft":
        next = (index + TABS.length - 1) % TABS.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = TABS.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    setActive(next);
    buttons.current[next]?.focus();
  }

  return (
    <div className={styles.workspace}>
      <div
        role="tablist"
        aria-label="Outreach sections"
        className={styles.tabs}
      >
        {TABS.map((label, index) => (
          <button
            key={label}
            type="button"
            role="tab"
            ref={(element) => {
              buttons.current[index] = element;
            }}
            id={`${id}-tab-${index}`}
            aria-controls={`${id}-panel-${index}`}
            aria-selected={active === index}
            tabIndex={active === index ? 0 : -1}
            className={styles.tab}
            onClick={() => setActive(index)}
            onKeyDown={(event) => navigate(event, index)}
          >
            {label}
          </button>
        ))}
      </div>
      {panels.map((content, index) => (
        <div
          key={TABS[index]}
          role="tabpanel"
          tabIndex={0}
          id={`${id}-panel-${index}`}
          aria-labelledby={`${id}-tab-${index}`}
          hidden={active !== index}
        >
          {content}
        </div>
      ))}
    </div>
  );
}
