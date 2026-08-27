import { expect, test, type Route } from "@playwright/test";

const aiTag = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "人工智能", slug: "artificial-intelligence", category: "discipline" };
const designTag = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "设计", slug: "design", category: "discipline" };

const source = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "book-map-source",
  type: "book",
  title: "The Age of AI",
  creators: ["Henry A. Kissinger"],
  publishedYear: 2021,
  languages: ["en"],
  summary: "一部用于书籍气泡关联图端到端测试的图书。",
  coverUrl: null,
  availability: "online",
  tags: [aiTag],
};

const related = {
  ...source,
  id: "22222222-2222-4222-8222-222222222222",
  slug: "book-map-related",
  title: "How to Create a Mind",
  creators: ["Ray Kurzweil"],
  tags: [aiTag, designTag],
};

const unrelated = {
  ...source,
  id: "33333333-3333-4333-8333-333333333333",
  slug: "book-map-unrelated",
  title: "Invisible Cities",
  creators: ["Italo Calvino"],
  tags: [designTag],
};

async function json(route: Route, body: unknown) {
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
}

test("a reader can choose a book and inspect its explainable local bubble graph", async ({ page }) => {
  await page.route(/\/api\/resources(?:\?.*)?$/, async (route) => {
    await json(route, { data: { items: [source, related, unrelated], total: 3, appliedFilters: { q: "", tag: null, languages: [], yearFrom: null, yearTo: null, types: ["book"], availabilities: [] }, appliedSort: "catalog", personalization: "catalog" }, requestId: "catalog" });
  });
  await page.route(/\/api\/resources\/book-map-source\/constellation/, async (route) => {
    await json(route, { data: { centerResourceId: source.id, nodes: [{ resource: source, hop: 0, relationStrength: null, relationTypes: [], isSaved: false, affinity: null }, { resource: related, hop: 1, relationStrength: 5, relationTypes: ["same_theme", "unexpected_bridge"], isSaved: true, affinity: 0.75 }], edges: [{ id: "relation", sourceResourceId: source.id, targetResourceId: related.id, relationType: "same_theme", explanation: "人工策展关系。", strength: 5, direction: "outbound" }, { id: "return-relation", sourceResourceId: related.id, targetResourceId: source.id, relationType: "unexpected_bridge", explanation: "从另一方向的策展连接。", strength: 3, direction: "inbound" }], hasMoreSecondHop: false, personalization: "profile" }, requestId: "relations" });
  });

  await page.goto("/book-map");
  await expect(page.getByRole("heading", { name: "从一条资源，展开它的探索邻域" })).toBeVisible();
  await page.getByLabel("输入资源名称").fill("Age of AI");
  await page.getByRole("button", { name: /The Age of AI/ }).click();

  await expect(page.getByLabel("资源关联气泡图")).toBeVisible();
  await expect(page.getByText("How to Create a Mind")).toBeVisible();
  await expect(page.locator('line[data-relation-type="same_theme"]')).toHaveAttribute("marker-end", "url(#relation-arrow-same_theme)");
  await expect(page.locator('line[data-relation-type="same_theme"]')).toHaveAttribute("data-source-resource-id", source.id);
  await expect(page.locator('line[data-relation-type="same_theme"]')).toHaveAttribute("data-target-resource-id", related.id);
  await expect(page.locator('line[data-relation-type="same_theme"]')).toHaveAttribute("stroke", "#d3dfd9");
  await expect(page.locator('line[data-relation-type="unexpected_bridge"]')).toHaveAttribute("marker-end", "url(#relation-arrow-unexpected_bridge)");
  await expect(page.locator('line[data-relation-type="unexpected_bridge"]')).toHaveAttribute("stroke", "#b28cc7");
  await expect(page.locator('line[data-relation-type="unexpected_bridge"]')).toHaveAttribute("stroke-dasharray", "12 4 2 4");
  await page.getByRole("button", { name: "放大气泡图" }).click();
  await expect(page.getByLabel("资源关联气泡图").locator(":scope > div").last()).toHaveAttribute("style", /scale\(1.15\)/);

  const sourceBubble = page.getByLabel("资源关联气泡图").getByRole("button", { name: "The Age of AI", exact: true });
  const sourceBox = await sourceBubble.boundingBox();
  expect(sourceBox).not.toBeNull();
  await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(sourceBox!.x + sourceBox!.width / 2 + 70, sourceBox!.y + sourceBox!.height / 2 + 25);
  await page.mouse.up();
  await expect.poll(async () => (await sourceBubble.boundingBox())?.x).not.toBe(sourceBox!.x);

  await page.getByLabel("资源关联气泡图").getByRole("button", { name: "How to Create a Mind", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "How to Create a Mind" })).toBeVisible();
  await expect(page.getByText("人工策展关系。")).toBeVisible();
  await expect(page.getByText("人工关系强度 5/5")).toBeVisible();
  await expect(page.getByText("阅读偏好匹配度 75%")).toBeVisible();
  await expect(page.getByRole("button", { name: "已收藏" })).toBeDisabled();
  await expect(page.getByLabel("资源关联气泡图").getByRole("button", { name: "How to Create a Mind", exact: true })).toHaveAttribute("style", /brightness\(1.105\)/);
  await page.screenshot({ path: "test-results/book-map.png", fullPage: true });

  await page.getByRole("button", { name: "关闭资源详情" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  const bubbleGraph = page.getByLabel("资源关联气泡图");
  await expect(bubbleGraph).toBeVisible();
  const graphBox = await bubbleGraph.boundingBox();
  expect(graphBox).not.toBeNull();
  for (const title of ["The Age of AI", "How to Create a Mind"]) {
    const bubbleBox = await bubbleGraph.getByRole("button", { name: title, exact: true }).boundingBox();
    expect(bubbleBox).not.toBeNull();
    expect(bubbleBox!.x).toBeGreaterThanOrEqual(graphBox!.x);
    expect(bubbleBox!.y).toBeGreaterThanOrEqual(graphBox!.y);
    expect(bubbleBox!.x + bubbleBox!.width).toBeLessThanOrEqual(graphBox!.x + graphBox!.width);
    expect(bubbleBox!.y + bubbleBox!.height).toBeLessThanOrEqual(graphBox!.y + graphBox!.height);
  }
  await bubbleGraph.getByRole("button", { name: "How to Create a Mind", exact: true }).click();
  await expect(page.getByText("人工策展关系。")).toBeVisible();
  await page.screenshot({ path: "test-results/book-map-mobile.png", fullPage: true });

  await page.goto("/resources/book-map-source/constellation");
  await expect(page.getByRole("heading", { name: "从一条资源，展开它的探索邻域" })).toBeVisible();
  await expect(page.getByLabel("资源关联气泡图")).toBeVisible();
  await expect(page.getByText("资源星图")).toHaveCount(0);
});

test("shows the relation API error instead of creating inferred edges", async ({ page }) => {
  await page.route(/\/api\/resources(?:\?.*)?$/, async (route) => {
    await json(route, { data: { items: [source, related], total: 2, appliedFilters: { q: "", tag: null, languages: [], yearFrom: null, yearTo: null, types: ["book"], availabilities: [] }, appliedSort: "catalog", personalization: "catalog" }, requestId: "catalog" });
  });
  await page.route(/\/api\/resources\/book-map-source\/constellation/, async (route) => {
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ data: null, error: { code: "SUPABASE_UNAVAILABLE", message: "人工关系服务暂时不可用。" }, requestId: "relations" }) });
  });

  await page.goto("/book-map");
  await page.getByRole("button", { name: /The Age of AI/ }).click();

  await expect(page.getByRole("status")).toHaveText("人工关系服务暂时不可用。");
  await expect(page.getByLabel("资源关联气泡图")).toHaveCount(0);
});

test("keeps the latest selected book when an earlier relation request resolves later", async ({ page }) => {
  const second = { ...related, id: "44444444-4444-4444-8444-444444444444", slug: "book-map-second", title: "Second Center" };
  let releaseFirst: (() => void) | undefined;
  await page.route(/\/api\/resources(?:\?.*)?$/, async (route) => {
    await json(route, { data: { items: [source, second], total: 2, appliedFilters: { q: "", tag: null, languages: [], yearFrom: null, yearTo: null, types: ["book"], availabilities: [] }, appliedSort: "catalog", personalization: "catalog" }, requestId: "catalog" });
  });
  await page.route(/\/api\/resources\/book-map-source\/constellation/, async (route) => {
    await new Promise<void>((resolve) => { releaseFirst = resolve; });
    await json(route, { data: { centerResourceId: source.id, nodes: [{ resource: source, hop: 0, relationStrength: null, relationTypes: [], isSaved: false, affinity: null }], edges: [], hasMoreSecondHop: false, personalization: "catalog" }, requestId: "first" });
  });
  await page.route(/\/api\/resources\/book-map-second\/constellation/, async (route) => {
    await json(route, { data: { centerResourceId: second.id, nodes: [{ resource: second, hop: 0, relationStrength: null, relationTypes: [], isSaved: false, affinity: null }], edges: [], hasMoreSecondHop: false, personalization: "catalog" }, requestId: "second" });
  });

  await page.goto("/book-map");
  await page.getByRole("button", { name: /The Age of AI/ }).click();
  await page.getByRole("button", { name: /Second Center/ }).click();
  await expect(page.getByLabel("资源关联气泡图").getByRole("button", { name: "Second Center", exact: true })).toBeVisible();
  releaseFirst?.();
  await expect(page.getByLabel("资源关联气泡图").getByRole("button", { name: "Second Center", exact: true })).toBeVisible();
});

test("opens the relation map from a public non-book resource", async ({ page }) => {
  const paper = {
    ...source,
    id: "55555555-5555-4555-8555-555555555555",
    slug: "paper-map-source",
    type: "paper",
    title: "Paper Map Source",
  };
  await page.route(/\/api\/resources(?:\?.*)?$/, async (route) => {
    await json(route, { data: { items: [paper, related], total: 2, appliedFilters: { q: "", tag: null, languages: [], yearFrom: null, yearTo: null, types: [], availabilities: [] }, appliedSort: "catalog", personalization: "catalog" }, requestId: "catalog" });
  });
  await page.route(/\/api\/resources\/paper-map-source$/, async (route) => {
    await json(route, { data: { resource: { ...paper, subtitle: null, location: null, externalUrl: null, isFeatured: false }, related: [] }, requestId: "resource" });
  });
  await page.route(/\/api\/resources\/paper-map-source\/constellation/, async (route) => {
    await json(route, { data: { centerResourceId: paper.id, nodes: [{ resource: paper, hop: 0, relationStrength: null, relationTypes: [], isSaved: false, affinity: null }], edges: [], hasMoreSecondHop: false, personalization: "catalog" }, requestId: "relations" });
  });

  await page.goto("/resources/paper-map-source");
  await expect(page.getByRole("link", { name: "打开资源关联图" })).toBeVisible();
  await page.getByRole("link", { name: "打开资源关联图" }).click();
  await expect(page).toHaveURL(/\/resources\/paper-map-source\/constellation$/);
  await expect(page.getByLabel("资源关联气泡图").getByRole("button", { name: "Paper Map Source", exact: true })).toBeVisible();
});
