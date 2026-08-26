import { expect, test, type Page, type Route } from "@playwright/test";

const sourceId = "11111111-1111-4111-8111-111111111111";
const firstId = "22222222-2222-4222-8222-222222222222";
const secondId = "33333333-3333-4333-8333-333333333333";
const tagIds = [
  "44444444-4444-4444-8444-444444444444",
  "55555555-5555-4555-8555-555555555555",
  "66666666-6666-4666-8666-666666666666",
];

const tags = [
  { id: tagIds[0], name: "设计", slug: "design", category: "discipline" },
  { id: tagIds[1], name: "城市", slug: "city", category: "theme" },
  { id: tagIds[2], name: "文学", slug: "literature", category: "discipline" },
];

function resource(id: string, title: string) {
  return {
    id,
    slug: id === sourceId ? "e2e-source" : `e2e-${id.slice(0, 4)}`,
    type: "book",
    title,
    creators: ["测试作者"],
    publishedYear: 2024,
    languages: ["zh"],
    summary: "用于端到端冒烟测试的阅读资源。",
    coverUrl: null,
    availability: "online",
    tags,
  };
}

const source = { ...resource(sourceId, "起点资源"), subtitle: null, location: null, externalUrl: null, isFeatured: false };
const first = resource(firstId, "第一条偏离");
const second = resource(secondId, "第二条偏离");

type Scenario = "discovery" | "empty" | "retry" | "personalized";

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function mockApi(page: Page, scenario: Scenario = "discovery") {
  const discoveries: Array<Record<string, unknown>> = [];
  const saves: Array<Record<string, unknown>> = [];
  let profileComplete = false;
  let saved = false;
  let retryCount = 0;

  await page.route(/\/api(?:\/|$)/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname === "/api/profile") {
      await fulfillJson(route, { data: { profile: { id: "reader", email: "reader@example.com", displayName: "测试读者", joinedAt: "2026-08-26T00:00:00.000Z" }, stats: { savedCount: saved ? 1 : 0, notedCount: saved ? 1 : 0, topicCount: saved ? 3 : 0, latestSavedAt: saved ? "2026-08-26T00:00:00.000Z" : null } } });
      return;
    }
    if (url.pathname === "/api/resources/e2e-source") {
      await fulfillJson(route, { data: { resource: source, related: [] } });
      return;
    }
    if (url.pathname === "/api/resources") {
      await fulfillJson(route, { data: { items: tags.map((tag) => ({ tags: [tag] })) } });
      return;
    }
    if (url.pathname === "/api/reader-profile") {
      if (method === "PUT") {
        profileComplete = true;
        await fulfillJson(route, { data: { status: "complete", preferences: { explorationLevel: "balanced", interestTags: tags, favoriteBooks: [], onboardingCompletedAt: "2026-08-26T00:00:00.000Z" } } });
      } else {
        await fulfillJson(route, { data: profileComplete ? { status: "complete", preferences: { explorationLevel: "balanced", interestTags: tags, favoriteBooks: [], onboardingCompletedAt: "2026-08-26T00:00:00.000Z" } } : { status: "incomplete", preferences: null } });
      }
      return;
    }
    if (url.pathname === "/api/saved-resources") {
      if (method === "POST") {
        const body = request.postDataJSON() as Record<string, unknown>;
        saves.push(body);
        saved = true;
        await fulfillJson(route, { data: {} }, 201);
      } else {
        await fulfillJson(route, { data: saved ? [{ resource: source, note: saves[0]?.note ?? null, savedAt: "2026-08-26T00:00:00.000Z" }] : [] });
      }
      return;
    }
    if (url.pathname === "/api/discover") {
      await fulfillJson(route, { data: { source: null, items: [], mode: "empty" } });
      return;
    }
    if (url.pathname === "/api/discoveries") {
      const body = request.postDataJSON() as Record<string, unknown>;
      const authorization = request.headers().authorization;
      discoveries.push({ ...body, authorization });
      if (body.discoveryContext) {
        await fulfillJson(route, { data: null, error: { code: "INVALID_DISCOVERY_CONTEXT", message: "筛选上下文已失效" } }, 400);
        return;
      }
      if (scenario === "empty") {
        await fulfillJson(route, { data: { originResourceId: sourceId, selectedMode: "surprise", usedRelationType: null, constrainedBySourceFilters: false, personalization: "catalog", recommendation: null } });
        return;
      }
      if (scenario === "retry" && retryCount++ === 0) {
        await fulfillJson(route, { data: null, error: { code: "SUPABASE_UNAVAILABLE", message: "发现服务暂时不可用" } }, 503);
        return;
      }
      const recommendation = scenario === "personalized" && authorization?.includes("reader-b")
        ? { resource: second, narrationSource: "template" }
        : { resource: (body.excludeResourceIds as string[] | undefined)?.includes(firstId) ? second : first, narrationSource: "deepseek" };
      await fulfillJson(route, {
        data: {
          originResourceId: sourceId,
          selectedMode: "surprise",
          usedRelationType: "unexpected_bridge",
          constrainedBySourceFilters: false,
          personalization: scenario === "personalized" ? "profile" : "catalog",
          recommendation: { ...recommendation, relationExplanation: "策展关系说明", narration: "沿着这条线索继续阅读。" },
        },
      });
      return;
    }
    await fulfillJson(route, { data: null, error: { code: "NOT_FOUND", message: `未设置的测试接口：${url.pathname}` } }, 404);
  });

  return { discoveries, saves };
}

async function setAuthenticatedSession(page: Page, token: string) {
  await page.addInitScript(({ accessToken }) => {
    const session = JSON.stringify({
      access_token: accessToken,
      refresh_token: "e2e-refresh-token",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: "bearer",
      user: { id: accessToken, email: `${accessToken}@example.com`, aud: "authenticated", role: "authenticated" },
    });
    const encoded = btoa(unescape(encodeURIComponent(session))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    document.cookie = `sb-bxvlyoptaoajmpxifnbz-auth-token=base64-${encoded}; Path=/; SameSite=Lax`;
  }, { accessToken: token });
}

test("anonymous readers fall back from an expired context and do not repeat a discovery", async ({ page }) => {
  const api = await mockApi(page);

  await page.goto("/resources/e2e-source?discoveryContext=expired-context");
  await expect(page.getByRole("heading", { name: "起点资源" })).toBeVisible();
  await page.getByRole("button", { name: "在当前筛选内偏离" }).click();
  await page.getByRole("button", { name: "开始发现" }).click();
  await expect(page.getByRole("status")).toContainText("已切回自由偏离");

  await page.getByRole("button", { name: "开始发现" }).click();
  await expect(page.getByRole("heading", { name: "第一条偏离" })).toBeVisible();
  await expect(page.getByText("DeepSeek 生成引导")).toBeVisible();
  await page.getByRole("button", { name: "再偏一次" }).click();
  await expect(page.getByRole("heading", { name: "第二条偏离" })).toBeVisible();
  expect(api.discoveries.at(-1)?.excludeResourceIds).toEqual([firstId]);
});

test("anonymous context fallback works through the real local catalog and discovery APIs", async ({ page }) => {
  const catalogResponse = await page.request.get("/api/resources?limit=1");
  expect(catalogResponse.ok()).toBeTruthy();
  const catalog = await catalogResponse.json() as { data?: { items?: Array<{ slug: string; title: string }> } };
  const resource = catalog.data?.items?.[0];
  expect(resource).toBeTruthy();
  if (!resource) return;

  await page.goto(`/resources/${resource.slug}?discoveryContext=expired-context`);
  await expect(page.getByRole("heading", { name: resource.title })).toBeVisible();
  await page.getByRole("button", { name: "在当前筛选内偏离" }).click();
  await page.getByRole("button", { name: "开始发现" }).click();
  await expect(page.getByRole("status")).toContainText("已切回自由偏离");
  await expect(page.getByRole("button", { name: "自由偏离" })).toHaveAttribute("aria-pressed", "true");
});

test("discovery renders both empty and retryable failure states", async ({ page }) => {
  await mockApi(page, "empty");
  await page.goto("/resources/e2e-source");
  await page.getByRole("button", { name: "开始发现" }).click();
  await expect(page.getByText("这条线索暂时没有可继续偏离的资源。")).toBeVisible();

  await page.unrouteAll();
  await mockApi(page, "retry");
  await page.reload();
  await page.getByRole("button", { name: "开始发现" }).click();
  await expect(page.getByRole("status")).toContainText("发现服务暂时不可用");
  await page.getByRole("button", { name: "开始发现" }).click();
  await expect(page.getByRole("heading", { name: "第一条偏离" })).toBeVisible();
});

test("an authenticated reader can finish preferences, save a note, and use the shelf", async ({ page }) => {
  await setAuthenticatedSession(page, "reader-a");
  const api = await mockApi(page);

  await page.goto("/onboarding");
  await expect(page.getByLabel("设计")).toBeVisible();
  for (const tag of tags) await page.getByLabel(tag.name).check();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByLabel(/我同意将上述兴趣标签/).check();
  await page.getByRole("button", { name: "保存偏好" }).click();
  await expect(page.getByRole("status")).toContainText("偏好已保存");

  await page.goto("/resources/e2e-source");
  await page.getByLabel("留一句笔记（可选）").first().fill("下次沿着城市主题继续读");
  await page.getByRole("button", { name: "收藏到书架" }).first().click();
  await expect(page.getByRole("status")).toContainText("已保存到个人书架");
  expect(api.saves).toEqual([{ resourceId: sourceId, note: "下次沿着城市主题继续读" }]);

  await page.goto("/library");
  await expect(page.getByRole("heading", { name: "起点资源" })).toBeVisible();
  await expect(page.getByText("下次沿着城市主题继续读")).toBeVisible();
});

test("different authenticated readers receive their own personalized order", async ({ browser }) => {
  for (const [token, title] of [["reader-a", "第一条偏离"], ["reader-b", "第二条偏离"]] as const) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await setAuthenticatedSession(page, token);
    const api = await mockApi(page, "personalized");
    await page.goto("/resources/e2e-source");
    await page.getByRole("button", { name: "开始发现" }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    expect(api.discoveries[0]?.originResourceId).toBe(sourceId);
    await expect.poll(() => api.discoveries[0]?.authorization).toContain(`Bearer ${token}`);
    await context.close();
  }
});
