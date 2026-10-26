import { pipelineFiltersSchema, type PipelineFilters } from "./schemas";

type RawSearchParams = Record<string, string | readonly string[] | undefined>;
export function parsePipelineFilters(params: RawSearchParams): PipelineFilters {
  const values: Record<string, string> = {};
  for (const key of Object.keys(pipelineFiltersSchema.shape)) {
    const raw = params[key];
    const value = typeof raw === "string" ? raw : raw?.[0];
    if (value !== undefined) values[key] = value;
  }
  // Each invalid field falls back independently; valid filters remain usable.
  const defaults = pipelineFiltersSchema.parse({});
  return {
    q: pipelineFiltersSchema.shape.q.safeParse(values.q).data ?? defaults.q,
    sector:
      pipelineFiltersSchema.shape.sector.safeParse(values.sector).data ??
      defaults.sector,
    location:
      pipelineFiltersSchema.shape.location.safeParse(values.location).data ??
      defaults.location,
    stage:
      pipelineFiltersSchema.shape.stage.safeParse(values.stage).data ??
      defaults.stage,
    nextAction:
      pipelineFiltersSchema.shape.nextAction.safeParse(values.nextAction)
        .data ?? defaults.nextAction,
    view:
      pipelineFiltersSchema.shape.view.safeParse(values.view).data ??
      defaults.view,
  };
}
export function pipelineHref(
  filters: PipelineFilters,
  overrides: Partial<PipelineFilters> = {},
  after: Partial<Record<string, string>> = {},
): string {
  const defaults = pipelineFiltersSchema.parse({});
  const merged = { ...filters, ...overrides };
  const params = new URLSearchParams();
  for (const key of Object.keys(defaults) as (keyof PipelineFilters)[])
    if (merged[key] !== defaults[key]) params.set(key, merged[key]);
  for (const [stage, value] of Object.entries(after))
    if (value) params.set(`after_${stage}`, value);
  const search = params.toString();
  return search ? `/growth/pipeline?${search}` : "/growth/pipeline";
}
