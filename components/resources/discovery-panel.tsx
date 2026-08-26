"use client";

import Link from "next/link";
import { Compass, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { SaveResourceButton } from "@/components/resources/save-resource-button";
import type { ApiFailure, ApiSuccess } from "@/lib/types/api";
import type { DiscoverData, DiscoveryMode } from "@/lib/types/resources";

const modeLabels: Record<DiscoveryMode, string> = {
  surprise: "意外连接",
  extend: "延展主题",
  challenge: "换个观点",
  context: "回到背景",
};
const relationLabels = { same_theme: "同一主题", contrasting_view: "对照观点", historical_context: "历史背景", unexpected_bridge: "意外桥接" } as const;

type DiscoverResponse = ApiSuccess<DiscoverData> | ApiFailure;

export function DiscoveryPanel({
  originResourceId,
  discoveryContext,
}: {
  originResourceId: string;
  discoveryContext: string | null;
}) {
  const client = useMemo(() => {
    try {
      return createSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);
  const [mode, setMode] = useState<DiscoveryMode>("surprise");
  const [sourceMode, setSourceMode] = useState<"free" | "constrained">("free");
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [result, setResult] = useState<DiscoverData | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const discover = async (nextExcludedIds = excludedIds) => {
    setBusy(true);
    setMessage("");
    try {
      const sessionData = client ? await client.auth.getSession() : { data: { session: null } };
      const response = await fetch("/api/discoveries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sessionData.data.session ? { Authorization: `Bearer ${sessionData.data.session.access_token}` } : {}),
        },
        body: JSON.stringify({
          originResourceId,
          mode,
          excludeResourceIds: nextExcludedIds,
          ...(sourceMode === "constrained" && discoveryContext ? { discoveryContext } : {}),
        }),
      });
      const body = await response.json() as DiscoverResponse;
      if (!response.ok || !body.data) {
        setResult(null);
        if ("error" in body && body.error?.code === "INVALID_DISCOVERY_CONTEXT") {
          setSourceMode("free");
          setMessage("当前筛选上下文已失效，已切回自由偏离，请重试。");
        } else setMessage("error" in body && body.error ? body.error.message : "暂时无法找到下一条阅读线索。");
        return;
      }
      setResult(body.data);
    } catch {
      setResult(null);
      setMessage("网络暂时不可用，请稍后重试。");
    } finally {
      setBusy(false);
    }
  };

  const tryAnother = () => {
    const nextExcludedIds = result?.recommendation
      ? [...new Set([...excludedIds, result.recommendation.resource.id])].slice(-20)
      : excludedIds;
    setExcludedIds(nextExcludedIds);
    void discover(nextExcludedIds);
  };

  return (
    <section className="mt-10 border-y border-[#254a42]/20 py-7">
      <div className="flex items-start gap-3">
        <Compass className="mt-1 size-5 text-[#a23b2c]" />
        <div><p className="text-sm text-[#a23b2c]">带我偏离一点</p><h2 className="mt-1 font-serif text-2xl">从这里转向另一条线索</h2></div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2" aria-label="发现方向">
        {(Object.keys(modeLabels) as DiscoveryMode[]).map((value) => (
          <button key={value} type="button" onClick={() => setMode(value)} aria-pressed={mode === value} className={`border px-3 py-1.5 text-sm ${mode === value ? "border-[#254a42] bg-[#254a42] text-[#fff8e9]" : "border-[#254a42]/30 text-[#254a42] hover:bg-[#e4e7d4]"}`}>{modeLabels[value]}</button>
        ))}
      </div>
      <fieldset className="mt-4"><legend className="text-sm text-[#52625d]">发现范围</legend><div className="mt-2 flex flex-wrap gap-2">{(["free", "constrained"] as const).map((value) => { const available = value === "free" || Boolean(discoveryContext); const label = value === "free" ? "自由偏离" : "在当前筛选内偏离"; return <button key={value} type="button" disabled={!available} onClick={() => setSourceMode(value)} aria-pressed={sourceMode === value} className={`border px-3 py-1.5 text-sm ${sourceMode === value ? "border-[#254a42] bg-[#254a42] text-[#fff8e9]" : "border-[#254a42]/30 text-[#254a42] hover:bg-[#e4e7d4]"} disabled:cursor-not-allowed disabled:opacity-45`}>{label}</button>; })}</div>{!discoveryContext ? <p className="mt-2 text-xs text-[#78837c]">本次从公共目录进入，仅可自由偏离。</p> : null}</fieldset>
      <button type="button" onClick={() => void discover()} disabled={busy} className="mt-5 inline-flex h-10 items-center gap-2 border border-[#254a42] px-4 text-sm text-[#254a42] enabled:hover:bg-[#254a42] enabled:hover:text-[#fff8e9] disabled:opacity-60"><Compass className="size-4" />{busy ? "正在寻找" : "开始发现"}</button>
      {message ? <p className="mt-3 text-sm text-[#a23b2c]" role="status">{message}</p> : null}
      {result && !result.recommendation ? <p className="mt-5 text-sm text-[#52625d]">{result.constrainedBySourceFilters ? "当前筛选范围内没有另一条路径。" : "这条线索暂时没有可继续偏离的资源。"}</p> : null}
      {result?.recommendation ? <div className="mt-5 border-l-2 border-[#a23b2c] pl-4"><p className="text-xs text-[#a23b2c]">{result.usedRelationType ? relationLabels[result.usedRelationType] : "关系图"} · {result.personalization === "profile" ? "按你的偏好排序" : "目录策展排序"} {result.constrainedBySourceFilters ? " · 在当前筛选内" : " · 自由偏离"}</p><h3 className="mt-1 font-serif text-xl"><Link href={`/resources/${result.recommendation.resource.slug}`} className="hover:underline">{result.recommendation.resource.title}</Link></h3><p className="mt-2 text-sm leading-6 text-[#45554f]">{result.recommendation.relationExplanation}</p><p className="mt-2 text-sm leading-6 text-[#45554f]">{result.recommendation.narration}</p><div className="mt-4 flex flex-wrap items-center gap-4"><Link href={`/resources/${result.recommendation.resource.slug}`} className="text-sm text-[#254a42] underline">打开资源</Link><button type="button" onClick={tryAnother} disabled={busy || excludedIds.length >= 20} className="inline-flex items-center gap-1 text-sm text-[#254a42] hover:underline disabled:opacity-60"><RefreshCw className="size-4" />再偏一次</button><SaveResourceButton resourceId={result.recommendation.resource.id} /></div></div> : null}
    </section>
  );
}
