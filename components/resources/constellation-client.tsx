"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  ChevronRight,
  CircleAlert,
  Focus,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { createConstellationLayout } from "@/lib/constellation-layout";
import { resourceTypeLabel } from "@/lib/resource-presentation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { SaveResourceButton } from "@/components/resources/save-resource-button";
import type { ApiFailure, ApiSuccess } from "@/lib/types/api";
import type { ConstellationData, ConstellationEdge, ConstellationNode } from "@/lib/types/constellation";
import type { RelationType } from "@/lib/types/resources";

type LoadState = "loading" | "success" | "empty" | "error";
type ConstellationResponse = ApiSuccess<ConstellationData> | ApiFailure;

const relationOrder: RelationType[] = [
  "same_theme",
  "contrasting_view",
  "historical_context",
  "unexpected_bridge",
];

const relationMeta: Record<RelationType, { label: string; color: string }> = {
  same_theme: { label: "同一主题", color: "#e5c454" },
  contrasting_view: { label: "对照观点", color: "#e87857" },
  historical_context: { label: "历史背景", color: "#77b7b2" },
  unexpected_bridge: { label: "意外桥接", color: "#b28cc7" },
};

function edgeDirection(edge: ConstellationEdge, centerResourceId: string) {
  return edge.sourceResourceId === centerResourceId
    ? "从当前资源出发"
    : "回到当前资源";
}

function FocusDetail({
  node,
  centerResourceId,
  edges,
}: {
  node: ConstellationNode;
  centerResourceId: string;
  edges: ConstellationEdge[];
}) {
  const connections = edges.filter(
    (edge) => edge.sourceResourceId === node.resource.id || edge.targetResourceId === node.resource.id,
  );
  const isCenter = node.resource.id === centerResourceId;

  return <section className="border-t border-[#fff8e9]/20 pt-5" aria-live="polite">
    <p className="text-xs font-medium text-[#e5c454]">{isCenter ? "当前资源" : node.hop === 1 ? "一跳关联" : "二跳关联"}</p>
    <h2 className="mt-2 font-serif text-2xl leading-tight text-[#fff8e9]">{node.resource.title}</h2>
    <p className="mt-2 text-sm text-[#d3dfd9]">{resourceTypeLabel(node.resource.type)} · {node.resource.creators.join("、") || "策展资料"}</p>
    {!isCenter && connections.length > 0 ? <div className="mt-5 space-y-4">
      {connections.map((edge) => <div key={edge.id} className="border-l-2 pl-3" style={{ borderColor: relationMeta[edge.relationType].color }}>
        <p className="text-xs" style={{ color: relationMeta[edge.relationType].color }}>{relationMeta[edge.relationType].label} · {edgeDirection(edge, centerResourceId)}</p>
        <p className="mt-1 text-sm leading-6 text-[#edf2e9]">{edge.explanation}</p>
      </div>)}
    </div> : <p className="mt-4 text-sm leading-6 text-[#d3dfd9]">中心资源位于星图原点，所有连线都来自已策展的资源关系。</p>}
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <Link href={`/resources/${node.resource.slug}`} className="inline-flex h-10 items-center gap-2 border border-[#fff8e9]/60 px-3 text-sm text-[#fff8e9] hover:bg-[#fff8e9] hover:text-[#172d29]">
        打开资源 <ArrowUpRight className="size-4" />
      </Link>
      <SaveResourceButton resourceId={node.resource.id} compact />
    </div>
  </section>;
}

function EmptyConstellation({ slug }: { slug: string }) {
  return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
    <Link href={`/resources/${slug}`} className="inline-flex items-center gap-1 text-sm text-[#254a42] hover:underline"><ChevronRight className="size-4 rotate-180" />返回资源详情</Link>
    <section className="mt-8 border-y border-[#254a42]/20 py-16 text-center">
      <Sparkles className="mx-auto size-7 text-[#a23b2c]" />
      <h1 className="mt-4 font-serif text-3xl">这条线索暂时没有延伸</h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#52625d]">馆长还没有为它编织关联路径。你仍可以从资源详情继续阅读或收藏。</p>
      <Link href={`/resources/${slug}`} className="mt-6 inline-flex h-10 items-center gap-2 border border-[#254a42] px-4 text-sm text-[#254a42] hover:bg-[#254a42] hover:text-[#fff8e9]">回到资源详情 <ArrowUpRight className="size-4" /></Link>
    </section>
  </main>;
}

export function ConstellationClient({ slug }: { slug: string }) {
  const client = useMemo(() => {
    try {
      return createSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);
  const [state, setState] = useState<LoadState>("loading");
  const [data, setData] = useState<ConstellationData | null>(null);
  const [message, setMessage] = useState("");
  const [activeRelations, setActiveRelations] = useState<RelationType[]>(relationOrder);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const load = useCallback(async (signal?: AbortSignal) => {
    setState("loading");
    setMessage("");
    try {
      const sessionData = client ? await client.auth.getSession() : { data: { session: null } };
      const response = await fetch(`/api/resources/${encodeURIComponent(slug)}/constellation?depth=1`, {
        cache: "no-store",
        signal,
        headers: sessionData.data.session ? { Authorization: `Bearer ${sessionData.data.session.access_token}` } : undefined,
      });
      if (!response.headers.get("content-type")?.includes("application/json")) {
        throw new Error("星图服务返回了非预期响应，请稍后重试。");
      }
      const body = await response.json() as ConstellationResponse;
      if (!response.ok || !body.data) {
        throw new Error("error" in body && body.error ? body.error.message : "星图暂时无法读取。");
      }
      setData(body.data);
      setSelectedId(body.data.centerResourceId);
      setState(body.data.edges.length === 0 ? "empty" : "success");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage(error instanceof Error ? error.message : "星图暂时无法读取。");
      setState("error");
    }
  }, [client, slug]);

  useEffect(() => {
    const controller = new AbortController();
    const request = window.setTimeout(() => void load(controller.signal), 0);
    return () => {
      window.clearTimeout(request);
      controller.abort();
    };
  }, [load]);

  if (state === "loading") return <main className="mx-auto max-w-6xl px-5 py-16 sm:px-8"><div className="h-5 w-32 animate-pulse bg-[#e4e7d4]" /><div className="mt-5 aspect-[16/10] animate-pulse border border-[#254a42]/15 bg-[#e4e7d4]/45" /></main>;
  if (state === "empty") return <EmptyConstellation slug={slug} />;
  if (state === "error" || !data) return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><Link href={`/resources/${slug}`} className="inline-flex items-center gap-1 text-sm text-[#254a42] hover:underline"><ChevronRight className="size-4 rotate-180" />返回资源详情</Link><section className="mt-8 border border-dashed border-[#a23b2c] px-6 py-14 text-center"><CircleAlert className="mx-auto size-7 text-[#a23b2c]" /><h1 className="mt-4 font-serif text-3xl">星图暂时无法展开</h1><p className="mt-3 text-sm text-[#a23b2c]">{message || "请稍后再试。"}</p><button type="button" onClick={() => void load()} className="mt-6 inline-flex h-10 items-center gap-2 border border-[#254a42] px-4 text-sm text-[#254a42] hover:bg-[#254a42] hover:text-[#fff8e9]"><RotateCcw className="size-4" />重新载入</button></section></main>;

  const positions = createConstellationLayout(data.nodes);
  const visibleEdges = data.edges.filter((edge) => activeRelations.includes(edge.relationType));
  const visibleNodeIds = new Set([data.centerResourceId, ...visibleEdges.flatMap((edge) => [edge.sourceResourceId, edge.targetResourceId])]);
  const visibleNodes = data.nodes.filter((node) => visibleNodeIds.has(node.resource.id));
  const selectedNode = data.nodes.find((node) => node.resource.id === selectedId) ?? data.nodes.find((node) => node.resource.id === data.centerResourceId) ?? data.nodes[0];
  if (!selectedNode) return <EmptyConstellation slug={slug} />;

  const toggleRelation = (relation: RelationType) => {
    setActiveRelations((current) => current.includes(relation)
      ? current.filter((item) => item !== relation)
      : [...current, relation]);
  };

  return <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
    <Link href={`/resources/${slug}`} className="inline-flex items-center gap-1 text-sm text-[#254a42] hover:underline"><ChevronRight className="size-4 rotate-180" />返回资源详情</Link>
    <div className="mt-7 flex flex-wrap items-end justify-between gap-5">
      <div><p className="text-sm text-[#a23b2c]">资源星图</p><h1 className="mt-2 font-serif text-4xl leading-tight text-[#172d29]">从一本书，看见它的邻近宇宙</h1></div>
      <p className="max-w-sm text-sm leading-6 text-[#52625d]">连线来自人工策展关系；距离只表示你离当前资源的跳数。</p>
    </div>
    <div className="mt-7 flex flex-wrap gap-x-5 gap-y-3 border-y border-[#254a42]/20 py-4" aria-label="关系类型筛选">
      {relationOrder.map((relation) => <button key={relation} type="button" onClick={() => toggleRelation(relation)} aria-pressed={activeRelations.includes(relation)} className={`inline-flex items-center gap-2 text-sm text-[#254a42] ${activeRelations.includes(relation) ? "" : "opacity-40 line-through"}`}>
        <span className="size-3 border border-[#172d29]/40" style={{ backgroundColor: relationMeta[relation].color }} aria-hidden="true" />{relationMeta[relation].label}
      </button>)}
    </div>
    <section className="mt-6 hidden overflow-hidden border border-[#172d29] bg-[#172d29] lg:grid lg:grid-cols-[minmax(0,1fr)_20rem]" aria-label="资源星图桌面视图">
      <div className="relative min-h-[39rem] overflow-hidden border-r border-[#fff8e9]/20">
        <div className="absolute left-5 top-5 z-10 flex gap-1"><button type="button" onClick={() => setZoom((value) => Math.max(0.8, Number((value - 0.15).toFixed(2))))} aria-label="缩小星图" className="grid size-9 place-items-center border border-[#fff8e9]/35 bg-[#172d29] text-[#fff8e9] hover:bg-[#254a42]"><Minus className="size-4" /></button><button type="button" onClick={() => setZoom((value) => Math.min(1.35, Number((value + 0.15).toFixed(2))))} aria-label="放大星图" className="grid size-9 place-items-center border border-[#fff8e9]/35 bg-[#172d29] text-[#fff8e9] hover:bg-[#254a42]"><Plus className="size-4" /></button><button type="button" onClick={() => { setZoom(1); setSelectedId(data.centerResourceId); }} aria-label="重置星图视图" className="grid size-9 place-items-center border border-[#fff8e9]/35 bg-[#172d29] text-[#fff8e9] hover:bg-[#254a42]"><Focus className="size-4" /></button></div>
        <div className="absolute inset-0 origin-center transition-transform duration-300 motion-reduce:transition-none" style={{ transform: `scale(${zoom})` }}>
          <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs><marker id="constellation-arrow" markerWidth="5" markerHeight="5" refX="4.3" refY="2.5" orient="auto"><path d="M 0 0 L 5 2.5 L 0 5 z" fill="#fff8e9" /></marker></defs>{visibleEdges.map((edge) => { const source = positions.get(edge.sourceResourceId); const target = positions.get(edge.targetResourceId); if (!source || !target) return null; return <line key={edge.id} x1={source.x} y1={source.y} x2={target.x} y2={target.y} stroke={relationMeta[edge.relationType].color} strokeWidth={Math.max(0.35, edge.strength * 0.15)} opacity={0.44 + edge.strength * 0.1} markerEnd="url(#constellation-arrow)" />; })}</svg>
          {visibleNodes.map((node) => { const position = positions.get(node.resource.id); if (!position) return null; const isSelected = selectedNode.resource.id === node.resource.id; const isCenter = node.resource.id === data.centerResourceId; return <button key={node.resource.id} type="button" onClick={() => setSelectedId(node.resource.id)} className={`absolute w-32 -translate-x-1/2 -translate-y-1/2 border px-3 py-2.5 text-left shadow-[3px_3px_0_rgb(0_0_0_/_25%)] transition hover:-translate-y-[55%] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e5c454] motion-reduce:transition-none ${isCenter ? "border-[#fff8e9] bg-[#fff8e9] text-[#172d29]" : isSelected ? "border-[#e5c454] bg-[#254a42] text-[#fff8e9]" : "border-[#fff8e9]/50 bg-[#172d29] text-[#fff8e9] hover:bg-[#254a42]"}`} style={{ left: `${position.x}%`, top: `${position.y}%` }} aria-pressed={isSelected}><span className="block text-[10px] opacity-70">{isCenter ? "原点" : `${node.hop} 跳`}</span><span className="mt-1 block line-clamp-2 font-serif text-sm leading-tight">{node.resource.title}</span></button>; })}
        </div>
        <p className="absolute bottom-5 left-5 right-5 text-xs text-[#d3dfd9]">{data.personalization === "profile" ? "节点亮度参考了你的明确阅读偏好。" : "当前按公共目录关系展示。"}</p>
      </div>
      <aside className="flex min-h-0 flex-col p-5"><p className="text-xs text-[#d3dfd9]">点击任意节点，查看这条路径的人工解释。</p><div className="mt-5 flex-1 overflow-y-auto pr-1"><FocusDetail node={selectedNode} centerResourceId={data.centerResourceId} edges={visibleEdges} /></div></aside>
    </section>
    <section className="mt-6 border border-[#172d29] bg-[#172d29] p-5 lg:hidden" aria-label="资源星图移动视图">
      <p className="text-sm text-[#d3dfd9]">沿着节点带选择下一条线索</p>
      <div className="mt-5 flex snap-x gap-3 overflow-x-auto pb-3" aria-label="星图节点带">
        {visibleNodes.map((node) => { const isSelected = selectedNode.resource.id === node.resource.id; const isCenter = node.resource.id === data.centerResourceId; return <button key={node.resource.id} type="button" onClick={() => setSelectedId(node.resource.id)} aria-pressed={isSelected} className={`w-36 shrink-0 snap-start border p-3 text-left ${isCenter ? "border-[#fff8e9] bg-[#fff8e9] text-[#172d29]" : isSelected ? "border-[#e5c454] bg-[#254a42] text-[#fff8e9]" : "border-[#fff8e9]/45 text-[#fff8e9]"}`}><span className="text-[10px] opacity-70">{isCenter ? "原点" : `${node.hop} 跳`}</span><span className="mt-2 block min-h-10 font-serif text-sm leading-tight">{node.resource.title}</span></button>; })}
      </div>
      <div className="mt-4"><FocusDetail node={selectedNode} centerResourceId={data.centerResourceId} edges={visibleEdges} /></div>
    </section>
  </main>;
}
