import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import {
  DISCOVERY_CONTEXT_TTL_MS,
  discoveryContextPayloadSchema,
  type DiscoveryContextPayloadInput,
} from "@/lib/schemas/resources";
import type { SearchResourcesQuery } from "@/lib/types/resources";

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

export function createDiscoveryContext(originSlug: string, filters: SearchResourcesQuery) {
  const issuedAt = Date.now();
  const parsed = discoveryContextPayloadSchema.safeParse({
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
    issuedAt,
    expiresAt: issuedAt + DISCOVERY_CONTEXT_TTL_MS,
  });
  if (!parsed.success) return null;
  const encryptionKey = key();
  if (!encryptionKey) throw new DiscoveryContextConfigurationError();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(parsed.data), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}

export function readDiscoveryContext(token: string, originSlug: string): DiscoveryContextPayloadInput | null {
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
    if (!parsed.success || parsed.data.originSlug !== originSlug || parsed.data.expiresAt <= Date.now()) return null;
    return parsed.data;
  } catch { return null; }
}
