// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DiscoveryPanel } from "@/components/resources/discovery-panel";

const getSession = vi.fn();

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({ auth: { getSession } }),
}));

vi.mock("@/components/resources/save-resource-button", () => ({
  SaveResourceButton: () => <span>收藏到书架</span>,
}));

describe("DiscoveryPanel", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    getSession.mockResolvedValue({ data: { session: null } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: {
        originResourceId: "11111111-1111-4111-8111-111111111111",
        selectedMode: "surprise",
        usedRelationType: null,
        constrainedBySourceFilters: false,
        personalization: "catalog",
        recommendation: null,
      },
    }), { status: 200 })));
  });

  it("exposes free and constrained discovery as explicit source modes", async () => {
    render(<DiscoveryPanel originResourceId="11111111-1111-4111-8111-111111111111" discoveryContext="sealed-context" />);

    const constrained = screen.getByRole("button", { name: "在当前筛选内偏离" });
    expect(screen.getByRole("button", { name: "自由偏离" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(constrained);
    fireEvent.click(screen.getByRole("button", { name: "开始发现" }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)).toMatchObject({ discoveryContext: "sealed-context" });
  });

  it("disables constrained mode without a signed context while free discovery remains available", () => {
    render(<DiscoveryPanel originResourceId="11111111-1111-4111-8111-111111111111" discoveryContext={null} />);

    expect((screen.getByRole("button", { name: "自由偏离" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "在当前筛选内偏离" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("falls back to free discovery when the signed context has expired", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: null,
      error: { code: "INVALID_DISCOVERY_CONTEXT", message: "expired" },
    }), { status: 400 })));
    render(<DiscoveryPanel originResourceId="11111111-1111-4111-8111-111111111111" discoveryContext="expired-context" />);

    fireEvent.click(screen.getByRole("button", { name: "在当前筛选内偏离" }));
    fireEvent.click(screen.getByRole("button", { name: "开始发现" }));

    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("已切回自由偏离"));
    expect(screen.getByRole("button", { name: "自由偏离" }).getAttribute("aria-pressed")).toBe("true");
  });
});
