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
    await json(route, { data: { centerResourceId: source.id, nodes: [], edges: [{ id: "relation", sourceResourceId: source.id, targetResourceId: related.id, relationType: "same_theme", explanation: "人工策展关系。", strength: 5, direction: "outbound" }], hasMoreSecondHop: false, personalization: "catalog" }, requestId: "relations" });
  });

  await page.goto("/book-map");
  await expect(page.getByRole("heading", { name: "从一本书，展开它的阅读邻域" })).toBeVisible();
  await page.getByLabel("输入图书名称").fill("Age of AI");
  await page.getByRole("button", { name: /The Age of AI/ }).click();

  await expect(page.getByLabel("书籍气泡关联图")).toBeVisible();
  await expect(page.getByText("How to Create a Mind")).toBeVisible();
  await page.getByRole("button", { name: "How to Create a Mind" }).click();
  await expect(page.getByText("存在人工策展关联")).toBeVisible();
  await expect(page.getByText(/^关联度 \d+%$/)).toBeVisible();
  await page.screenshot({ path: "test-results/book-map.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  const bubbleGraph = page.getByLabel("书籍气泡关联图");
  await expect(bubbleGraph).toBeVisible();
  const graphBox = await bubbleGraph.boundingBox();
  expect(graphBox).not.toBeNull();
  for (const title of ["The Age of AI", "How to Create a Mind"]) {
    const bubbleBox = await bubbleGraph.getByRole("button", { name: title }).boundingBox();
    expect(bubbleBox).not.toBeNull();
    expect(bubbleBox!.x).toBeGreaterThanOrEqual(graphBox!.x);
    expect(bubbleBox!.y).toBeGreaterThanOrEqual(graphBox!.y);
    expect(bubbleBox!.x + bubbleBox!.width).toBeLessThanOrEqual(graphBox!.x + graphBox!.width);
    expect(bubbleBox!.y + bubbleBox!.height).toBeLessThanOrEqual(graphBox!.y + graphBox!.height);
  }
  await expect(page.getByText("存在人工策展关联")).toBeVisible();
  await page.screenshot({ path: "test-results/book-map-mobile.png", fullPage: true });
});
