import Link from "next/link";
import { ArrowUpRight, MapPin, Monitor } from "lucide-react";

import { ResourceCover } from "@/components/resources/resource-cover";
import type { ResourceListItem } from "@/lib/types/resources";

export function ResourceCard({ resource }: { resource: ResourceListItem }) {
  const online = resource.availability === "online";
  return <article className="group grid grid-cols-[5.5rem_1fr] gap-4 border-t border-[#254a42]/20 py-5 first:border-t-0 sm:grid-cols-[7rem_1fr]"><ResourceCover resource={resource} /><div className="flex min-w-0 flex-col items-start"><p className="text-xs text-[#a23b2c]">{resource.type === "book" ? "图书" : resource.type === "paper" ? "论文" : "专题"}</p><h3 className="mt-1 font-serif text-xl leading-snug text-[#172d29]"><Link className="outline-none focus-visible:underline" href={`/resources/${resource.slug}`}>{resource.title}<span className="sr-only">，查看详情</span></Link></h3><p className="mt-1 text-sm text-[#52625d]">{resource.creators.join("、")}</p><p className="mt-3 line-clamp-2 text-sm leading-6 text-[#45554f]">{resource.summary}</p><div className="mt-3 flex flex-wrap gap-1.5">{resource.tags.slice(0, 3).map((tag) => <Link key={tag.id} href={`/search?tag=${tag.slug}`} className="border border-[#254a42]/25 px-2 py-1 text-xs text-[#254a42] hover:bg-[#e4e7d4]">{tag.name}</Link>)}</div><div className="mt-auto flex w-full items-center justify-between pt-4 text-xs text-[#52625d]"><span className="inline-flex items-center gap-1">{online ? <Monitor className="size-3.5" /> : <MapPin className="size-3.5" />}{online ? "可在线阅读" : resource.availability === "available" ? "馆内可读" : "馆藏待查"}</span><Link href={`/resources/${resource.slug}`} aria-label={`查看 ${resource.title}`} className="inline-flex size-8 items-center justify-center border border-[#254a42]/25 text-[#254a42] hover:bg-[#254a42] hover:text-[#fff8e9]"><ArrowUpRight className="size-4" /></Link></div></div></article>;
}
