"use client";

export default function OperationsError({
  retry,
}: {
  retry: () => void;
}): React.JSX.Element {
  return (
    <section aria-labelledby="operations-error-heading">
      <h1 id="operations-error-heading">Operations unavailable</h1>
      <p>
        The records could not be loaded. Your existing access settings have not
        changed.
      </p>
      <button type="button" onClick={retry}>
        Try again
      </button>
    </section>
  );
}
