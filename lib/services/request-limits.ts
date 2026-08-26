import "server-only";

import { createHash } from "node:crypto";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ModelSkipReason =
  | "disabled"
  | "configuration_missing"
  | "limiter_unavailable"
  | "identity_rate_limited"
  | "identity_daily_budget_exhausted"
  | "provider_daily_budget_exhausted"
  | "global_concurrency_limited"
  | "circuit_open";

type ClaimInput = {
  identity: string;
  originResourceId: string;
  authenticated: boolean;
};

type LimitConfig = {
  perMinute: number;
  perDay: number;
  providerPerDay: number;
  concurrency: number;
  breakerThreshold: number;
  breakerCooldownSeconds: number;
};

function positiveEnvironmentInteger(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function modelLimitConfig(): LimitConfig {
  return {
    perMinute: positiveEnvironmentInteger("DEEPSEEK_ANONYMOUS_PER_MINUTE", 10),
    perDay: positiveEnvironmentInteger("DEEPSEEK_IDENTITY_DAILY_LIMIT", 100),
    providerPerDay: positiveEnvironmentInteger("DEEPSEEK_PROVIDER_DAILY_LIMIT", 1_000),
    concurrency: positiveEnvironmentInteger("DEEPSEEK_GLOBAL_CONCURRENCY", 10),
    breakerThreshold: positiveEnvironmentInteger("DEEPSEEK_CIRCUIT_FAILURE_THRESHOLD", 5),
    breakerCooldownSeconds: positiveEnvironmentInteger("DEEPSEEK_CIRCUIT_COOLDOWN_SECONDS", 60),
  };
}

function identityHash(value: string) {
  const salt = process.env.DISCOVERY_LIMIT_HASH_SALT;
  if (!salt) return null;
  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

export async function claimModelAttempt(input: ClaimInput): Promise<{ permitted: true } | { permitted: false; reason: ModelSkipReason }> {
  const hash = identityHash(input.identity);
  if (!hash) return { permitted: false, reason: "configuration_missing" };

  try {
    const config = modelLimitConfig();
    const { data, error } = await createSupabaseServerClient().rpc("claim_discovery_model_attempt", {
      p_identity_hash: hash,
      p_origin_resource_id: input.originResourceId,
      p_is_authenticated: input.authenticated,
      p_per_minute_limit: input.authenticated
        ? positiveEnvironmentInteger("DEEPSEEK_AUTHENTICATED_PER_MINUTE", 20)
        : config.perMinute,
      p_per_day_limit: config.perDay,
      p_provider_daily_limit: config.providerPerDay,
      p_global_concurrency_limit: config.concurrency,
    });
    const result = Array.isArray(data) ? data[0] : null;
    if (error || !result || typeof result.permitted !== "boolean") return { permitted: false, reason: "limiter_unavailable" };
    return result.permitted
      ? { permitted: true }
      : { permitted: false, reason: (result.reason as ModelSkipReason) || "limiter_unavailable" };
  } catch {
    return { permitted: false, reason: "limiter_unavailable" };
  }
}

export async function completeModelAttempt(success: boolean) {
  try {
    const config = modelLimitConfig();
    await createSupabaseServerClient().rpc("complete_discovery_model_attempt", {
      p_success: success,
      p_failure_threshold: config.breakerThreshold,
      p_cooldown_seconds: config.breakerCooldownSeconds,
    });
  } catch {
    // Model narration is optional; failure to record telemetry must not affect discovery.
  }
}
