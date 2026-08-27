"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ExternalLink, MapPin, Monitor, Orbit } from "lucide-react";
import { useEffect, useState } from "react";

import { ResourceCover } from "@/components/resources/resource-cover";
import { DiscoveryPanel } from "@/components/resources/discovery-panel";
import { ResourceList } from "@/components/resources/resource-list";
import { SaveResourceButton } from "@/components/resources/save-resource-button";
import { availabilityLabel, resourceTypeLabel } from "@/lib/resource-presentation";
import type { ApiFailure, ApiSuccess } from "@/lib/types/api";
import type { GetResourceData } from "@/lib/types/resources";

type LoadState = "loading" | "success" | "empty" | "error";

export function ResourceDetailClient({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const discoveryContext = searchParams.get("discoveryContext");
  const [state, setState] = useState<LoadState>("loading");
  const [data, setData] = useState<GetResourceData | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/resources/${encodeURIComponent(slug)}`, { cache: "no-store", signal: controller.signal });
        const body = await response.json() as ApiSuccess<GetResourceData> | ApiFailure;
        if (response.status === 404) { setState("empty"); return; }
        if (!response.ok || !body.data) throw new Error("error" in body && body.error ? body.error.message : "资源详情暂时无法读取。");
        setData(body.data); setState("success");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMessage(error instanceof Error ? error.message : "资源详情暂时无法读取。"); setState("error");
      }
    })();
    return () => controller.abort();
  }, [slug]);

  if (state === "loading") return <div className="mx-auto max-w-5xl px-5 py-16 text-[#52625d]">正在取出这本资源...</div>;
  if (state === "empty") return <div className="mx-auto max-w-5xl px-5 py-16 text-[#172d29]"><p className="font-serif text-3xl">这条书架线索不存在。</p><Link href="/search" className="mt-4 inline-block text-[#254a42] underline">回到资源目录</Link></div>;
  if (state === "error" || !data) return <div className="mx-auto max-w-5xl px-5 py-16 text-[#a23b2c]"><p>{message || "资源详情暂时无法读取。"}</p><Link href="/search" className="mt-4 inline-block text-[#254a42] underline">回到资源目录</Link></div>;

  const { resource, related } = data;
  const online = resource.availability === "online";
  return <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8"><Link href="/search" className="inline-flex items-center gap-1 text-sm text-[#254a42] hover:underline"><ArrowLeft className="size-4" />返回资源目录</Link><section className="mt-8 grid gap-8 md:grid-cols-[15rem_minmax(0,1fr)]"><ResourceCover resource={resource} /><div><p className="text-sm text-[#a23b2c]">{resourceTypeLabel(resource.type)}</p><h1 className="mt-2 font-serif text-4xl leading-tight">{resource.title}</h1>{resource.subtitle ? <p className="mt-2 text-lg text-[#52625d]">{resource.subtitle}</p> : null}<p className="mt-5 text-base text-[#45554f]">{resource.creators.join("、")}{resource.publishedYear ? `，${resource.publishedYear}` : ""}</p><p className="mt-6 max-w-2xl text-base leading-8 text-[#45554f]">{resource.summary}</p><div className="mt-6 flex flex-wrap gap-2">{resource.tags.map((tag) => <Link key={tag.id} href={`/search?tag=${tag.slug}`} className="border border-[#254a42]/30 px-3 py-1.5 text-sm text-[#254a42] hover:bg-[#e4e7d4]">{tag.name}</Link>)}</div><p className="mt-5 border-l-2 border-[#a23b2c] pl-3 text-sm leading-6 text-[#52625d]">馆藏状态与位置为演示信息，非实时馆藏数据。</p><dl className="mt-6 grid gap-4 border-y border-[#254a42]/20 py-5 text-sm sm:grid-cols-2"><div><dt className="text-[#78837c]">可读状态</dt><dd className="mt-1 flex items-center gap-1.5">{online ? <Monitor className="size-4" /> : <MapPin className="size-4" />}{availabilityLabel(resource.availability)}</dd></div><div><dt className="text-[#78837c]">位置</dt><dd className="mt-1">{online ? "在线资源" : resource.location ?? "馆藏位置待确认"}</dd></div></dl><div className="mt-6 flex flex-wrap gap-3"><Link href={`/resources/${resource.slug}/constellation`} className="inline-flex h-10 items-center gap-2 border border-[#254a42] px-4 text-sm text-[#254a42] hover:bg-[#254a42] hover:text-[#fff8e9]"><Orbit className="size-4" />查看资源星图</Link></div><SaveResourceButton resourceId={resource.id} />{resource.externalUrl ? <a href={resource.externalUrl} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 border border-[#254a42] px-4 py-2 text-sm hover:bg-[#254a42] hover:text-[#fff8e9]">前往外部阅读 <ExternalLink className="size-4" /></a> : null}</div></section><DiscoveryPanel originResourceId={resource.id} discoveryContext={discoveryContext} /><section className="mt-16 max-w-3xl"><p className="text-sm text-[#a23b2c]">继续探索</p><h2 className="mt-2 font-serif text-3xl">你或许会走向这里</h2><ResourceList resources={related} /></section></main>;
}
