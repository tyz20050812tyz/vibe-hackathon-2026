"use client";

import Link from "next/link";
import { SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";

export function ReadingPreferencePrompt({ status }: { status: "complete" | "incomplete" | null }) {
  const [dismissed, setDismissed] = useState(false);

  if (status === "complete") {
    return <Link href="/onboarding" className="inline-flex items-center gap-1 text-sm text-[#254a42] underline"><SlidersHorizontal className="size-4" />编辑阅读偏好</Link>;
  }
  if (status !== "incomplete" || dismissed) return null;

  return <aside className="flex flex-wrap items-start justify-between gap-4 border border-[#a23b2c]/35 bg-[#f0efd9] p-4" aria-label="阅读偏好引导">
    <div><p className="text-sm font-medium">完成阅读偏好，开启“与你相关”排序</p><p className="mt-1 text-xs leading-5 text-[#52625d]">这不会影响书架、收藏或公共目录浏览。</p></div>
    <div className="flex items-center gap-2"><Link href="/onboarding" className="inline-flex items-center gap-1 border border-[#254a42] px-3 py-2 text-sm text-[#254a42] hover:bg-[#254a42] hover:text-[#fff8e9]"><SlidersHorizontal className="size-4" />开始设置</Link><button type="button" onClick={() => setDismissed(true)} className="inline-flex size-9 items-center justify-center text-[#52625d] hover:bg-[#e4e7d4]" aria-label="关闭阅读偏好引导"><X className="size-4" /></button></div>
  </aside>;
}
