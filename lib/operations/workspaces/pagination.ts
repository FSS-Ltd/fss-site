import { z } from "zod";

export const workspacePageSize = 25;

const pageSchema = z.coerce.number().int().min(1).max(10_000);

export type WorkspaceCollectionPage<T> = {
  items: T[];
  page: number;
  hasNext: boolean;
};

export function parseWorkspacePage(value: unknown): number {
  if (Array.isArray(value)) throw new Error("Only one page value is allowed.");
  return pageSchema.parse(value ?? 1);
}

export function workspacePageOffset(page: number): number {
  return (pageSchema.parse(page) - 1) * workspacePageSize;
}

export function toWorkspaceCollectionPage<T>(
  rows: readonly T[],
  page: number,
): WorkspaceCollectionPage<T> {
  return {
    items: [...rows.slice(0, workspacePageSize)],
    page: pageSchema.parse(page),
    hasNext: rows.length > workspacePageSize,
  };
}
