"use client";

import { Bookmark } from "lucide-react";
import { useMemo, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function SaveResourceButton({ resourceId }: { resourceId: string }) {
  const client = useMemo(() => { try { return createSupabaseBrowserClient(); } catch { return null; } }, []);
  const [label, setLabel] = useState("收藏到书架");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!client) { setMessage("登录服务尚未配置。"); return; }
    setBusy(true); setMessage("");
    try {
      const { data } = await client.auth.getSession();
      if (!data.session) { setMessage("请先到个人书架登录，再收藏资源。"); return; }
      const response = await fetch("/api/saved-resources", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ resourceId }) });
      const body = await response.json() as { error?: { code: string; message: string } };
      if (response.ok || body.error?.code === "ALREADY_SAVED") { setLabel("已收藏"); setMessage(body.error?.code === "ALREADY_SAVED" ? "已在你的书架中。" : "已保存到个人书架。"); return; }
      setMessage(body.error?.message ?? "收藏失败，请稍后重试。");
    } catch { setMessage("网络暂时不可用，请稍后重试。"); }
    finally { setBusy(false); }
  };
  return <div className="mt-6"><button type="button" onClick={save} disabled={busy || label === "已收藏"} className="inline-flex h-10 items-center gap-2 border border-[#254a42] px-4 text-sm text-[#254a42] enabled:hover:bg-[#254a42] enabled:hover:text-[#fff8e9] disabled:opacity-60"><Bookmark className="size-4" />{busy ? "正在保存" : label}</button>{message ? <p className="mt-2 text-sm text-[#254a42]" role="status">{message}</p> : null}</div>;
}
