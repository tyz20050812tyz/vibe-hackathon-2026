import { z } from "zod";

export const resourceTypeSchema = z.enum([
  "book",
  "paper",
  "talk",
  "collection",
]);

export const availabilitySchema = z.enum([
  "available",
  "online",
  "reference_only",
  "check_library",
]);

export const tagCategorySchema = z.enum(["discipline", "theme", "format"]);

export const relationTypeSchema = z.enum([
  "same_theme",
  "contrasting_view",
  "historical_context",
  "unexpected_bridge",
]);

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "必须使用小写 kebab-case。");

export const searchResourcesQuerySchema = z
  .object({
    q: z.string().trim().max(80, "搜索词不能超过 80 个字符。").optional(),
    tag: slugSchema.optional(),
    type: resourceTypeSchema.optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const resourceSlugParamsSchema = z
  .object({ slug: slugSchema })
  .strict();

export const createSavedResourceSchema = z
  .object({
    resourceId: z.string().uuid("resourceId 必须是 UUID。"),
    note: z.string().trim().max(500, "笔记不能超过 500 个字符。").optional(),
  })
  .strict();

export const savedResourceParamsSchema = z
  .object({ resourceId: z.string().uuid("resourceId 必须是 UUID。") })
  .strict();

export type SearchResourcesQueryInput = z.output<
  typeof searchResourcesQuerySchema
>;
export type CreateSavedResourceInput = z.output<
  typeof createSavedResourceSchema
>;
