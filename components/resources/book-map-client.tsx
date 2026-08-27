"use client";

import Link from "next/link";
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from "d3-force";
import { CircleAlert, Network, Search, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { SaveResourceButton } from "@/components/resources/save-resource-button";
import { createBookSimilarityGraph, type BookSimilarityGraph, type BookSimilarityNode, type CuratedBookRelation } from "@/lib/book-similarity";
import type { ApiFailure, ApiSuccess } from "@/lib/types/api";
import type { ConstellationData } from "@/lib/types/constellation";
import type { ResourceListItem, SearchResourcesData } from "@/lib/types/resources";

type CatalogResponse = ApiSuccess<SearchResourcesData> | ApiFailure;
type ConstellationResponse = ApiSuccess<ConstellationData> | ApiFailure;
type LoadState = "loading" | "ready" | "error";

type ForceNode = BookSimilarityNode & { x?: number; y?: number };
type ForceEdge = { source: string | ForceNode; target: string | ForceNode; similarity: number };

function nodeRadius(node: BookSimilarityNode) {
  return node.isCenter ? 58 : 28 + node.similarity * 25;
}

function nodeTone(node: BookSimilarityNode) {
  if (node.isCenter) return "#e5c454";
  if (node.relationType === "unexpected_bridge") return "#b28cc7";
  if (node.relationType === "contrasting_view") return "#e87857";
  if (node.relationType === "historical_context") return "#77b7b2";
  return "#d3dfd9";
}

function BubbleGraph({ graph, selectedId, onSelect }: { graph: BookSimilarityGraph; selectedId: string; onSelect: (id: string) => void }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    let frame = 0;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      if (width < 1 || height < 1) return;
      const nodes = graph.nodes.map((node) => ({ ...node })) as ForceNode[];
      const links: ForceEdge[] = graph.edges.map((edge) => ({
        source: edge.sourceId,
        target: edge.targetId,
        similarity: edge.similarity,
      }));
      const simulation = forceSimulation(nodes)
        .force("link", forceLink<ForceNode, ForceEdge>(links).id((node) => node.resource.id).distance((edge) => 155 - edge.similarity * 70).strength((edge) => 0.25 + edge.similarity * 0.55))
        .force("charge", forceManyBody().strength(-360))
        .force("collide", forceCollide<ForceNode>((node) => nodeRadius(node) + 12).iterations(2))
        .force("center", forceCenter(width / 2, height / 2))
        .stop();
      for (let index = 0; index < 220; index += 1) simulation.tick();
      const next = new Map(nodes.map((node) => {
        const radius = nodeRadius(node) + 12;
        return [node.resource.id, {
          x: Math.min(width - radius, Math.max(radius, node.x ?? width / 2)),
          y: Math.min(height - radius, Math.max(radius, node.y ?? height / 2)),
        }];
      }));
      frame = window.requestAnimationFrame(() => setPositions(next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => { observer.disconnect(); window.cancelAnimationFrame(frame); };
  }, [graph]);

  return <div ref={canvasRef} className="relative min-h-[40rem] overflow-hidden bg-[#172d29]" aria-label="书籍气泡关联图">
    <svg className="absolute inset-0 size-full" aria-hidden="true">
      {graph.edges.map((edge, index) => {
        const source = positions.get(edge.sourceId);
        const target = positions.get(edge.targetId);
        if (!source || !target) return null;
        return <line key={`${edge.sourceId}-${edge.targetId}-${index}`} x1={source.x} y1={source.y} x2={target.x} y2={target.y} stroke="#d3dfd9" strokeWidth={0.7 + edge.similarity * 2} opacity={0.18 + edge.similarity * 0.4} />;
      })}
    </svg>
    {graph.nodes.map((node) => {
      const position = positions.get(node.resource.id);
      if (!position) return null;
      const selected = node.resource.id === selectedId;
      const diameter = nodeRadius(node) * 2;
      const radius = nodeRadius(node) + 12;
      return <button key={node.resource.id} type="button" onClick={() => onSelect(node.resource.id)} aria-pressed={selected} className={`absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border px-3 text-center shadow-[4px_4px_0_rgb(0_0_0_/_26%)] transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e5c454] motion-reduce:transition-none ${selected ? "border-[#fff8e9]" : "border-[#172d29]/70"}`} style={{ left: `clamp(${radius}px, ${position.x}px, calc(100% - ${radius}px))`, top: `clamp(${radius}px, ${position.y}px, calc(100% - ${radius}px))`, width: diameter, height: diameter, background: nodeTone(node), color: "#172d29" }}><span className="line-clamp-3 font-serif text-xs leading-tight">{node.resource.title}</span></button>;
    })}
  </div>;
}

function BookDetail({ node }: { node: BookSimilarityNode }) {
  return <aside className="border-t border-[#fff8e9]/20 p-5 lg:border-l lg:border-t-0" aria-live="polite">
    <p className="text-xs text-[#e5c454]">{node.isCenter ? "起点图书" : `关联度 ${Math.round(node.similarity * 100)}%`}</p>
    <h2 className="mt-2 font-serif text-2xl leading-tight text-[#fff8e9]">{node.resource.title}</h2>
    <p className="mt-2 text-sm text-[#d3dfd9]">{node.resource.creators.join("、") || "策展资料"}{node.resource.publishedYear ? ` · ${node.resource.publishedYear}` : ""}</p>
    <div className="mt-5 border-l-2 border-[#e5c454] pl-3"><p className="text-xs text-[#e5c454]">关联依据</p><ul className="mt-2 space-y-2 text-sm leading-6 text-[#edf2e9]">{node.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>
    <div className="mt-6 flex flex-wrap gap-3"><Link href={`/resources/${node.resource.slug}`} className="inline-flex h-10 items-center border border-[#fff8e9]/60 px-3 text-sm text-[#fff8e9] hover:bg-[#fff8e9] hover:text-[#172d29]">打开资源</Link><SaveResourceButton resourceId={node.resource.id} compact /></div>
  </aside>;
}

export function BookMapClient() {
  const [state, setState] = useState<LoadState>("loading");
  const [catalog, setCatalog] = useState<ResourceListItem[]>([]);
  const [query, setQuery] = useState("");
  const [center, setCenter] = useState<ResourceListItem | null>(null);
  const [graph, setGraph] = useState<BookSimilarityGraph | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/resources?type=book&limit=50", { cache: "no-store", signal: controller.signal });
        if (!response.headers.get("content-type")?.includes("application/json")) {
          throw new Error("图书目录返回了非预期响应，请稍后重试。");
        }
        const body = await response.json() as CatalogResponse;
        if (!response.ok || !body.data) throw new Error("无法读取图书目录。");
        setCatalog(body.data.items.filter((item) => item.type === "book"));
        setState("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMessage(error instanceof Error ? error.message : "无法读取图书目录。");
        setState("error");
      }
    })();
    return () => controller.abort();
  }, []);

  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return catalog.slice(0, 8);
    return catalog.filter((book) => `${book.title} ${book.creators.join(" ")}`.toLocaleLowerCase().includes(normalized)).slice(0, 8);
  }, [catalog, query]);

  const chooseBook = async (book: ResourceListItem) => {
    setCenter(book);
    setSelectedId(book.id);
    setGraph(null);
    setMessage("");
    try {
      const response = await fetch(`/api/resources/${encodeURIComponent(book.slug)}/constellation?depth=1`, { cache: "no-store" });
      if (!response.headers.get("content-type")?.includes("application/json")) {
        throw new Error("人工关系暂时无法读取。");
      }
      const body = await response.json() as ConstellationResponse;
      const relations: CuratedBookRelation[] = response.ok && body.data
        ? body.data.edges.map((edge) => ({
          resourceId: edge.sourceResourceId === book.id ? edge.targetResourceId : edge.sourceResourceId,
          strength: edge.strength,
          type: edge.relationType,
        }))
        : [];
      const nextGraph = createBookSimilarityGraph(book, catalog, relations);
      setGraph(nextGraph);
    } catch {
      const nextGraph = createBookSimilarityGraph(book, catalog);
      setGraph(nextGraph);
      setMessage("人工关系暂时无法读取，当前只按主题和作者计算关联度。");
    }
  };

  const selectedNode = graph?.nodes.find((node) => node.resource.id === selectedId) ?? graph?.center ?? null;
  return <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
    <div className="max-w-3xl"><p className="text-sm text-[#a23b2c]">书籍关联图</p><h1 className="mt-2 font-serif text-4xl leading-tight">从一本书，展开它的阅读邻域</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-[#52625d]">气泡距离由共同主题、共同作者和人工策展关系共同计算；它表示本项目目录内的内容关联度，不是论文引文相似度。</p></div>
    <section className="mt-8 border-y border-[#254a42]/20 py-6"><label htmlFor="book-map-search" className="text-sm text-[#45554f]">输入图书名称</label><div className="mt-2 flex max-w-xl border border-[#254a42] bg-[#fffdf5]"><Search className="m-3.5 size-5 text-[#254a42]" /><input id="book-map-search" value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent py-3 outline-none" placeholder="例如：The Age of AI" autoComplete="off" /></div>{state === "loading" ? <p className="mt-3 text-sm text-[#52625d]">正在准备图书目录...</p> : null}{state === "error" ? <p className="mt-3 text-sm text-[#a23b2c]" role="status">{message}</p> : null}{state === "ready" ? <div className="mt-3 flex flex-wrap gap-2" aria-label="匹配图书">{matches.map((book) => <button key={book.id} type="button" onClick={() => void chooseBook(book)} className={`border px-3 py-2 text-left text-sm ${center?.id === book.id ? "border-[#254a42] bg-[#254a42] text-[#fff8e9]" : "border-[#254a42]/30 text-[#254a42] hover:bg-[#e4e7d4]"}`}><span className="block font-medium">{book.title}</span><span className="mt-1 block text-xs opacity-75">{book.creators.join("、")}</span></button>)}</div> : null}</section>
    {message && state !== "error" ? <p className="mt-4 text-sm text-[#a23b2c]" role="status">{message}</p> : null}
    {!center && state === "ready" ? <section className="mt-8 border border-dashed border-[#254a42]/30 px-6 py-16 text-center"><Network className="mx-auto size-8 text-[#a23b2c]" /><h2 className="mt-4 font-serif text-3xl">先选一本书</h2><p className="mt-3 text-sm text-[#52625d]">从目录中选择起点后，关联气泡会在这里展开。</p></section> : null}
    {center && graph && selectedNode ? <section className="mt-8 overflow-hidden border border-[#172d29] bg-[#172d29] lg:grid lg:grid-cols-[minmax(0,1fr)_21rem]"><BubbleGraph graph={graph} selectedId={selectedId} onSelect={setSelectedId} /><BookDetail node={selectedNode} /></section> : null}
    {center && graph && graph.nodes.length === 1 ? <section className="mt-6 flex items-start gap-3 border-l-2 border-[#a23b2c] pl-4"><CircleAlert className="mt-0.5 size-5 text-[#a23b2c]" /><p className="text-sm leading-6 text-[#52625d]">目录中暂时没有可解释的关联图书。可以换一本书，或继续浏览这本书的详情。</p></section> : null}
    <div className="mt-8 flex items-start gap-3 border-t border-[#254a42]/20 pt-5 text-sm leading-6 text-[#52625d]"><Sparkles className="mt-0.5 size-4 text-[#a23b2c]" /><p>每个气泡仅代表本地目录中已有图书；不会生成目录外书目，也不会将关联度伪装为学术引文指标。</p></div>
  </main>;
}
