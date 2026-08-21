"use client";

import { LogOut } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { AuthForm } from "@/components/auth/auth-form";
import { ResourceList } from "@/components/resources/resource-list";
import type { SavedResource } from "@/lib/types/resources";

type LibraryState = "loading" | "unauthenticated" | "success" | "error";

export function LibraryContent() {
  const [items, setItems] = useState<SavedResource[]>([]);
  const [state, setState] = useState<LibraryState>("loading");
  const [message, setMessage] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const load = useCallback(async () => {
    setState("loading");
    setMessage("");
    try {
      const response = await fetch("/api/saved-resources", { cache: "no-store" });
      const body = await response.json() as { data?: SavedResource[]; error?: { message?: string } };
      if (response.status === 401) { setState("unauthenticated"); return; }
      if (!response.ok) throw new Error(body.error?.message ?? "无法读取个人书架。");
      setItems(body.data ?? []);
      setState("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法读取个人书架。");
      setState("error");
    }
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(task);
  }, [load]);

  const remove = async (resourceId: string) => {
    if (removingId) return;
    setRemovingId(resourceId);
    setMessage("");
    try {
      const response = await fetch(`/api/saved-resources/${resourceId}`, { method: "DELETE" });
      const body = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "无法移除这项资源。");
      setItems((current) => current.filter((item) => item.resource.id !== resourceId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法移除这项资源。");
    } finally { setRemovingId(null); }
  };

  const signOut = async () => {
    setSigningOut(true);
    try {
      await fetch("/api/auth/sign-out", { method: "POST" });
      setItems([]);
      setState("unauthenticated");
    } finally { setSigningOut(false); }
  };

  if (state === "loading") return <p className="py-16 text-[#52625d]">正在确认登录状态...</p>;
  if (state === "unauthenticated") return <AuthForm onAuthenticated={() => void load()} />;
  if (state === "error") return <div className="border border-dashed border-[#a23b2c] px-6 py-12"><p className="font-serif text-2xl">个人书架暂时无法读取</p><p className="mt-2 text-sm text-[#a23b2c]">{message}</p><button type="button" onClick={() => void load()} className="mt-5 border border-[#254a42] px-3 py-2 text-sm text-[#254a42] hover:bg-[#254a42] hover:text-[#fff8e9]">重新尝试</button></div>;

  return <section><div className="flex items-center justify-between border-b border-[#254a42]/20 pb-4"><p className="text-sm text-[#52625d]">仅你可见的阅读线索</p><button type="button" onClick={() => void signOut()} disabled={signingOut} className="inline-flex items-center gap-1 text-sm text-[#254a42] hover:underline disabled:opacity-60"><LogOut className="size-4" />{signingOut ? "正在退出" : "退出登录"}</button></div>{message ? <p className="mt-4 text-sm text-[#a23b2c]" role="status">{message}</p> : null}{!items.length ? <div className="border border-dashed border-[#254a42]/35 px-6 py-14 text-center"><p className="font-serif text-2xl">书架还没有资源</p><p className="mt-2 text-sm text-[#52625d]">从资源详情页收藏第一条阅读线索。</p></div> : items.map((item) => <div key={item.resource.id} className="relative"><ResourceList resources={[item.resource]} /><button type="button" onClick={() => void remove(item.resource.id)} disabled={removingId !== null} className="absolute right-10 top-5 text-xs text-[#a23b2c] hover:underline disabled:opacity-50">{removingId === item.resource.id ? "正在移除" : "移除"}</button></div>)}</section>;
}
