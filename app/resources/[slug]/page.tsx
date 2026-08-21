import Link from "next/link";
import { ArrowLeft, ExternalLink, MapPin, Monitor } from "lucide-react";
import { notFound } from "next/navigation";

import { CatalogHeader } from "@/components/resources/catalog-header";
import { ResourceCover } from "@/components/resources/resource-cover";
import { ResourceList } from "@/components/resources/resource-list";
import { findRelated, findResource } from "@/lib/mocks/resources";

export default async function ResourcePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const resource = findResource(slug);
  if (!resource) notFound();
  const online = resource.availability === "online";
  return <div className="min-h-screen bg-[#fff8e9] text-[#172d29]"><CatalogHeader /><main className="mx-auto max-w-5xl px-5 py-10 sm:px-8"><Link href="/search" className="inline-flex items-center gap-1 text-sm text-[#254a42] hover:underline"><ArrowLeft className="size-4" />返回资源目录</Link><section className="mt-8 grid gap-8 md:grid-cols-[15rem_minmax(0,1fr)]"><ResourceCover resource={resource} /><div><p className="text-sm text-[#a23b2c]">{resource.type === "collection" ? "策展专题" : resource.type === "paper" ? "研究论文" : "馆藏图书"}</p><h1 className="mt-2 font-serif text-4xl leading-tight">{resource.title}</h1>{resource.subtitle ? <p className="mt-2 text-lg text-[#52625d]">{resource.subtitle}</p> : null}<p className="mt-5 text-base text-[#45554f]">{resource.creators.join("、")}{resource.publishedYear ? `，${resource.publishedYear}` : ""}</p><p className="mt-6 max-w-2xl text-base leading-8 text-[#45554f]">{resource.summary}</p><div className="mt-6 flex flex-wrap gap-2">{resource.tags.map((tag) => <Link key={tag.id} href={`/search?tag=${tag.slug}`} className="border border-[#254a42]/30 px-3 py-1.5 text-sm text-[#254a42] hover:bg-[#e4e7d4]">{tag.name}</Link>)}</div><dl className="mt-8 grid gap-4 border-y border-[#254a42]/20 py-5 text-sm sm:grid-cols-2"><div><dt className="text-[#78837c]">可读状态</dt><dd className="mt-1 flex items-center gap-1.5">{online ? <Monitor className="size-4" /> : <MapPin className="size-4" />}{online ? "可在线阅读" : resource.availability === "available" ? "馆内可读" : "馆藏待查"}</dd></div><div><dt className="text-[#78837c]">位置</dt><dd className="mt-1">{resource.location ?? "在线资源"}</dd></div></dl>{resource.externalUrl ? <a href={resource.externalUrl} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 border border-[#254a42] px-4 py-2 text-sm hover:bg-[#254a42] hover:text-[#fff8e9]">前往外部阅读 <ExternalLink className="size-4" /></a> : null}</div></section><section className="mt-16 max-w-3xl"><p className="text-sm text-[#a23b2c]">继续探索</p><h2 className="mt-2 font-serif text-3xl">你或许会走向这里</h2><ResourceList resources={findRelated(resource)} /></section></main></div>;
}
