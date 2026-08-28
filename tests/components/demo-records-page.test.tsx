import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listDemoRecords: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));

vi.mock("@/lib/services/demo-records", () => ({
  listDemoRecords: mocks.listDemoRecords,
}));

vi.mock("@/components/demo-records-template", () => ({
  DemoRecordsTemplate: () => null,
}));

import DemoRecordsPage from "../../app/demo-records/page";

describe("demo records page environment boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns notFound in production before reading demo records", async () => {
    await expect(DemoRecordsPage()).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mocks.notFound).toHaveBeenCalledOnce();
    expect(mocks.listDemoRecords).not.toHaveBeenCalled();
  });
});
