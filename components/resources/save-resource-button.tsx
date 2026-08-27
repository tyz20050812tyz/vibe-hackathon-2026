"use client";

import { Bookmark } from "lucide-react";
import { useState } from "react";

export function SaveResourceButton({ resourceId, compact = false, isSaved = false }: { resourceId: string; compact?: boolean; isSaved?: boolean }) {
  const [savedByUser, setSavedByUser] = useState(false);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const saved = isSaved || savedByUser;

  const save = async () => {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/saved-resources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resourceId, note: note.trim() || undefined }) });
      const body = await response.json() as { error?: { code: string; message: string } };
      if (response.status === 401) { setMessage("请先到个人书架登录，再收藏资源。"); return; }
      if (response.ok || body.error?.code === "ALREADY_SAVED") { setSavedByUser(true); setMessage(body.error?.code === "ALREADY_SAVED" ? "已在你的书架中。" : "已保存到个人书架。"); return; }
      setMessage(body.error?.message ?? "收藏失败，请稍后重试。");
    } catch { setMessage("网络暂时不可用，请稍后重试。"); }
    finally { setBusy(false); }
  };
  return <div className={compact ? "" : "mt-6 max-w-lg"}>{!compact ? <><label className="block text-sm text-[#45554f]" htmlFor="saved-resource-note">留一句笔记（可选）</label><textarea id="saved-resource-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} disabled={busy || saved} placeholder="例如：想从这本书继续读到哪里？" className="mt-2 block min-h-24 w-full resize-y border border-[#254a42]/30 bg-[#fffdf5] px-3 py-2 text-sm leading-6 text-[#172d29] outline-none placeholder:text-[#78837c] focus:border-[#254a42] disabled:cursor-not-allowed disabled:opacity-60" /><p className="mt-1 text-right text-xs text-[#78837c]">{note.length}/500</p></> : null}<button type="button" onClick={save} disabled={busy || saved} className={`inline-flex h-10 items-center gap-2 border px-4 text-sm disabled:opacity-60 ${compact ? "border-[#fff8e9]/60 text-[#fff8e9] enabled:hover:bg-[#fff8e9] enabled:hover:text-[#172d29]" : "mt-3 border-[#254a42] text-[#254a42] enabled:hover:bg-[#254a42] enabled:hover:text-[#fff8e9]"}`}><Bookmark className="size-4" />{busy ? "正在保存" : saved ? "已收藏" : "收藏到书架"}</button>{message ? <p className={`mt-2 text-sm ${compact ? "text-[#d3dfd9]" : "text-[#254a42]"}`} role="status">{message}</p> : null}</div>;
}
