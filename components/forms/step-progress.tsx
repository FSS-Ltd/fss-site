type StepProgressProps = {
  current: number;
  total: number;
  label: string;
};

/** Shared progress bar for multi-step forms. `current` is 1-based. */
export function StepProgress({ current, total, label }: StepProgressProps) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      aria-valuetext={`Step ${current} of ${total}`}
      className="h-1.5 w-full overflow-hidden rounded-full bg-[#eef0f2]"
    >
      <div
        className="h-full rounded-full bg-brand-accent transition-all duration-300 motion-reduce:transition-none"
        style={{ width: `${Math.round((current / total) * 100)}%` }}
      />
    </div>
  );
}
