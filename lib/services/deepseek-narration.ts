import "server-only";

import { createHash } from "node:crypto";

import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { RelationType } from "@/lib/types/resources";

import { claimModelAttempt, completeModelAttempt, type ModelSkipReason } from "./request-limits";

const NARRATION_TTL_MS = 15 * 60 * 1_000;
const TEMPLATE_TTL_MS = 60 * 1_000;
const MAX_RESPONSE_BYTES = 8 * 1_024;
const narrationSchema = z.object({
  narration: z.string().trim().min(20).max(90),
}).strict().superRefine((value, context) => {
  const hanCharacters = [...value.narration].filter((character) => /[\u4e00-\u9fff]/.test(character)).length;
  if (hanCharacters < 20 || hanCharacters > 90 || /https?:\/\/|www\./i.test(value.narration)) {
    context.addIssue({ code: "custom", message: "Narration must be a 20-90 Chinese-character reading prompt." });
  }
});

type ResourceNarrationInput = { title: string; summary: string; tags: string[] };
export type DeepSeekNarrationInput = {
  originResourceId: string;
  targetResourceId: string;
  relationId: string;
  relationType: RelationType;
  relationExplanation: string;
  mode: "extend" | "challenge" | "context" | "surprise";
  personalization: "catalog" | "profile";
  origin: ResourceNarrationInput;
  target: ResourceNarrationInput;
  readingLens?: { interestTags: string[]; explorationLevel: "gentle" | "balanced" | "bold" };
  identity: string;
  authenticated: boolean;
};

export type NarrationResult = { narration: string; source: "template" | "deepseek"; skippedReason?: ModelSkipReason | "provider_failure" };

function enabled() {
  return process.env.DEEPSEEK_ENABLED === "true";
}

function cacheKey(input: DeepSeekNarrationInput) {
  return createHash("sha256").update(JSON.stringify({
    version: "reading-lens-v1",
    originResourceId: input.originResourceId,
    targetResourceId: input.targetResourceId,
    relationId: input.relationId,
    mode: input.mode,
    personalization: input.personalization,
  })).digest("hex");
}

async function cached(key: string) {
  try {
    const { data, error } = await createSupabaseServerClient()
      .from("discovery_narration_cache")
      .select("narration, expires_at")
      .eq("cache_key", key)
      .maybeSingle();
    if (error || !data || new Date(data.expires_at).getTime() <= Date.now()) return undefined;
    return typeof data.narration === "string" ? data.narration : null;
  } catch {
    return undefined;
  }
}

async function cache(key: string, narration: string | null, ttl: number) {
  try {
    await createSupabaseServerClient().from("discovery_narration_cache").upsert({
      cache_key: key,
      narration,
      expires_at: new Date(Date.now() + ttl).toISOString(),
    });
  } catch {
    // The adapter continues even when the optional cache store is unavailable.
  }
}

function prompt(input: DeepSeekNarrationInput) {
  return JSON.stringify({
    task: "写一段中文阅读引导，只说明读者会从什么问题走向什么问题。",
    constraints: [
      "仅输出 JSON：{\\\"narration\\\": string}",
      "narration 必须含 20 到 90 个汉字，不得含 URL、书目、作者、链接、可读状态或未提供的事实。",
      "不得提及用户身份、邮箱、令牌、喜爱书目或筛选上下文。",
    ],
    relationType: input.relationType,
    relationExplanation: input.relationExplanation,
    origin: input.origin,
    target: input.target,
    readingLens: input.readingLens,
  });
}

async function requestProvider(input: DeepSeekNarrationInput) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 180,
      messages: [
        { role: "system", content: "你是图书馆的阅读引导助手。严格遵守用户消息中的 JSON 输出约束。" },
        { role: "user", content: prompt(input) },
      ],
    }),
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) return null;
  const text = await response.text();
  if (text.length > MAX_RESPONSE_BYTES) return null;
  const parsed = z.object({ choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1) }).safeParse(JSON.parse(text));
  if (!parsed.success) return null;
  const narration = narrationSchema.safeParse(JSON.parse(parsed.data.choices[0].message.content));
  return narration.success ? narration.data.narration : null;
}

export async function narrateWithDeepSeek(input: DeepSeekNarrationInput): Promise<NarrationResult> {
  const fallback = (skippedReason?: NarrationResult["skippedReason"]): NarrationResult => ({
    narration: input.relationExplanation,
    source: "template",
    ...(skippedReason ? { skippedReason } : {}),
  });
  if (!enabled()) return fallback("disabled");
  if (!process.env.DEEPSEEK_API_KEY || !process.env.DISCOVERY_LIMIT_HASH_SALT) return fallback("configuration_missing");

  const key = cacheKey(input);
  const existing = await cached(key);
  if (existing !== undefined) return existing ? { narration: existing, source: "deepseek" } : fallback();

  const claim = await claimModelAttempt({ identity: input.identity, originResourceId: input.originResourceId, authenticated: input.authenticated });
  if (!claim.permitted) return fallback(claim.reason);

  try {
    const narration = await requestProvider(input);
    await completeModelAttempt(Boolean(narration));
    if (!narration) {
      await cache(key, null, TEMPLATE_TTL_MS);
      return fallback("provider_failure");
    }
    await cache(key, narration, NARRATION_TTL_MS);
    return { narration, source: "deepseek" };
  } catch {
    await completeModelAttempt(false);
    await cache(key, null, TEMPLATE_TTL_MS);
    return fallback("provider_failure");
  }
}
