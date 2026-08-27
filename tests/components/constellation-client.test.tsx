// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConstellationClient } from "@/components/resources/constellation-client";

const getSession = vi.fn();

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({ auth: { getSession } }),
}));

const payload = {
  data: {
    centerResourceId: "center-id",
    personalization: "catalog" as const,
    hasMoreSecondHop: false,
    nodes: [
      { resource: { id: "center-id", slug: "center", type: "book", title: "起点", creators: ["策展人"], publishedYear: null, languages: ["zh"], summary: "", coverUrl: null, availability: "online", tags: [] }, hop: 0 as const, relationStrength: null, relationTypes: [], isSaved: false, affinity: null },
      { resource: { id: "theme-id", slug: "theme", type: "paper", title: "同一主题", creators: ["作者甲"], publishedYear: 2024, languages: ["zh"], summary: "", coverUrl: null, availability: "online", tags: [] }, hop: 1 as const, relationStrength: 5, relationTypes: ["same_theme" as const], isSaved: false, affinity: null },
      { resource: { id: "bridge-id", slug: "bridge", type: "talk", title: "意外桥接", creators: ["作者乙"], publishedYear: 2025, languages: ["zh"], summary: "", coverUrl: null, availability: "online", tags: [] }, hop: 1 as const, relationStrength: 3, relationTypes: ["unexpected_bridge" as const], isSaved: false, affinity: null },
    ],
    edges: [
      { id: "edge-theme", sourceResourceId: "center-id", targetResourceId: "theme-id", relationType: "same_theme" as const, explanation: "主题延展的人工解释。", strength: 5, direction: "outbound" as const },
      { id: "edge-bridge", sourceResourceId: "bridge-id", targetResourceId: "center-id", relationType: "unexpected_bridge" as const, explanation: "一条意外路径。", strength: 3, direction: "inbound" as const },
    ],
  },
  requestId: "request-id",
};

describe("ConstellationClient", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    getSession.mockResolvedValue({ data: { session: null } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } })));
  });

  it("loads the frozen depth-one endpoint and filters relation types", async () => {
    render(<ConstellationClient slug="center" />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "从一本书，看见它的邻近宇宙" })).toBeTruthy());
    expect(fetch).toHaveBeenCalledWith("/api/resources/center/constellation?depth=1", expect.objectContaining({ cache: "no-store" }));

    fireEvent.click(screen.getByRole("button", { name: "同一主题" }));
    expect(screen.getAllByRole("button", { name: "同一主题" }).every((button) => button.getAttribute("aria-pressed") === "false")).toBe(true);
  });

  it("shows a retriable error without exposing a failed graph", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: null, error: { message: "服务暂不可用" } }), { status: 503, headers: { "Content-Type": "application/json" } })));
    render(<ConstellationClient slug="center" />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "星图暂时无法展开" })).toBeTruthy());
    expect(screen.getByText("服务暂不可用")).toBeTruthy();
    expect(screen.getByRole("button", { name: "重新载入" })).toBeTruthy();
  });

  it("does not expose a JSON parser error when an unavailable route responds with HTML", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<!doctype html><title>Not found</title>", { status: 404, headers: { "Content-Type": "text/html" } })));
    render(<ConstellationClient slug="center" />);

    await waitFor(() => expect(screen.getByText("星图服务返回了非预期响应，请稍后重试。")).toBeTruthy());
    expect(screen.queryByText(/Unexpected token/)).toBeNull();
  });
});
