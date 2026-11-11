type ElectricalCircuitBoardProps = {
  scope?: "hero" | "site";
};

export function ElectricalCircuitBoard({
  scope = "hero",
}: ElectricalCircuitBoardProps) {
  return (
    <div
      aria-hidden="true"
      data-electrical-circuit-board="true"
      data-electrical-circuit-scope={scope}
    >
      <span data-electrical-circuit-grid="true" />
      <span className="circuitTrace circuitTraceA" data-electrical-circuit-trace="true" />
      <span className="circuitTrace circuitTraceB" data-electrical-circuit-trace="true" />
      <span className="circuitTrace circuitTraceC" data-electrical-circuit-trace="true" />
      <span className="circuitTrace circuitTraceD" data-electrical-circuit-trace="true" />
      <span className="circuitNode circuitNodeA" data-electrical-circuit-node="true" />
      <span className="circuitNode circuitNodeB" data-electrical-circuit-node="true" />
      <span className="circuitNode circuitNodeC" data-electrical-circuit-node="true" />
      <span className="circuitNode circuitNodeD" data-electrical-circuit-node="true" />
      <span className="circuitNode circuitNodeE" data-electrical-circuit-node="true" />
    </div>
  );
}
