import { expect, test, type Route } from "@playwright/test";

const center = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "star-origin",
  type: "book",
  title: "星图原点",
  creators: ["测试策展人"],
  publishedYear: 2026,
  languages: ["zh"],
  summary: "一条可用于星图的起点资源。",
  coverUrl: null,
  availability: "online",
  tags: [],
};

const neighbor = {
  ...center,
  id: "22222222-2222-4222-8222-222222222222",
  slug: "star-neighbor",
  title: "同一主题",
  creators: ["测试作者"],
};

async function fulfill(route: Route, body: unknown) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

test("constellation works at desktop and mobile widths against the shared API shape", async ({ page }) => {
  const requests: string[] = [];
  await page.route(/\/api\/resources\/star-origin\/constellation/, async (route) => {
    requests.push(new URL(route.request().url()).search);
    await fulfill(route, {
      data: {
        centerResourceId: center.id,
        personalization: "catalog",
        hasMoreSecondHop: false,
        nodes: [
          { resource: center, hop: 0, relationStrength: null, relationTypes: [], isSaved: false, affinity: null },
          { resource: neighbor, hop: 1, relationStrength: 5, relationTypes: ["same_theme"], isSaved: false, affinity: null },
        ],
        edges: [{ id: "edge-1", sourceResourceId: center.id, targetResourceId: neighbor.id, relationType: "same_theme", explanation: "由人工策展关系提供的主题解释。", strength: 5, direction: "outbound" }],
      },
      requestId: "constellation-e2e",
    });
  });

  await page.goto("/resources/star-origin/constellation");
  await expect(page.getByRole("heading", { name: "从一本书，看见它的邻近宇宙" })).toBeVisible();
  await page.getByRole("button", { name: /1 跳.*同一主题/ }).click();
  await expect(page.getByLabel("资源星图桌面视图").getByText("由人工策展关系提供的主题解释。")).toBeVisible();
  expect(requests).toEqual(["?depth=1"]);
  await page.screenshot({ path: "test-results/constellation-desktop.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByLabel("资源星图移动视图")).toBeVisible();
  await expect(page.getByLabel("星图节点带")).toBeVisible();
  await page.screenshot({ path: "test-results/constellation-mobile.png", fullPage: true });
});
