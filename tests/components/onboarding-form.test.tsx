// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OnboardingForm } from "@/components/reader-profile/onboarding-form";

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "reader-token" } } }) },
  }),
}));

const tags = [
  { id: "11111111-1111-4111-8111-111111111111", name: "设计", slug: "design", category: "discipline" },
  { id: "22222222-2222-4222-8222-222222222222", name: "文学", slug: "literature", category: "discipline" },
  { id: "33333333-3333-4333-8333-333333333333", name: "城市", slug: "city", category: "discipline" },
];

describe("OnboardingForm", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn((input: string) => Promise.resolve(new Response(JSON.stringify(input === "/api/reader-profile"
      ? { data: { status: "incomplete", preferences: null } }
      : { data: { items: tags.map((tag) => ({ tags: [tag] })) } }), { status: 200 }))));
  });

  it("requires explicit consent before allowing a completed preference profile to be saved", async () => {
    render(<OnboardingForm />);
    await waitFor(() => expect(screen.getByLabelText("设计")).toBeTruthy());

    tags.forEach((tag) => fireEvent.click(screen.getByLabelText(tag.name)));
    fireEvent.click(screen.getByRole("button", { name: "下一步" }));

    const save = screen.getByRole("button", { name: "保存偏好" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText(/我同意将上述兴趣标签/));
    expect(save.disabled).toBe(false);
  });
});
