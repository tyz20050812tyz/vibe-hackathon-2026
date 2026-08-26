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
export const resourceLanguageSchema = z.enum(["zh", "en", "other"]);
export const searchSortSchema = z.enum(["catalog", "personalized"]);
export const explorationLevelSchema = z.enum(["gentle", "balanced", "bold"]);
export const discoveryModeSchema = z.enum(["extend", "challenge", "context", "surprise"]);

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

const uniqueValues = <T extends z.ZodTypeAny>(schema: T, max: number) =>
  z.array(schema).max(max).superRefine((values, context) => {
    if (new Set(values).size !== values.length) {
      context.addIssue({ code: "custom", message: "筛选值不能重复。" });
    }
  });

export const searchResourcesQuerySchema = z
  .object({
    q: z
      .string()
      .trim()
      .max(80, "搜索词不能超过 80 个字符。")
      .transform((value) => value || undefined)
      .optional(),
    tag: slugSchema.optional(),
    languages: uniqueValues(resourceLanguageSchema, 3).optional(),
    yearFrom: z.coerce.number().int().min(1000).max(2100).optional(),
    yearTo: z.coerce.number().int().min(1000).max(2100).optional(),
    types: uniqueValues(resourceTypeSchema, 4).optional(),
    availabilities: uniqueValues(availabilitySchema, 4).optional(),
    sort: searchSortSchema.default("catalog"),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.yearFrom && value.yearTo && value.yearFrom > value.yearTo) {
      context.addIssue({ code: "custom", path: ["yearFrom"], message: "起始年份不能晚于结束年份。" });
    }
  });

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

const favoriteBookSchema = z.object({
  title: z.string().trim().min(1, "喜欢的书名不能为空。").max(120),
  author: z.string().trim().max(80).optional().transform((value) => value || undefined),
}).strict();

export const replaceReadingProfileSchema = z.object({
  interestTagIds: z.array(z.string().uuid("兴趣标签必须是 UUID。")).min(3).max(8)
    .superRefine((values, context) => {
      if (new Set(values).size !== values.length) context.addIssue({ code: "custom", message: "兴趣标签不能重复。" });
    }),
  explorationLevel: explorationLevelSchema,
  favoriteBooks: z.array(favoriteBookSchema).max(3).optional(),
  consent: z.literal(true, { error: "必须同意将偏好用于个性化推荐。" }),
}).strict();

export const discoverRequestSchema = z.object({
  originResourceId: z.string().uuid("originResourceId 必须是 UUID。"),
  mode: discoveryModeSchema.default("surprise"),
  excludeResourceIds: z.array(z.string().uuid("excludeResourceIds 必须是 UUID。")).max(20).optional()
    .superRefine((values, context) => { if (values && new Set(values).size !== values.length) context.addIssue({ code: "custom", message: "排除资源不能重复。" }); }),
  discoveryContext: z.string().min(1).max(2048).optional(),
}).strict();

export type SearchResourcesQueryInput = z.output<
  typeof searchResourcesQuerySchema
>;
export type CreateSavedResourceInput = z.output<
  typeof createSavedResourceSchema
>;
export type ReplaceReadingProfileInput = z.output<typeof replaceReadingProfileSchema>;
export type DiscoverRequestInput = z.output<typeof discoverRequestSchema>;
