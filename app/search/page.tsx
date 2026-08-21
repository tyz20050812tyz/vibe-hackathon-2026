import Link from "next/link";
import { Search, X } from "lucide-react";

import { CatalogHeader } from "@/components/resources/catalog-header";
import { ResourceList } from "@/components/resources/resource-list";
import { popularTags, searchMockResources, toListItem } from "@/lib/mocks/resources";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; tag?: string }> }) {
  const { q = "", tag = "" } = await searchParams;
  const items = searchMockResources(q, tag || null).map(toListItem);
  const activeTag = popularTags.find((item) => item.slug === tag);
  const clearHref = q ? `/search?q=${encodeURIComponent(q)}` : "/search";
  return <div className="min-h-screen bg-[#fff8e9] text-[#172d29]"><CatalogHeader /><main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><p className="text-sm text-[#a23b2c]">资源目录</p><h1 className="mt-2 font-serif text-4xl">寻找一条阅读线索</h1><form action="/search" className="mt-7 flex max-w-2xl border border-[#254a42] bg-[#fffdf5]"><label className="sr-only" htmlFor="catalog-search">搜索资源</label><Search className="m-3.5 size-5 text-[#254a42]" /><input id="catalog-search" name="q" defaultValue={q} className="min-w-0 flex-1 bg-transparent py-3 outline-none" placeholder="标题、作者或摘要" /><button type="submit" className="border-l border-[#254a42] px-4 text-sm hover:bg-[#254a42] hover:text-[#fff8e9]">搜索</button></form><div className="mt-5 flex flex-wrap gap-2">{popularTags.map((item) => <Link key={item.id} href={`/search?${new URLSearchParams({ ...(q ? { q } : {}), tag: item.slug })}`} aria-current={item.slug === tag ? "page" : undefined} className={`border px-3 py-1.5 text-sm ${item.slug === tag ? "border-[#254a42] bg-[#254a42] text-[#fff8e9]" : "border-[#254a42]/35 text-[#254a42] hover:bg-[#e4e7d4]"}`}>{item.name}</Link>)}</div><div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_12rem]"><section><div className="flex items-center justify-between border-b border-[#254a42]/20 pb-3"><p className="text-sm text-[#52625d]">{q || activeTag ? `找到 ${items.length} 条资源` : "浏览全部资源"}</p>{activeTag ? <Link href={clearHref} className="inline-flex items-center gap-1 text-sm text-[#254a42] hover:underline"><X className="size-4" />清除 {activeTag.name}</Link> : null}</div><ResourceList resources={items} /></section><aside className="border-l border-[#254a42]/20 pl-5"><p className="text-sm text-[#a23b2c]">本次目录</p><p className="mt-2 font-serif text-xl">先在公共目录中探索，再将真正想保留的线索放入个人书架。</p></aside></div></main></div>;
}
