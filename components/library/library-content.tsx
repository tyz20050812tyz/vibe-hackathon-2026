"use client";

import Link from "next/link";
import { ArrowUpRight, LogOut, NotebookPen, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { DiscoveryCard } from "@/components/library/discovery-card";
import { LibraryStats, type LibraryStatsData } from "@/components/library/library-stats";
import { ProfileSummary } from "@/components/library/profile-summary";
import { ResourceCover } from "@/components/resources/resource-cover";
import { availabilityLabel, resourceTypeLabel } from "@/lib/resource-presentation";
import type { DiscoveryData, DiscoveryItem } from "@/lib/types/discovery";
import type { ApiFailure, ApiSuccess } from "@/lib/types/api";
import type { ProfileOverview, ProfileUpdateRequest, ReaderProfile } from "@/lib/types/profile";
import type { SavedResource } from "@/lib/types/resources";

type LibraryState = "loading" | "unauthenticated" | "success" | "error";
type LibraryView = "all" | "noted" | "online" | "check_library";

type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

function apiMessage<T>(body: ApiEnvelope<T>, fallback: string) {
  return "error" in body ? body.error.message : fallback;
}

const views: Array<{ value: LibraryView; label: string }> = [
  { value: "all", label: "全部" },
  { value: "noted", label: "有笔记" },
  { value: "online", label: "在线可读" },
  { value: "check_library", label: "馆藏待查" },
];

function statsFrom(items: SavedResource[]): LibraryStatsData {
  return {
    savedCount: items.length,
    notedCount: items.filter((item) => Boolean(item.note?.trim())).length,
    topicCount: new Set(items.flatMap((item) => item.resource.tags.map((tag) => tag.id))).size,
    latestSavedAt: items[0]?.savedAt ?? null,
  };
}

function savedAtLabel(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

function matchesView(item: SavedResource, view: LibraryView) {
  if (view === "noted") return Boolean(item.note?.trim());
  if (view === "online" || view === "check_library") return item.resource.availability === view;
  return true;
}

export function LibraryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedView = searchParams.get("view");
  const view: LibraryView = views.some((item) => item.value === requestedView) ? requestedView as LibraryView : "all";
  const [items, setItems] = useState<SavedResource[]>([]);
  const [state, setState] = useState<LibraryState>("loading");
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState<ReaderProfile | null>(null);
  const [profileEnabled, setProfileEnabled] = useState(false);
  const [stats, setStats] = useState<LibraryStatsData>(statsFrom([]));
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [discovery, setDiscovery] = useState<{ items: DiscoveryItem[]; sourceTitle: string | null; loading: boolean; error: string | null }>({ items: [], sourceTitle: null, loading: true, error: null });
  const requestEpoch = useRef(0);

  const loadProfile = useCallback(async (epoch: number) => {
    try {
      const response = await fetch("/api/profile", { cache: "no-store" });
      const body = await response.json() as ApiEnvelope<ProfileOverview>;
      if (requestEpoch.current !== epoch) return;
      if (!response.ok || !body.data) {
        setProfileEnabled(false);
        return;
      }
      setProfile(body.data.profile);
      setProfileEnabled(true);
      window.dispatchEvent(new Event("library-auth-changed"));
    } catch { if (requestEpoch.current === epoch) setProfileEnabled(false); }
  }, []);

  const loadDiscovery = useCallback(async (epoch: number) => {
    if (requestEpoch.current !== epoch) return;
    setDiscovery((current) => ({ ...current, loading: true, error: null }));
    try {
      const response = await fetch("/api/discover", { cache: "no-store" });
      const body = await response.json() as ApiEnvelope<DiscoveryData>;
      if (requestEpoch.current !== epoch) return;
      if (!response.ok || !body.data) throw new Error(apiMessage(body, "暂时无法找到下一条阅读路径。"));
      setDiscovery({ items: body.data.items, sourceTitle: body.data.source?.title ?? null, loading: false, error: null });
    } catch (error) {
      if (requestEpoch.current !== epoch) return;
      setDiscovery({ items: [], sourceTitle: null, loading: false, error: error instanceof Error ? error.message : "暂时无法找到下一条阅读路径。" });
    }
  }, []);

  const load = useCallback(async () => {
    const epoch = ++requestEpoch.current;
    setState("loading");
    setMessage("");
    setProfile(null);
    setProfileEnabled(false);
    setDiscovery({ items: [], sourceTitle: null, loading: true, error: null });
    void loadProfile(epoch);
    void loadDiscovery(epoch);
    try {
      const response = await fetch("/api/saved-resources", { cache: "no-store" });
      const body = await response.json() as ApiEnvelope<SavedResource[]>;
      if (requestEpoch.current !== epoch) return;
      if (response.status === 401) { setState("unauthenticated"); return; }
      if (!response.ok) throw new Error(apiMessage(body, "无法读取个人书架。"));
      const saved = body.data ?? [];
      setItems(saved);
      setStats(statsFrom(saved));
      setState("success");
    } catch (error) {
      if (requestEpoch.current !== epoch) return;
      setMessage(error instanceof Error ? error.message : "无法读取个人书架。");
      setState("error");
    }
  }, [loadDiscovery, loadProfile]);

  useEffect(() => {
    const task = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(task);
  }, [load]);

  const saveProfile = async (displayName: string) => {
    const payload: ProfileUpdateRequest = { displayName };
    const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json() as ApiEnvelope<ProfileOverview | ReaderProfile>;
    if (!response.ok) throw new Error(apiMessage(body, "暂时无法更新显示名。"));
    const nextProfile = "profile" in (body.data ?? {}) ? (body.data as ProfileOverview).profile : body.data as ReaderProfile;
    setProfile(nextProfile);
  };

  const remove = async (resourceId: string) => {
    if (removingId) return;
    setRemovingId(resourceId);
    setMessage("");
    try {
      const response = await fetch(`/api/saved-resources/${resourceId}`, { method: "DELETE" });
      const body = await response.json() as ApiEnvelope<{ resourceId: string }>;
      if (!response.ok) throw new Error(apiMessage(body, "无法移除这项资源。"));
      const next = items.filter((item) => item.resource.id !== resourceId);
      setItems(next);
      setStats(statsFrom(next));
      void loadDiscovery(requestEpoch.current);
    } catch (error) { setMessage(error instanceof Error ? error.message : "无法移除这项资源。"); } finally { setRemovingId(null); }
  };

  const signOut = async () => {
    setSigningOut(true);
    ++requestEpoch.current;
    setProfile(null);
    setProfileEnabled(false);
    setDiscovery({ items: [], sourceTitle: null, loading: false, error: null });
    setItems([]);
    setStats(statsFrom([]));
    try {
      await fetch("/api/auth/sign-out", { method: "POST" });
      window.dispatchEvent(new Event("library-auth-changed"));
      setState("unauthenticated");
    } finally { setSigningOut(false); }
  };

  const filteredItems = useMemo(() => items.filter((item) => matchesView(item, view)), [items, view]);

  const selectView = (next: LibraryView) => router.replace(next === "all" ? "/library" : `/library?view=${next}`);

  if (state === "loading") return <div className="space-y-6" aria-label="正在加载个人中心"><div className="h-24 animate-pulse bg-[#e4e7d4]" /><div className="grid gap-px bg-[#254a42]/20 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse bg-[#fff8e9]" />)}</div></div>;
  if (state === "unauthenticated") return <AuthForm onAuthenticated={() => void load()} />;
  if (state === "error") return <div className="border border-dashed border-[#a23b2c] px-6 py-12"><p className="font-serif text-2xl">个人中心暂时无法读取</p><p className="mt-2 text-sm text-[#a23b2c]">{message}</p><button type="button" onClick={() => void load()} className="mt-5 border border-[#254a42] px-3 py-2 text-sm text-[#254a42] hover:bg-[#254a42] hover:text-[#fff8e9]">重新尝试</button></div>;

  return <section className="space-y-10">
    <ProfileSummary profile={profile} enabled={profileEnabled} onSave={saveProfile} />
    <LibraryStats stats={stats} />
    <DiscoveryCard {...discovery} onRetry={() => void loadDiscovery(requestEpoch.current)} />
    <section>
      <div className="flex flex-col gap-5 border-b border-[#254a42]/30 pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm text-[#a23b2c]">我的书架</p><h2 className="mt-2 font-serif text-3xl">留下来的阅读线索</h2></div><button type="button" onClick={() => void signOut()} disabled={signingOut} className="inline-flex items-center gap-2 self-start text-sm text-[#254a42] hover:underline disabled:opacity-60 sm:self-auto"><LogOut className="size-4" />{signingOut ? "正在退出" : "退出登录"}</button></div>
      <div className="mt-5 flex flex-wrap gap-2" aria-label="书架筛选">{views.map((item) => <button key={item.value} type="button" aria-pressed={view === item.value} onClick={() => selectView(item.value)} className={`h-9 border px-3 text-sm transition-colors ${view === item.value ? "border-[#254a42] bg-[#254a42] text-[#fff8e9]" : "border-[#254a42]/30 text-[#254a42] hover:bg-[#e4e7d4]"}`}>{item.label}<span className="ml-1.5 text-xs opacity-75">{items.filter((saved) => matchesView(saved, item.value)).length}</span></button>)}</div>
      {message ? <p className="mt-4 text-sm text-[#a23b2c]" role="status">{message}</p> : null}
      {!items.length ? <div className="mt-6 border border-dashed border-[#254a42]/35 px-6 py-14 text-center"><NotebookPen className="mx-auto size-6 text-[#a23b2c]" aria-hidden="true" /><p className="mt-4 font-serif text-2xl">书架还没有资源</p><p className="mt-2 text-sm text-[#52625d]">从资源详情页收藏第一条阅读线索。</p><Link href="/search" className="mt-5 inline-flex items-center gap-2 border border-[#254a42] px-3 py-2 text-sm text-[#254a42] hover:bg-[#254a42] hover:text-[#fff8e9]">去找资源 <ArrowUpRight className="size-4" /></Link></div> : !filteredItems.length ? <div className="mt-6 border border-dashed border-[#254a42]/35 px-6 py-12 text-center"><p className="font-serif text-2xl">这个分区还是空的</p><p className="mt-2 text-sm text-[#52625d]">换一个筛选，或继续收藏新的线索。</p></div> : <div className="mt-6 divide-y divide-[#254a42]/20">{filteredItems.map((item) => <article key={item.resource.id} className="grid gap-4 py-5 sm:grid-cols-[6rem_1fr_auto] sm:gap-5"><ResourceCover resource={item.resource} /><div className="min-w-0"><p className="text-xs text-[#a23b2c]">{resourceTypeLabel(item.resource.type)} · 收藏于 {savedAtLabel(item.savedAt)}</p><h3 className="mt-1 font-serif text-2xl leading-snug"><Link href={`/resources/${item.resource.slug}`} className="hover:underline">{item.resource.title}</Link></h3><p className="mt-1 text-sm text-[#52625d]">{item.resource.creators.join("、")} · {availabilityLabel(item.resource.availability)}</p><div className="mt-3 flex flex-wrap gap-1.5">{item.resource.tags.map((tag) => <Link key={tag.id} href={`/search?tag=${tag.slug}`} className="border border-[#254a42]/25 px-2 py-1 text-xs text-[#254a42] hover:bg-[#e4e7d4]">{tag.name}</Link>)}</div>{item.note ? <blockquote className="mt-4 border-l-2 border-[#d2a85a] pl-3 text-sm leading-6 text-[#45554f]">{item.note}</blockquote> : <p className="mt-4 text-sm text-[#78837c]">还没有留下笔记</p>}</div><div className="flex items-start justify-between gap-3 sm:flex-col sm:items-end"><Link href={`/resources/${item.resource.slug}`} className="inline-flex size-9 items-center justify-center border border-[#254a42]/30 text-[#254a42] hover:bg-[#254a42] hover:text-[#fff8e9]" aria-label={`查看 ${item.resource.title}`}><ArrowUpRight className="size-4" /></Link><button type="button" onClick={() => void remove(item.resource.id)} disabled={removingId !== null} className="inline-flex h-9 items-center gap-1.5 text-sm text-[#a23b2c] hover:underline disabled:opacity-50"><X className="size-4" />{removingId === item.resource.id ? "正在移除" : "移除"}</button></div></article>)}</div>}
    </section>
  </section>;
}
