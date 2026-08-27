"use client";

import Link from "next/link";
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from "d3-force";
import { CircleAlert, Minus, Network, Plus, RotateCcw, Search, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { SaveResourceButton } from "@/components/resources/save-resource-button";
import { createBookRelationGraph, type BookRelationGraph, type BookRelationNode } from "@/lib/book-similarity";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ApiFailure, ApiSuccess } from "@/lib/types/api";
import type { ConstellationData } from "@/lib/types/constellation";
import type { RelationType, ResourceListItem, SearchResourcesData } from "@/lib/types/resources";

type CatalogResponse = ApiSuccess<SearchResourcesData> | ApiFailure;
type ConstellationResponse = ApiSuccess<ConstellationData> | ApiFailure;
type LoadState = "loading" | "ready" | "error";
type Viewport = { scale: number; x: number; y: number };
type DragState = { kind: "canvas" | "node"; nodeId?: string; pointerId: number; lastX: number; lastY: number; moved: boolean };

type ForceNode = BookRelationNode & { x?: number; y?: number };
type ForceEdge = { source: string | ForceNode; target: string | ForceNode; strength: number };

const relationTypes: RelationType[] = [
  "same_theme",
  "contrasting_view",
  "historical_context",
  "unexpected_bridge",
];

const relationStyles: Record<RelationType, { color: string; dash: string | undefined; label: string }> = {
  same_theme: { color: "#d3dfd9", dash: undefined, label: "同一主题" },
  contrasting_view: { color: "#e87857", dash: "9 5", label: "对照观点" },
  historical_context: { color: "#77b7b2", dash: "2 5", label: "历史语境" },
  unexpected_bridge: { color: "#b28cc7", dash: "12 4 2 4", label: "意外连接" },
};

function nodeRadius(node: BookRelationNode) {
  return node.isCenter ? 58 : 28 + (node.relationStrength ?? 0) * 5;
}

function nodeTone(node: BookRelationNode) {
  if (node.isCenter) return "#e5c454";
  if (node.relationTypes.includes("unexpected_bridge")) return "#b28cc7";
  if (node.relationTypes.includes("contrasting_view")) return "#e87857";
  if (node.relationTypes.includes("historical_context")) return "#77b7b2";
  return "#d3dfd9";
}

function BookDetailDialog({ node, onClose }: { node: BookRelationNode; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [onClose]);

  return <div className="fixed inset-0 z-50 flex items-end bg-[#172d29]/65 p-4 sm:items-center sm:justify-center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="max-h-[min(42rem,calc(100vh-2rem))] w-full max-w-xl overflow-y-auto border border-[#fff8e9]/45 bg-[#172d29] p-5 text-[#fff8e9] shadow-[8px_8px_0_rgb(0_0_0_/_32%)] sm:p-7" role="dialog" aria-modal="true" aria-labelledby="book-detail-title">
      <div className="flex items-start justify-between gap-5"><div><p className="text-xs text-[#e5c454]">{node.isCenter ? "起点资源" : `人工关系强度 ${node.relationStrength ?? 0}/5`}</p><h2 id="book-detail-title" className="mt-2 font-serif text-3xl leading-tight">{node.resource.title}</h2></div><button ref={closeRef} type="button" onClick={onClose} className="grid size-9 shrink-0 place-items-center border border-[#fff8e9]/45 text-[#fff8e9] hover:bg-[#fff8e9] hover:text-[#172d29]" aria-label="关闭资源详情" title="关闭"><X className="size-4" /></button></div>
      <p className="mt-3 text-sm text-[#d3dfd9]">{node.resource.creators.join("、") || "策展资料"}{node.resource.publishedYear ? ` · ${node.resource.publishedYear}` : ""}</p>
      <p className="mt-6 text-sm leading-7 text-[#edf2e9]">{node.resource.summary || "这本书的详细介绍尚未补充。"}</p>
      {node.resource.tags.length ? <div className="mt-5 flex flex-wrap gap-2">{node.resource.tags.map((tag) => <span key={tag.id} className="border border-[#fff8e9]/35 px-2.5 py-1 text-xs text-[#d3dfd9]">{tag.name}</span>)}</div> : null}
      {!node.isCenter ? <div className="mt-6 border-l-2 border-[#e5c454] pl-3"><p className="text-xs text-[#e5c454]">关联依据</p><ul className="mt-2 space-y-2 text-sm leading-6 text-[#edf2e9]">{node.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div> : null}
      {node.affinity !== null ? <p className="mt-5 text-xs text-[#d3dfd9]">阅读偏好匹配度 {Math.round(node.affinity * 100)}%</p> : null}
      <div className="mt-7 flex flex-wrap gap-3"><Link href={`/resources/${node.resource.slug}`} className="inline-flex h-10 items-center border border-[#fff8e9]/60 px-3 text-sm text-[#fff8e9] hover:bg-[#fff8e9] hover:text-[#172d29]">打开资源</Link><SaveResourceButton resourceId={node.resource.id} isSaved={node.isSaved} compact /></div>
    </section>
  </div>;
}

function BubbleGraph({ graph, selectedId, onSelect }: { graph: BookRelationGraph; selectedId: string; onSelect: (id: string) => void }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const justDraggedNodeRef = useRef<string | null>(null);
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [viewport, setViewport] = useState<Viewport>({ scale: 1, x: 0, y: 0 });

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    let frame = 0;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      if (width < 1 || height < 1) return;
      const nodes = graph.nodes.map((node) => ({ ...node })) as ForceNode[];
      const links: ForceEdge[] = graph.edges.map((edge) => ({ source: edge.sourceId, target: edge.targetId, strength: edge.strength }));
      const simulation = forceSimulation(nodes)
        .force("link", forceLink<ForceNode, ForceEdge>(links).id((node) => node.resource.id).distance((edge) => 165 - edge.strength * 14).strength((edge) => 0.25 + edge.strength * 0.12))
        .force("charge", forceManyBody().strength(-360))
        .force("collide", forceCollide<ForceNode>((node) => nodeRadius(node) + 12).iterations(2))
        .force("center", forceCenter(width / 2, height / 2))
        .stop();
      for (let index = 0; index < 220; index += 1) simulation.tick();
      const next = new Map(nodes.map((node) => {
        const radius = nodeRadius(node) + 12;
        return [node.resource.id, { x: Math.min(width - radius, Math.max(radius, node.x ?? width / 2)), y: Math.min(height - radius, Math.max(radius, node.y ?? height / 2)) }];
      }));
      frame = window.requestAnimationFrame(() => setPositions(next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => { observer.disconnect(); window.cancelAnimationFrame(frame); };
  }, [graph]);

  const clampPosition = (node: BookRelationNode, x: number, y: number) => {
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return { x, y };
    const radius = nodeRadius(node) + 12;
    return { x: Math.min(bounds.width - radius, Math.max(radius, x)), y: Math.min(bounds.height - radius, Math.max(radius, y)) };
  };

  const startDrag = (event: React.PointerEvent<HTMLButtonElement>, node: BookRelationNode) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    dragRef.current = { kind: "node", nodeId: node.resource.id, pointerId: event.pointerId, lastX: event.clientX, lastY: event.clientY, moved: false };
    canvasRef.current?.setPointerCapture(event.pointerId);
  };

  const startPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as Element;
    if (target.closest("button")) return;
    dragRef.current = { kind: "canvas", pointerId: event.pointerId, lastX: event.clientX, lastY: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.lastX;
    const deltaY = event.clientY - drag.lastY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 2) drag.moved = true;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    if (drag.kind === "canvas") {
      setViewport((current) => ({ ...current, x: current.x + deltaX, y: current.y + deltaY }));
      return;
    }
    const nodeId = drag.nodeId;
    if (!nodeId) return;
    const node = graph.nodes.find((item) => item.resource.id === nodeId);
    if (!node) return;
    setPositions((current) => {
      const position = current.get(nodeId);
      if (!position) return current;
      const next = new Map(current);
      next.set(nodeId, clampPosition(node, position.x + deltaX / viewport.scale, position.y + deltaY / viewport.scale));
      return next;
    });
  };

  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.kind === "node" && drag.moved) {
      justDraggedNodeRef.current = drag.nodeId ?? null;
      window.setTimeout(() => { justDraggedNodeRef.current = null; }, 250);
    }
    if (drag.kind === "node" && !drag.moved && drag.nodeId) onSelect(drag.nodeId);
    dragRef.current = null;
  };

  const zoom = (amount: number) => setViewport((current) => ({ ...current, scale: Math.max(0.7, Math.min(1.6, Number((current.scale + amount).toFixed(2)))) }));
  const resetView = () => setViewport({ scale: 1, x: 0, y: 0 });

  return <div ref={canvasRef} className="relative min-h-[40rem] touch-none overflow-hidden bg-[#172d29]" aria-label="资源关联气泡图" onPointerDown={startPan} onPointerMove={move} onPointerUp={finishDrag} onPointerCancel={finishDrag}>
    <div className="absolute left-4 top-4 z-20 flex gap-1"><button type="button" onClick={() => zoom(-0.15)} className="grid size-9 place-items-center border border-[#fff8e9]/35 bg-[#172d29] text-[#fff8e9] hover:bg-[#254a42]" aria-label="缩小气泡图" title="缩小"><Minus className="size-4" /></button><button type="button" onClick={resetView} className="grid size-9 place-items-center border border-[#fff8e9]/35 bg-[#172d29] text-[#fff8e9] hover:bg-[#254a42]" aria-label="重置气泡图视图" title="重置视图"><RotateCcw className="size-4" /></button><button type="button" onClick={() => zoom(0.15)} className="grid size-9 place-items-center border border-[#fff8e9]/35 bg-[#172d29] text-[#fff8e9] hover:bg-[#254a42]" aria-label="放大气泡图" title="放大"><Plus className="size-4" /></button></div>
    <div className="absolute bottom-4 left-4 z-20 flex max-w-[calc(100%-2rem)] flex-wrap gap-x-3 gap-y-1.5 border border-[#fff8e9]/20 bg-[#172d29]/90 px-3 py-2 text-xs text-[#d3dfd9]">{relationTypes.map((type) => <span key={type} className="inline-flex items-center gap-1.5"><i aria-hidden="true" className="h-px w-5" style={{ backgroundColor: relationStyles[type].color, backgroundImage: relationStyles[type].dash ? `repeating-linear-gradient(90deg, ${relationStyles[type].color} 0 5px, transparent 5px 8px)` : undefined }} />{relationStyles[type].label}</span>)}</div>
    <div className="absolute inset-0 origin-center transition-transform duration-200 motion-reduce:transition-none" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})` }}>
      <svg className="absolute inset-0 size-full" aria-hidden="true"><defs>{relationTypes.map((type) => <marker key={type} id={`relation-arrow-${type}`} markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M 0 0 L 9 4.5 L 0 9 z" fill={relationStyles[type].color} /></marker>)}</defs>{graph.edges.map((edge) => { const source = positions.get(edge.sourceId); const target = positions.get(edge.targetId); const sourceNode = graph.nodes.find((node) => node.resource.id === edge.sourceId); const targetNode = graph.nodes.find((node) => node.resource.id === edge.targetId); if (!source || !target || !sourceNode || !targetNode) return null; const deltaX = target.x - source.x; const deltaY = target.y - source.y; const distance = Math.hypot(deltaX, deltaY); if (distance < 1) return null; const sourceOffset = nodeRadius(sourceNode) + 4; const targetOffset = nodeRadius(targetNode) + 8; const x1 = source.x + deltaX / distance * sourceOffset; const y1 = source.y + deltaY / distance * sourceOffset; const x2 = target.x - deltaX / distance * targetOffset; const y2 = target.y - deltaY / distance * targetOffset; const style = relationStyles[edge.type]; return <line key={edge.id} data-relation-type={edge.type} data-direction={edge.direction} data-source-resource-id={edge.sourceId} data-target-resource-id={edge.targetId} x1={x1} y1={y1} x2={x2} y2={y2} stroke={style.color} strokeDasharray={style.dash} strokeWidth={0.7 + edge.strength * 0.4} markerEnd={`url(#relation-arrow-${edge.type})`} opacity={0.55 + edge.strength * 0.08} />; })}</svg>
      {graph.nodes.map((node) => {
        const position = positions.get(node.resource.id);
        if (!position) return null;
        const selected = node.resource.id === selectedId;
        const diameter = nodeRadius(node) * 2;
        const radius = nodeRadius(node) + 12;
        return <button key={node.resource.id} type="button" onPointerDown={(event) => startDrag(event, node)} onClick={() => { if (justDraggedNodeRef.current === node.resource.id) return; onSelect(node.resource.id); }} aria-pressed={selected} data-affinity={node.affinity ?? undefined} className={`absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border px-3 text-center shadow-[4px_4px_0_rgb(0_0_0_/_26%)] transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e5c454] motion-reduce:transition-none ${selected ? "border-[#fff8e9]" : "border-[#172d29]/70"}`} style={{ left: `clamp(${radius}px, ${position.x}px, calc(100% - ${radius}px))`, top: `clamp(${radius}px, ${position.y}px, calc(100% - ${radius}px))`, width: diameter, height: diameter, background: nodeTone(node), color: "#172d29", filter: node.affinity === null ? undefined : `brightness(${0.82 + node.affinity * 0.38})` }}><span className="line-clamp-3 font-serif text-xs leading-tight">{node.resource.title}</span></button>;
      })}
    </div>
  </div>;
}

export function BookMapClient({ initialSlug }: { initialSlug?: string }) {
  const client = useMemo(() => {
    try { return createSupabaseBrowserClient(); } catch { return null; }
  }, []);
  const [state, setState] = useState<LoadState>("loading");
  const [catalog, setCatalog] = useState<ResourceListItem[]>([]);
  const [query, setQuery] = useState("");
  const [center, setCenter] = useState<ResourceListItem | null>(null);
  const [graph, setGraph] = useState<BookRelationGraph | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [message, setMessage] = useState("");
  const relationRequestRef = useRef<AbortController | null>(null);
  const relationRequestIdRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/resources?limit=50", { cache: "no-store", signal: controller.signal });
        if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("资源目录返回了非预期响应，请稍后重试。");
        const body = await response.json() as CatalogResponse;
        if (!response.ok || !body.data) throw new Error("无法读取资源目录。");
        setCatalog(body.data.items);
        setState("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMessage(error instanceof Error ? error.message : "无法读取资源目录。");
        setState("error");
      }
    })();
    return () => controller.abort();
  }, []);

  const loadBook = useCallback(async (book: ResourceListItem) => {
    relationRequestRef.current?.abort();
    const controller = new AbortController();
    relationRequestRef.current = controller;
    const requestId = ++relationRequestIdRef.current;
    setCenter(book);
    setSelectedId(book.id);
    setGraph(null);
    setDetailOpen(false);
    setMessage("");
    try {
      const session = client ? await client.auth.getSession() : { data: { session: null } };
      if (controller.signal.aborted || requestId !== relationRequestIdRef.current) return;
      const response = await fetch(`/api/resources/${encodeURIComponent(book.slug)}/constellation?depth=1`, { cache: "no-store", signal: controller.signal, headers: session.data.session ? { Authorization: `Bearer ${session.data.session.access_token}` } : undefined });
      if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("人工关系暂时无法读取。");
      const body = await response.json() as ConstellationResponse;
      if (!response.ok || !body.data) {
        const message = "error" in body ? body.error.message : "人工关系暂时无法读取。";
        throw new Error(message);
      }
      if (controller.signal.aborted || requestId !== relationRequestIdRef.current) return;
      setGraph(createBookRelationGraph(body.data));
    } catch (error) {
      if (controller.signal.aborted || requestId !== relationRequestIdRef.current) return;
      setMessage(error instanceof Error ? error.message : "人工关系暂时无法读取。");
    } finally {
      if (relationRequestRef.current === controller) relationRequestRef.current = null;
    }
  }, [client]);

  useEffect(() => () => relationRequestRef.current?.abort(), []);

  useEffect(() => {
    if (!initialSlug || state !== "ready" || center) return;
    const initialBook = catalog.find((book) => book.slug === initialSlug);
    if (!initialBook) return;
    const request = window.setTimeout(() => void loadBook(initialBook), 0);
    return () => window.clearTimeout(request);
  }, [catalog, center, initialSlug, loadBook, state]);

  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return catalog.slice(0, 8);
    return catalog.filter((book) => `${book.title} ${book.creators.join(" ")}`.toLocaleLowerCase().includes(normalized)).slice(0, 8);
  }, [catalog, query]);
  const selectedNode = graph?.nodes.find((node) => node.resource.id === selectedId) ?? null;
  const initialSlugUnsupported = Boolean(initialSlug && state === "ready" && !center && !catalog.some((book) => book.slug === initialSlug));
  const notice = message || (initialSlugUnsupported ? "关联图起点不在公开资源目录中。" : "");

  return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
    <div className="max-w-3xl"><p className="text-sm text-[#a23b2c]">资源关联图</p><h1 className="mt-2 font-serif text-4xl leading-tight">从一条资源，展开它的探索邻域</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-[#52625d]">每一条带箭头的连线都对应资源目录中的人工策展关系；节点大小与线条粗细反映关系强度。</p></div>
    <section className="mt-8 border-y border-[#254a42]/20 py-6"><label htmlFor="book-map-search" className="text-sm text-[#45554f]">输入资源名称</label><div className="mt-2 flex max-w-xl border border-[#254a42] bg-[#fffdf5]"><Search className="m-3.5 size-5 text-[#254a42]" /><input id="book-map-search" value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent py-3 outline-none" placeholder="例如：The Age of AI" autoComplete="off" /></div>{state === "loading" ? <p className="mt-3 text-sm text-[#52625d]">正在准备资源目录...</p> : null}{state === "error" ? <p className="mt-3 text-sm text-[#a23b2c]" role="status">{notice}</p> : null}{state === "ready" ? <div className="mt-3 flex flex-wrap gap-2" aria-label="匹配资源">{matches.map((book) => <button key={book.id} type="button" onClick={() => void loadBook(book)} className={`border px-3 py-2 text-left text-sm ${center?.id === book.id ? "border-[#254a42] bg-[#254a42] text-[#fff8e9]" : "border-[#254a42]/30 text-[#254a42] hover:bg-[#e4e7d4]"}`}><span className="block font-medium">{book.title}</span><span className="mt-1 block text-xs opacity-75">{book.creators.join("、")}</span></button>)}</div> : null}</section>
    {notice && state !== "error" ? <p className="mt-4 text-sm text-[#a23b2c]" role="status">{notice}</p> : null}
    {!center && state === "ready" ? <section className="mt-8 border border-dashed border-[#254a42]/30 px-6 py-16 text-center"><Network className="mx-auto size-8 text-[#a23b2c]" /><h2 className="mt-4 font-serif text-3xl">先选一条资源</h2><p className="mt-3 text-sm text-[#52625d]">从目录中选择起点后，关联气泡会在这里展开。</p></section> : null}
    {center && graph ? <section className="mt-8 overflow-hidden border border-[#172d29] bg-[#172d29]"><BubbleGraph graph={graph} selectedId={selectedId} onSelect={(id) => { setSelectedId(id); setDetailOpen(true); }} /></section> : null}
    {center && graph && graph.nodes.length === 1 ? <section className="mt-6 flex items-start gap-3 border-l-2 border-[#a23b2c] pl-4"><CircleAlert className="mt-0.5 size-5 text-[#a23b2c]" /><p className="text-sm leading-6 text-[#52625d]">目录中暂时没有可解释的关联资源。可以换一条资源，或继续浏览这条资源的详情。</p></section> : null}
    <div className="mt-8 flex items-start gap-3 border-t border-[#254a42]/20 pt-5 text-sm leading-6 text-[#52625d]"><Sparkles className="mt-0.5 size-4 text-[#a23b2c]" /><p>每个气泡仅代表本地目录中已有资源；不会生成目录外资源，也不会将人工关系伪装为学术引文指标。</p></div>
    {detailOpen && selectedNode ? <BookDetailDialog node={selectedNode} onClose={() => setDetailOpen(false)} /> : null}
  </main>;
}
