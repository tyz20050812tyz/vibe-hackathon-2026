import { z } from "zod";

export const profileUpdateSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, "显示名不能为空。")
      .max(50, "显示名不能超过 50 个字符。"),
  })
  .strict();

export type ProfileUpdateInput = z.output<typeof profileUpdateSchema>;
