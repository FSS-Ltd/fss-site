type StepProgressProps = {
  current: number;
  total: number;
  label: string;
};

/** Shared segmented progress for multi-step forms. `current` is 1-based. */
export function StepProgress({ current, total, label }: StepProgressProps) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      aria-valuetext={`Step ${current} of ${total}`}
      className="flex w-full gap-1.5"
    >
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[rgb(33_27_23/0.1)]"
        >
          <span
            className="absolute inset-0 origin-left rounded-full bg-brand-accent transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            style={{ transform: `scaleX(${index < current ? 1 : 0})` }}
          />
        </span>
      ))}
    </div>
  );
}
