// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SearchFilters } from "@/components/resources/search-filters";

const navigation = vi.hoisted(() => ({
  params: "yearFrom=2000&yearTo=2020",
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/search",
  useRouter: () => ({ push: navigation.push }),
  useSearchParams: () => new URLSearchParams(navigation.params),
}));

describe("SearchFilters", () => {
  afterEach(() => {
    cleanup();
    navigation.params = "yearFrom=2000&yearTo=2020";
    navigation.push.mockClear();
  });

  it("keeps year inputs synchronized with URL filter changes", async () => {
    const view = render(<SearchFilters />);
    const from = screen.getByLabelText("最早年份") as HTMLInputElement;
    const to = screen.getByLabelText("最晚年份") as HTMLInputElement;

    expect(from.value).toBe("2000");
    expect(to.value).toBe("2020");

    navigation.params = "";
    view.rerender(<SearchFilters />);

    await waitFor(() => {
      expect((screen.getByLabelText("最早年份") as HTMLInputElement).value).toBe("");
      expect((screen.getByLabelText("最晚年份") as HTMLInputElement).value).toBe("");
    });
  });
});
