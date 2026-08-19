import {
  Ban,
  CircleAlert,
  CircleCheck,
  Clock3,
  Mail,
  MessageCircle,
  Pause,
  Play,
} from "lucide-react";

import {
  formatGrowthDateTime,
  formatGrowthStatusLabel,
} from "@/lib/growth/dashboard/formatters";
import type { TimelineEvent } from "@/lib/growth/dashboard/outreach";

import styles from "./outreach.module.css";

const KIND_ICON: Record<
  TimelineEvent["kind"],
  { icon: typeof Mail; tone?: "neutral" | "amber" | "red" }
> = {
  scheduled: { icon: Clock3, tone: "neutral" },
  sent: { icon: Mail },
  reply: { icon: MessageCircle },
  failed: { icon: CircleAlert, tone: "red" },
  cancelled: { icon: Ban, tone: "neutral" },
  paused: { icon: Pause, tone: "amber" },
  resumed: { icon: Play },
  stopped: { icon: CircleCheck, tone: "red" },
};

function dayLabel(stepNumber: number | null): string {
  if (stepNumber === null) return "";
  const days = [1, 5, 11, 20];
  return `Day ${days[stepNumber] ?? stepNumber}`;
}

export function SequenceTimeline({
  timeline,
}: {
  timeline: readonly TimelineEvent[];
}) {
  if (timeline.length === 0) {
    return <p>No sequence activity yet.</p>;
  }

  return (
    <ol className={styles.timeline}>
      {timeline.map((event) => {
        const { icon: Icon, tone } = KIND_ICON[event.kind];

        return (
          <li className={styles.timelineItem} key={event.id}>
            <span className={styles.timelineDay}>{dayLabel(event.stepNumber)}</span>
            <span className={styles.timelineMarker}>
              <span className={styles.timelineIcon} data-tone={tone}>
                <Icon aria-hidden="true" size={16} strokeWidth={2} />
              </span>
            </span>
            <div className={styles.timelineContent}>
              <p className={styles.timelineTitle}>
                {event.label}
                {event.detail && (
                  <span className={styles.pill} data-tone={tone}>
                    {event.detail === "Sent" || event.detail === "Scheduled"
                      ? event.detail
                      : formatGrowthStatusLabel(event.kind)}
                  </span>
                )}
              </p>
              <p className={styles.timelineMeta}>
                {formatGrowthDateTime(event.occurredAt)}
                {event.providerObservedAt &&
                  event.localReceivedAt &&
                  event.providerObservedAt !== event.localReceivedAt && (
                    <> · Recorded {formatGrowthDateTime(event.localReceivedAt)}</>
                  )}
              </p>
              {event.detail &&
                event.detail !== "Sent" &&
                event.detail !== "Scheduled" && (
                  <p className={styles.timelineDetail}>{event.detail}</p>
                )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
