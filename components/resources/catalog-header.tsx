"use client";

import Link from "next/link";
import { Bookmark, Network, Search, SlidersHorizontal, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

import type { ApiFailure, ApiSuccess } from "@/lib/types/api";
import type { ProfileOverview } from "@/lib/types/profile";

type ProfileResponse = ApiSuccess<ProfileOverview> | ApiFailure;

export function CatalogHeader() {
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let requestSequence = 0;
    const refresh = async () => {
      const sequence = ++requestSequence;
      try {
        const response = await fetch("/api/profile", { cache: "no-store" });
        const body = await response.json() as ProfileResponse;
        if (!active || sequence !== requestSequence) return;
        if (response.ok && body.data) {
          const profile = body.data.profile;
          setDisplayName(profile.displayName ?? profile.email.split("@", 1)[0] ?? null);
        } else setDisplayName(null);
      } catch { if (active && sequence === requestSequence) setDisplayName(null); }
    };
    void refresh();
    window.addEventListener("library-auth-changed", refresh);
    return () => { active = false; window.removeEventListener("library-auth-changed", refresh); };
  }, []);

  const label = displayName ?? "个人中心";
  return <header className="border-b border-[#254a42]/20 bg-[#fff8e9]"><div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8"><Link href="/" className="font-serif text-xl text-[#172d29]">书外之遇</Link><nav className="flex items-center gap-1" aria-label="主导航"><Link href="/search" className="inline-flex h-9 items-center gap-1.5 px-3 text-sm text-[#254a42] hover:bg-[#e4e7d4]"><Search className="size-4" />找资源</Link><Link href="/book-map" className="inline-flex size-9 items-center justify-center text-[#254a42] hover:bg-[#e4e7d4]" aria-label="书籍关联图"><Network className="size-4" /></Link><Link href="/onboarding" className="inline-flex size-9 items-center justify-center text-[#254a42] hover:bg-[#e4e7d4]" aria-label="阅读偏好"><SlidersHorizontal className="size-4" /></Link><Link href="/library" className="inline-flex h-9 items-center gap-1.5 px-2 text-sm text-[#254a42] hover:bg-[#e4e7d4]"><span className="grid size-7 place-items-center rounded-full border border-[#254a42]/45 bg-[#e4e7d4]" aria-hidden="true"><UserRound className="size-3.5" /></span><span className="max-w-24 truncate">{label}</span><Bookmark className="size-4" /></Link></nav></div></header>;
}
