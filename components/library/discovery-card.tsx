import Link from "next/link";
import { ArrowUpRight, Compass, RefreshCw, Sparkles } from "lucide-react";

import type { DiscoveryItem } from "@/lib/types/discovery";

const relationLabel = {
  unexpected_bridge: "意外连接",
  same_theme: "同主题延伸",
  contrasting_view: "换一个观点",
  historical_context: "回到历史语境",
} as const;

export type { DiscoveryItem };

export function DiscoveryCard({ items, sourceTitle, loading, error, onRetry }: {
  items: DiscoveryItem[];
  sourceTitle: string | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  return <section className="border border-[#254a42] bg-[#244f46] p-5 text-[#fff8e9] sm:p-6">
    <div className="flex items-start justify-between gap-5"><div><p className="flex items-center gap-2 text-sm text-[#e4e7d4]"><Compass className="size-4" />下一条阅读偏离</p><h2 className="mt-3 font-serif text-3xl">带我偏离一点</h2></div><Sparkles className="size-6 text-[#d2a85a]" aria-hidden="true" /></div>
    {loading ? <p className="mt-7 text-sm text-[#e4e7d4]">正在寻找一条不同的路径...</p> : error ? <div className="mt-7 border-l-2 border-[#d2a85a] pl-4"><p className="text-sm leading-6 text-[#e4e7d4]">{error}</p><button type="button" onClick={onRetry} className="mt-4 inline-flex items-center gap-2 text-sm hover:underline"><RefreshCw className="size-4" />重新尝试</button></div> : items.length ? <div className="mt-7"><p className="text-sm leading-6 text-[#e4e7d4]">{sourceTitle ? `从「${sourceTitle}」出发，换一个角度继续读。` : "换一个角度继续读。"}</p><div className="mt-5 divide-y divide-[#fff8e9]/20 border-y border-[#fff8e9]/20">{items.slice(0, 3).map((item) => <article key={item.id} className="py-4 first:pt-4 last:pb-4"><p className="text-xs text-[#d2a85a]">{relationLabel[item.relationType]}</p><div className="mt-1 flex items-start justify-between gap-4"><div><h3 className="font-serif text-xl"><Link href={`/resources/${item.slug}`} className="hover:underline">{item.title}</Link></h3><p className="mt-2 text-sm leading-6 text-[#e4e7d4]">{item.explanation}</p></div><Link href={`/resources/${item.slug}`} aria-label={`查看 ${item.title}`} className="grid size-8 shrink-0 place-items-center border border-[#fff8e9]/35 hover:bg-[#fff8e9] hover:text-[#244f46]"><ArrowUpRight className="size-4" /></Link></div></article>)}</div></div> : <p className="mt-7 max-w-md text-sm leading-6 text-[#e4e7d4]">先收藏一条线索，再从它出发，看看它会把你带向哪里。</p>}
  </section>;
}
