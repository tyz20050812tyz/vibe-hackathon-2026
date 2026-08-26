// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SaveResourceButton } from "@/components/resources/save-resource-button";

describe("SaveResourceButton", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 201 })));
  });

  it("sends a trimmed optional note with the saved resource", async () => {
    render(<SaveResourceButton resourceId="11111111-1111-4111-8111-111111111111" />);

    fireEvent.change(screen.getByLabelText("留一句笔记（可选）"), { target: { value: "  留给下次阅读  " } });
    fireEvent.click(screen.getByRole("button", { name: "收藏到书架" }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)).toEqual({
      resourceId: "11111111-1111-4111-8111-111111111111",
      note: "留给下次阅读",
    });
  });
});
