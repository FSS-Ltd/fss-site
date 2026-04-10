"use client";

// Durations are pre-computed once at module load so SSR and client
// produce the same values - avoiding a hydration mismatch.

const PATH_COUNT = 36;

const durations = Array.from(
  { length: PATH_COUNT },
  () => 20 + Math.random() * 10,
);

function FloatingPaths({ position }: { position: number }) {
  const paths = Array.from({ length: PATH_COUNT }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${
      380 - i * 5 * position
    } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
      152 - i * 5 * position
    } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
      684 - i * 5 * position
    } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    width: 0.5 + i * 0.03,
  }));

  return (
    <div className="absolute inset-0 pointer-events-none">
      <svg
        className="w-full h-full text-brand-primary"
        viewBox="0 0 696 316"
        fill="none"
        aria-hidden="true"
      >
        {paths.map((path) => (
          <path
            key={path.id}
            d={path.d}
            stroke="currentColor"
            strokeWidth={path.width}
            strokeOpacity={0.04 + path.id * 0.015}
            strokeDasharray="6 14"
          >
            <animate
              attributeName="stroke-dashoffset"
              from="0"
              to="220"
              dur={`${durations[path.id]}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.25;0.6;0.25"
              dur={`${Math.max(12, durations[path.id] * 0.7)}s`}
              repeatCount="indefinite"
            />
          </path>
        ))}
      </svg>
    </div>
  );
}

export function BackgroundPaths() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <FloatingPaths position={1} />
      <FloatingPaths position={-1} />
    </div>
  );
}
