import { z } from "zod";

export const constellationQuerySchema = z
  .object({
    depth: z.coerce
      .number()
      .int()
      .pipe(z.union([z.literal(1), z.literal(2)]))
      .default(1),
  })
  .strict();

export const CONSTELLATION_DEPTH_NOT_ENABLED_MESSAGE =
  "二跳星图尚未启用，请使用 depth=1。";

export const enabledConstellationDepthSchema = z.literal(1, {
  error: CONSTELLATION_DEPTH_NOT_ENABLED_MESSAGE,
});

export function parseConstellationQuery(searchParams: URLSearchParams) {
  const query: Record<string, string | string[]> = {};
  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key);
    query[key] = values.length === 1 ? values[0] : values;
  }
  return constellationQuerySchema.parse(query);
}

export type ConstellationQueryInput = z.output<
  typeof constellationQuerySchema
>;
