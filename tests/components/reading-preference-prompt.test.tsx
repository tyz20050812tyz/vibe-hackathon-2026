// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ReadingPreferencePrompt } from "@/components/library/reading-preference-prompt";

describe("ReadingPreferencePrompt", () => {
  afterEach(() => cleanup());

  it("lets an incomplete-profile reader close the current prompt without altering their preferences", () => {
    render(<ReadingPreferencePrompt status="incomplete" />);

    expect(screen.getByRole("link", { name: "开始设置" }).getAttribute("href")).toBe("/onboarding");
    fireEvent.click(screen.getByRole("button", { name: "关闭阅读偏好引导" }));
    expect(screen.queryByLabelText("阅读偏好引导")).toBeNull();
  });

  it("keeps an edit entry for completed preferences", () => {
    render(<ReadingPreferencePrompt status="complete" />);

    expect(screen.getByRole("link", { name: /编辑阅读偏好/ }).getAttribute("href")).toBe("/onboarding");
  });
});
