import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createDemoRecord: vi.fn(),
  listDemoRecords: vi.fn(),
}));

vi.mock("@/lib/services/demo-records", () => ({
  createDemoRecord: mocks.createDemoRecord,
  listDemoRecords: mocks.listDemoRecords,
}));

import { GET, POST } from "../../app/api/demo-records/route";

const record = {
  id: "00000000-0000-4000-8000-000000000001",
  content: "演练记录",
  createdAt: "2026-08-28T00:00:00.000Z",
};

function post(body: string) {
  return new Request("http://localhost/api/demo-records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("demo records API environment boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "development");
    mocks.listDemoRecords.mockResolvedValue([record]);
    mocks.createDemoRecord.mockResolvedValue(record);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(["GET", "POST"] as const)(
    "returns 404 for production %s before calling the demo service",
    async (method) => {
      vi.stubEnv("NODE_ENV", "production");

      const response = method === "GET"
        ? await GET()
        : await POST(post("{"));
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(body).toMatchObject({
        data: null,
        error: { code: "RESOURCE_NOT_FOUND" },
        requestId: expect.any(String),
      });
      expect(mocks.listDemoRecords).not.toHaveBeenCalled();
      expect(mocks.createDemoRecord).not.toHaveBeenCalled();
    },
  );

  it("keeps development GET behavior", async () => {
    const response = await GET();

    expect(mocks.listDemoRecords).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [record],
      requestId: expect.any(String),
    });
  });

  it("keeps development POST behavior", async () => {
    const response = await POST(post(JSON.stringify({ content: " 演练记录 " })));

    expect(mocks.createDemoRecord).toHaveBeenCalledWith("演练记录");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: record,
      requestId: expect.any(String),
    });
  });

  it("keeps development invalid JSON and Zod validation behavior", async () => {
    const invalidJson = await POST(post("{"));
    const invalidPayload = await POST(post(JSON.stringify({ content: "   " })));

    expect(invalidJson.status).toBe(400);
    expect((await invalidJson.json()).error.code).toBe("INVALID_JSON");
    expect(invalidPayload.status).toBe(400);
    expect((await invalidPayload.json()).error.code).toBe("VALIDATION_ERROR");
    expect(mocks.createDemoRecord).not.toHaveBeenCalled();
  });
});
