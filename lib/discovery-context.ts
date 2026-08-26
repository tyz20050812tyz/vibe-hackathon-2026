import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";

import type { SearchResourcesQuery } from "@/lib/types/resources";

type DiscoveryContextPayload = {
  version: 1;
  originSlug: string;
  filters: Pick<SearchResourcesQuery, "tag" | "languages" | "yearFrom" | "yearTo" | "types" | "availabilities">;
  issuedAt: number;
  expiresAt: number;
};

const discoveryContextPayloadSchema = z.object({
  version: z.literal(1),
  originSlug: z.string().min(1),
  filters: z.object({
    tag: z.string().min(1).max(80).optional(),
    languages: z.array(z.enum(["zh", "en", "other"])).max(3).optional(),
    yearFrom: z.number().int().min(1000).max(2100).optional(),
    yearTo: z.number().int().min(1000).max(2100).optional(),
    types: z.array(z.enum(["book", "paper", "talk", "collection"])).max(4).optional(),
    availabilities: z.array(z.enum(["available", "online", "reference_only", "check_library"])).max(4).optional(),
  }).strict(),
  issuedAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
}).strict().superRefine((payload, context) => {
  if (payload.expiresAt <= payload.issuedAt) {
    context.addIssue({ code: "custom", path: ["expiresAt"], message: "发现上下文过期时间不合法。" });
  }
});

export class DiscoveryContextConfigurationError extends Error {
  constructor() {
    super("发现筛选上下文未配置加密密钥。");
    this.name = "DiscoveryContextConfigurationError";
  }
}

function key() {
  const encoded = process.env.DISCOVERY_CONTEXT_ENCRYPTION_KEY;
  if (!encoded) return null;
  const value = Buffer.from(encoded, "base64");
  return value.length === 32 ? value : null;
}

function hasHardFilters(filters: DiscoveryContextPayload["filters"]) {
  return Boolean(filters.tag || filters.languages?.length || filters.yearFrom || filters.yearTo || filters.types?.length || filters.availabilities?.length);
}

export function createDiscoveryContext(originSlug: string, filters: SearchResourcesQuery) {
  const payload: DiscoveryContextPayload = {
    version: 1,
    originSlug,
    filters: {
      tag: filters.tag,
      languages: filters.languages,
      yearFrom: filters.yearFrom,
      yearTo: filters.yearTo,
      types: filters.types,
      availabilities: filters.availabilities,
    },
    issuedAt: Date.now(),
    expiresAt: Date.now() + 5 * 60 * 1000,
  };
  if (!hasHardFilters(payload.filters)) return null;
  const encryptionKey = key();
  if (!encryptionKey) throw new DiscoveryContextConfigurationError();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}

export function readDiscoveryContext(token: string, originSlug: string): DiscoveryContextPayload | null {
  const encryptionKey = key();
  if (!encryptionKey) return null;
  try {
    const input = Buffer.from(token, "base64url");
    const iv = input.subarray(0, 12);
    const tag = input.subarray(12, 28);
    const ciphertext = input.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey, iv);
    decipher.setAuthTag(tag);
    const parsed = discoveryContextPayloadSchema.safeParse(
      JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")),
    );
    if (!parsed.success || parsed.data.originSlug !== originSlug || parsed.data.expiresAt < Date.now()) return null;
    return parsed.data;
  } catch { return null; }
}
