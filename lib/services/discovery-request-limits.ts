import "server-only";

import { createHash } from "node:crypto";
import { isIP } from "node:net";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const WINDOW_SECONDS = 60;
const DEFAULT_REQUESTS_PER_WINDOW = 30;
const DEFAULT_BYTES_PER_WINDOW = 128 * 1024;

export type DiscoveryRequestClaim =
  | { status: "permitted" }
  | { status: "rate_limited"; retryAfterSeconds: number }
  | { status: "unavailable" };

function positiveEnvironmentInteger(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function normalizedIp(value: string) {
  const version = isIP(value);
  if (version === 4) {
    return value.split(".").map((part) => String(Number(part))).join(".");
  }
  if (version === 6) {
    return new URL(`http://[${value}]/`).hostname.slice(1, -1).toLowerCase();
  }
  return null;
}

export function requesterIdentity(request: Request) {
  if (process.env.TRUST_PROXY !== "true") return "anonymous";
  const firstForwarded = request.headers.get("x-forwarded-for")
    ?.split(",", 1)[0]
    ?.trim();
  if (!firstForwarded) return "anonymous";
  const ip = normalizedIp(firstForwarded);
  return ip ? `ip:${ip}` : "anonymous";
}

function identityHash(identity: string) {
  const salt = process.env.DISCOVERY_LIMIT_HASH_SALT;
  if (!salt) return null;
  return createHash("sha256").update(`${salt}:${identity}`).digest("hex");
}

export async function claimDiscoveryRequest(
  identity: string,
  requestBytes: number,
): Promise<DiscoveryRequestClaim> {
  const hash = identityHash(identity);
  if (!hash) return { status: "unavailable" };

  try {
    const { data, error } = await createSupabaseServerClient().rpc(
      "claim_discovery_request",
      {
        p_identity_hash: hash,
        p_request_bytes: requestBytes,
        p_request_limit: positiveEnvironmentInteger(
          "DISCOVERY_ENTRY_REQUESTS_PER_MINUTE",
          DEFAULT_REQUESTS_PER_WINDOW,
        ),
        p_byte_limit: positiveEnvironmentInteger(
          "DISCOVERY_ENTRY_BYTES_PER_MINUTE",
          DEFAULT_BYTES_PER_WINDOW,
        ),
        p_window_seconds: WINDOW_SECONDS,
      },
    );
    const result = Array.isArray(data) ? data[0] : null;
    if (error || !result || typeof result.permitted !== "boolean") {
      return { status: "unavailable" };
    }
    if (result.permitted) return { status: "permitted" };

    const retryAfterSeconds = Number(result.retry_after_seconds);
    if (!Number.isSafeInteger(retryAfterSeconds) || retryAfterSeconds < 1) {
      return { status: "unavailable" };
    }
    return { status: "rate_limited", retryAfterSeconds };
  } catch {
    return { status: "unavailable" };
  }
}
