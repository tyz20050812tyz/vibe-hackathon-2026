import type { SupabaseClient } from "@supabase/supabase-js";

import type { SignInInput, SignUpInput } from "@/lib/schemas/auth";
import { AuthEmailError, sendSignupConfirmationEmail, verifySignupEmailDelivery } from "@/lib/services/auth-email";

export class AuthServiceError extends Error {
  constructor(public readonly code: "CONFIGURATION_ERROR" | "AUTHENTICATION_FAILED" | "SUPABASE_UNAVAILABLE", message: string) {
    super(message);
    this.name = "AuthServiceError";
  }
}

function unavailable() {
  return new AuthServiceError("SUPABASE_UNAVAILABLE", "登录服务暂时不可用，请稍后重试。");
}

export async function signIn(supabase: SupabaseClient, input: SignInInput) {
  const { data, error } = await supabase.auth.signInWithPassword(input);
  if (error || !data.session) {
    throw new AuthServiceError("AUTHENTICATION_FAILED", "邮箱或密码不正确，或邮箱尚未完成验证。");
  }
  return { status: "authenticated" as const };
}

export async function signUp(supabase: SupabaseClient, input: SignUpInput, confirmationRedirectUrl: string) {
  try {
    // Avoid creating an unconfirmed account when SMTP is unavailable or misconfigured.
    await verifySignupEmailDelivery();
  } catch (error) {
    if (error instanceof AuthEmailError) throw new AuthServiceError(error.code, error.message);
    throw unavailable();
  }
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "signup",
    email: input.email,
    password: input.password,
    options: { redirectTo: confirmationRedirectUrl },
  });
  if (error) {
    throw new AuthServiceError("SUPABASE_UNAVAILABLE", "暂时无法创建账号，请稍后重试。");
  }
  try {
    await sendSignupConfirmationEmail(input.email, data.properties.action_link);
  } catch (error) {
    if (error instanceof AuthEmailError) throw new AuthServiceError(error.code, error.message);
    throw unavailable();
  }
  return { status: "confirmation_required" as const };
}

export async function signOut(supabase: SupabaseClient) {
  const { error } = await supabase.auth.signOut();
  if (error) throw unavailable();
}
