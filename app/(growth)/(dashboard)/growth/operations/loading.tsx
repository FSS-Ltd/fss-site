export default function OperationsLoading(): React.JSX.Element {
  return (
    <main aria-busy="true">
      <h1>Operations</h1>
      <p role="status">Loading contract revenue and client actions…</p>
    </main>
  );
}
