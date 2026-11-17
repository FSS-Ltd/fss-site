export type AuthorityBounds = {
  validatedAt: Date;
  expiresAt: Date;
  validThrough: Date | null;
};

export function intersectAuthorityBounds(
  ...bounds: AuthorityBounds[]
): AuthorityBounds {
  const dates = bounds.flatMap((bound) => [
    bound.validatedAt,
    bound.expiresAt,
    ...(bound.validThrough ? [bound.validThrough] : []),
  ]);
  if (!bounds.length || dates.some((date) => !Number.isFinite(date.getTime())))
    throw new Error("invalid_authority_bounds");
  const inclusive = bounds.flatMap((bound) =>
    bound.validThrough ? [bound.validThrough.getTime()] : [],
  );
  return {
    validatedAt: new Date(
      Math.max(...bounds.map((bound) => bound.validatedAt.getTime())),
    ),
    expiresAt: new Date(
      Math.min(...bounds.map((bound) => bound.expiresAt.getTime())),
    ),
    validThrough: inclusive.length ? new Date(Math.min(...inclusive)) : null,
  };
}
