"use client";

import { Check, PencilLine, UserRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { ReaderProfile } from "@/lib/types/profile";

export type { ReaderProfile };

function joinedLabel(value: string | null) {
  if (!value) return null;
  return `${new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long" }).format(new Date(value))} 加入`;
}

export function ProfileSummary({ profile, enabled, onSave }: {
  profile: ReaderProfile | null;
  enabled: boolean;
  onSave: (displayName: string) => Promise<void>;
}) {
  const fallbackName = profile?.email?.split("@", 1)[0] || "阅读者";
  const initialName = profile?.displayName ?? fallbackName;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const nextName = name.trim();
    if (!nextName) { setMessage("请填写显示名。"); return; }
    setSaving(true);
    setMessage("");
    try {
      await onSave(nextName);
      setEditing(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "暂时无法更新显示名。");
    } finally { setSaving(false); }
  };

  const displayName = profile?.displayName ?? fallbackName;
  const initial = displayName.slice(0, 1).toUpperCase();
  return <section className="grid gap-5 border-b border-[#254a42]/20 pb-7 sm:grid-cols-[auto_1fr_auto] sm:items-center">
    <div className="grid size-16 place-items-center rounded-full border border-[#254a42] bg-[#e4e7d4] font-serif text-3xl text-[#254a42]" aria-hidden="true">{initial}</div>
    <div className="min-w-0">
      {editing ? <div className="max-w-sm"><label className="sr-only" htmlFor="reader-name">显示名</label><input id="reader-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={50} className="h-10 w-full border border-[#254a42] bg-[#fffdf5] px-3 text-sm outline-none focus:ring-2 focus:ring-[#a23b2c]/30" /><p className="mt-2 text-xs text-[#a23b2c]" role="status">{message}</p></div> : <><p className="text-sm text-[#a23b2c]">我的阅读档案</p><h2 className="mt-1 truncate font-serif text-3xl text-[#172d29]">{displayName}</h2><p className="mt-2 text-sm text-[#52625d]">{profile?.email || "收藏的线索，只对你可见。"}{joinedLabel(profile?.joinedAt ?? null) ? ` · ${joinedLabel(profile?.joinedAt ?? null)}` : ""}</p></>}
    </div>
    {enabled ? <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => { if (editing) { void save(); } else { setName(profile?.displayName ?? fallbackName); setEditing(true); } }} disabled={saving} className="inline-flex h-10 items-center gap-2 border border-[#254a42] px-3 text-sm text-[#254a42] hover:bg-[#254a42] hover:text-[#fff8e9] disabled:opacity-60">{editing ? <Check className="size-4" /> : <PencilLine className="size-4" />}{saving ? "正在保存" : editing ? "保存" : "编辑资料"}</button>{editing ? <button type="button" onClick={() => { setEditing(false); setMessage(""); setName(profile?.displayName ?? fallbackName); }} className="h-10 px-2 text-sm text-[#52625d] hover:underline">取消</button> : <Link href="/search" className="h-10 px-2 text-sm text-[#254a42] hover:underline">继续探索</Link>}</div> : <div className="inline-flex items-center gap-2 text-sm text-[#52625d]"><UserRound className="size-4" />档案准备中</div>}
  </section>;
}
