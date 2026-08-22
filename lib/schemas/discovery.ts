import { z } from "zod";

export const discoverQuerySchema = z
  .object({
    sourceResourceId: z.string().uuid("sourceResourceId 必须是 UUID。").optional(),
  })
  .strict();

export type DiscoverQueryInput = z.output<typeof discoverQuerySchema>;
