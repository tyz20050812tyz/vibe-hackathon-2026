"use client";

import { Bookmark } from "lucide-react";
import { useState } from "react";

export function SaveResourceButton({ resourceId }: { resourceId: string }) {
  const [label, setLabel] = useState("收藏到书架");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/saved-resources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resourceId }) });
      const body = await response.json() as { error?: { code: string; message: string } };
      if (response.status === 401) { setMessage("请先到个人书架登录，再收藏资源。"); return; }
      if (response.ok || body.error?.code === "ALREADY_SAVED") { setLabel("已收藏"); setMessage(body.error?.code === "ALREADY_SAVED" ? "已在你的书架中。" : "已保存到个人书架。"); return; }
      setMessage(body.error?.message ?? "收藏失败，请稍后重试。");
    } catch { setMessage("网络暂时不可用，请稍后重试。"); }
    finally { setBusy(false); }
  };
  return <div className="mt-6 max-w-lg"><label className="block text-sm text-[#45554f]" htmlFor="saved-resource-note">留一句笔记（可选）</label><textarea id="saved-resource-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} disabled={busy || label === "已收藏"} placeholder="例如：想从这本书继续读到哪里？" className="mt-2 block min-h-24 w-full resize-y border border-[#254a42]/30 bg-[#fffdf5] px-3 py-2 text-sm leading-6 text-[#172d29] outline-none placeholder:text-[#78837c] focus:border-[#254a42] disabled:cursor-not-allowed disabled:opacity-60" /><p className="mt-1 text-right text-xs text-[#78837c]">{note.length}/500</p><button type="button" onClick={save} disabled={busy || label === "已收藏"} className="mt-3 inline-flex h-10 items-center gap-2 border border-[#254a42] px-4 text-sm text-[#254a42] enabled:hover:bg-[#254a42] enabled:hover:text-[#fff8e9] disabled:opacity-60"><Bookmark className="size-4" />{busy ? "正在保存" : label}</button>{message ? <p className="mt-2 text-sm text-[#254a42]" role="status">{message}</p> : null}</div>;
}
