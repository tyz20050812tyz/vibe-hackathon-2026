import { createCipheriv, createDecipheriv } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDiscoveryContext,
  readDiscoveryContext,
} from "../../lib/discovery-context";
import { DISCOVERY_CONTEXT_TTL_MS } from "../../lib/schemas/resources";

const encryptionKey = Buffer.alloc(32, 7);
const now = new Date("2026-08-26T08:00:00.000Z");

function decrypt(token: string) {
  const input = Buffer.from(token, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey, input.subarray(0, 12));
  decipher.setAuthTag(input.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([
      decipher.update(input.subarray(28)),
      decipher.final(),
    ]).toString("utf8"),
  ) as Record<string, unknown>;
}

function encrypt(payload: unknown) {
  const iv = Buffer.alloc(12, 3);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
}

function payload(filters: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const issuedAt = now.getTime();
  return {
    version: 1,
    originSlug: "the-creative-act",
    filters,
    issuedAt,
    expiresAt: issuedAt + DISCOVERY_CONTEXT_TTL_MS,
    ...extra,
  };
}

describe("discovery context", () => {
  beforeEach(() => {
    process.env.DISCOVERY_CONTEXT_ENCRYPTION_KEY = encryptionKey.toString("base64");
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete process.env.DISCOVERY_CONTEXT_ENCRYPTION_KEY;
  });

  it("signs and reads a strict five-minute context using one clock reading", () => {
    const clock = vi.spyOn(Date, "now");
    const token = createDiscoveryContext("the-creative-act", {
      languages: ["zh"],
      yearFrom: 1000,
      yearTo: 2100,
    });

    expect(token).toEqual(expect.any(String));
    expect(clock).toHaveBeenCalledOnce();
    const decoded = decrypt(token as string);
    expect(decoded.expiresAt).toBe((decoded.issuedAt as number) + DISCOVERY_CONTEXT_TTL_MS);
    expect(readDiscoveryContext(token as string, "the-creative-act")).toMatchObject({
      filters: { languages: ["zh"], yearFrom: 1000, yearTo: 2100 },
    });
  });

  it("rejects a tampered token, the wrong origin, and a token at its expiry", () => {
    const token = createDiscoveryContext("the-creative-act", { tag: "design" }) as string;
    const bytes = Buffer.from(token, "base64url");
    bytes[bytes.length - 1] ^= 1;

    expect(readDiscoveryContext(bytes.toString("base64url"), "the-creative-act")).toBeNull();
    expect(readDiscoveryContext(token, "another-resource")).toBeNull();
    vi.setSystemTime(now.getTime() + DISCOVERY_CONTEXT_TTL_MS);
    expect(readDiscoveryContext(token, "the-creative-act")).toBeNull();
  });

  it("rejects malformed token input", () => {
    expect(readDiscoveryContext("not-a-valid-encrypted-context", "the-creative-act")).toBeNull();
  });

  it.each([
    ["empty hard filters", {}],
    ["reversed years", { yearFrom: 2000, yearTo: 1999 }],
    ["duplicate language", { languages: ["zh", "zh"] }],
    ["duplicate type", { types: ["book", "book"] }],
    ["duplicate availability", { availabilities: ["online", "online"] }],
    ["invalid tag slug", { tag: "Not a slug" }],
  ])("rejects %s", (_name, filters) => {
    expect(readDiscoveryContext(encrypt(payload(filters)), "the-creative-act")).toBeNull();
  });

  it("rejects non-whitelisted payload fields", () => {
    for (const forbidden of ["q", "userId", "email", "readingProfile", "bearer", "favoriteBooks"]) {
      expect(
        readDiscoveryContext(
          encrypt(payload({ tag: "design" }, { [forbidden]: "sensitive" })),
          "the-creative-act",
        ),
      ).toBeNull();
    }
    expect(
      readDiscoveryContext(
        encrypt(payload({ tag: "design", q: "secret query" })),
        "the-creative-act",
      ),
    ).toBeNull();
  });

  it("does not sign empty or invalid hard filters", () => {
    expect(createDiscoveryContext("the-creative-act", {})).toBeNull();
    expect(createDiscoveryContext("the-creative-act", { yearFrom: 2000, yearTo: 1900 })).toBeNull();
    expect(createDiscoveryContext("the-creative-act", { languages: ["zh", "zh"] })).toBeNull();
  });

  it("keeps filter and identity secrets out of the token and signed payload", () => {
    const input = {
      q: "secret query",
      tag: "design",
      userId: "private-user",
      email: "reader@example.com",
      bearer: "secret-bearer",
    };
    const token = createDiscoveryContext("the-creative-act", input) as string;
    const decoded = decrypt(token);

    expect(token).not.toContain(input.q);
    expect(token).not.toContain(input.email);
    expect(token).not.toContain(input.bearer);
    expect(decoded).not.toHaveProperty("q");
    expect(decoded).not.toHaveProperty("userId");
    expect(decoded).not.toHaveProperty("email");
    expect(decoded).not.toHaveProperty("bearer");
    expect(decoded.filters).toEqual({ tag: "design" });
  });
});
