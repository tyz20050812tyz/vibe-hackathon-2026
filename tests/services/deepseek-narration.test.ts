import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  claim: vi.fn(),
  complete: vi.fn(),
  from: vi.fn(),
  client: { from: vi.fn() },
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/services/request-limits", () => ({
  claimModelAttempt: mocks.claim,
  completeModelAttempt: mocks.complete,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createServerClient,
}));

import { narrateWithDeepSeek } from "../../lib/services/deepseek-narration";

const input = {
  originResourceId: "00000000-0000-4000-8000-000000000001",
  targetResourceId: "00000000-0000-4000-8000-000000000002",
  relationId: "00000000-0000-4000-8000-000000000003",
  relationType: "unexpected_bridge" as const,
  relationExplanation: "从创作中的规则问题转向观察图像中的偶然性，并保留人工关系解释。",
  mode: "surprise" as const,
  personalization: "catalog" as const,
  origin: { title: "Origin", summary: "Origin summary", tags: ["设计"] },
  target: { title: "Target", summary: "Target summary", tags: ["创造力"] },
  identity: "anonymous",
  authenticated: false,
};

function cacheClient(value: { narration: string | null; expires_at: string } | null = null) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: value, error: null }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
  };
  mocks.createServerClient.mockReturnValue({ from: vi.fn().mockReturnValue(query) });
  return query;
}

describe("DeepSeek narration adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DEEPSEEK_ENABLED;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.DISCOVERY_LIMIT_HASH_SALT;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.DEEPSEEK_ENABLED;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.DISCOVERY_LIMIT_HASH_SALT;
  });

  it("is disabled by default and returns the fact-checked relation explanation", async () => {
    await expect(narrateWithDeepSeek(input)).resolves.toEqual({
      narration: input.relationExplanation,
      source: "template",
      skippedReason: "disabled",
    });
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses a validated provider response and never sends identity fields to the provider", async () => {
    process.env.DEEPSEEK_ENABLED = "true";
    process.env.DEEPSEEK_API_KEY = "test-key";
    process.env.DISCOVERY_LIMIT_HASH_SALT = "test-salt";
    cacheClient();
    mocks.claim.mockResolvedValue({ permitted: true });
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ narration: "从创作规则的提问转向图像偶然性的观察，让读者在两个问题之间建立自己的路径。" }) } }],
    }), { status: 200 }));

    const result = await narrateWithDeepSeek(input);
    expect(result).toEqual({
      narration: "从创作规则的提问转向图像偶然性的观察，让读者在两个问题之间建立自己的路径。",
      source: "deepseek",
    });
    expect(mocks.complete).toHaveBeenCalledWith(true);
    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
    expect(JSON.stringify(body)).not.toContain(input.identity);
    expect(JSON.stringify(body)).not.toContain("originResourceId");
  });

  it("falls back when the provider response is invalid and caches that failure briefly", async () => {
    process.env.DEEPSEEK_ENABLED = "true";
    process.env.DEEPSEEK_API_KEY = "test-key";
    process.env.DISCOVERY_LIMIT_HASH_SALT = "test-salt";
    const query = cacheClient();
    mocks.claim.mockResolvedValue({ permitted: true });
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ narration: "太短" }) } }],
    }), { status: 200 }));

    await expect(narrateWithDeepSeek(input)).resolves.toMatchObject({
      narration: input.relationExplanation,
      source: "template",
      skippedReason: "provider_failure",
    });
    expect(mocks.complete).toHaveBeenCalledWith(false);
    expect(query.upsert).toHaveBeenCalledWith(expect.objectContaining({ narration: null }));
  });

  it("uses cached model narration without consuming another model attempt", async () => {
    process.env.DEEPSEEK_ENABLED = "true";
    process.env.DEEPSEEK_API_KEY = "test-key";
    process.env.DISCOVERY_LIMIT_HASH_SALT = "test-salt";
    cacheClient({ narration: "从规则的约束转向图像偶然性的观察，让读者沿着关系说明继续展开新的问题。", expires_at: new Date(Date.now() + 60_000).toISOString() });

    await expect(narrateWithDeepSeek(input)).resolves.toMatchObject({ source: "deepseek" });
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
