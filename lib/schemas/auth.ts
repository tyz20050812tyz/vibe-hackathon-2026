import { z } from "zod";

const emailSchema = z.email("请输入有效的邮箱地址。").trim().toLowerCase();

const passwordSchema = z
  .string()
  .min(8, "密码至少需要 8 个字符。")
  .max(72, "密码不能超过 72 个字符。")
  .regex(/[A-Za-z]/, "密码需要包含字母。")
  .regex(/[0-9]/, "密码需要包含数字。")
  .regex(/[^A-Za-z0-9]/, "密码需要包含特殊字符。");

export const signInSchema = z.object({ email: emailSchema, password: passwordSchema }).strict();
export const signUpSchema = z.object({ email: emailSchema, password: passwordSchema }).strict();

export type SignInInput = z.output<typeof signInSchema>;
export type SignUpInput = z.output<typeof signUpSchema>;
