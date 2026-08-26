import Link from "next/link";
import { Search, X } from "lucide-react";

import { CatalogHeader } from "@/components/resources/catalog-header";
import { ResourceList } from "@/components/resources/resource-list";
import { clearSearchFilters, parseSearchFilters, popularTags, serializeSearchFilters } from "@/lib/catalog-filters";
import {
  createDiscoveryContext,
  DiscoveryContextConfigurationError,
} from "@/lib/discovery-context";
import { searchResourceCatalog } from "@/lib/server/resource-api";

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const rawParams = await searchParams;
  const queryString = new URLSearchParams();
  Object.entries(rawParams).forEach(([key, value]) => Array.isArray(value) ? value.forEach((item) => queryString.append(key, item)) : value && queryString.set(key, value));
  let filters;
  try { filters = parseSearchFilters(queryString); }
  catch { return <div className="min-h-screen bg-[#fff8e9] p-10 text-[#a23b2c]">搜索筛选参数不合法，请返回资源目录重新选择。</div>; }
  const q = filters.q ?? "";
  const tag = filters.tag ?? "";
  const result = await searchResourceCatalog({ ...filters, limit: filters.limit ?? 50 });
  const items = result.data?.items ?? [];
  let detailHrefById: Record<string, string>;
  try {
    detailHrefById = Object.fromEntries(items.map((resource) => {
      const context = createDiscoveryContext(resource.slug, filters);
      return [resource.id, context ? `/resources/${resource.slug}?discoveryContext=${encodeURIComponent(context)}` : `/resources/${resource.slug}`];
    }));
  } catch (error) {
    if (error instanceof DiscoveryContextConfigurationError) {
      return <div className="min-h-screen bg-[#fff8e9] p-10 text-[#a23b2c]">筛选来源上下文未配置，暂时无法打开本次筛选内的发现路径。</div>;
    }
    throw error;
  }
  const activeTag = popularTags.find((item) => item.slug === tag);
  const clearParams = serializeSearchFilters(clearSearchFilters(filters));
  const clearHref = clearParams ? `/search?${clearParams}` : "/search";
  return <div className="min-h-screen bg-[#fff8e9] text-[#172d29]"><CatalogHeader /><main className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><p className="text-sm text-[#a23b2c]">资源目录</p><h1 className="mt-2 font-serif text-4xl">寻找一条阅读线索</h1><form action="/search" className="mt-7 flex max-w-2xl border border-[#254a42] bg-[#fffdf5]"><label className="sr-only" htmlFor="catalog-search">搜索资源</label><Search className="m-3.5 size-5 text-[#254a42]" /><input id="catalog-search" name="q" defaultValue={q} className="min-w-0 flex-1 bg-transparent py-3 outline-none" placeholder="标题、作者或摘要" /><button type="submit" className="border-l border-[#254a42] px-4 text-sm hover:bg-[#254a42] hover:text-[#fff8e9]">搜索</button></form><div className="mt-5 flex flex-wrap gap-2">{popularTags.map((item) => <Link key={item.id} href={`/search?${serializeSearchFilters({ q: q || undefined, tag: item.slug, sort: filters.sort, limit: filters.limit })}`} aria-current={item.slug === tag ? "page" : undefined} className={`border px-3 py-1.5 text-sm ${item.slug === tag ? "border-[#254a42] bg-[#254a42] text-[#fff8e9]" : "border-[#254a42]/35 text-[#254a42] hover:bg-[#e4e7d4]"}`}>{item.name}</Link>)}</div><div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_12rem]"><section><div className="flex items-center justify-between border-b border-[#254a42]/20 pb-3"><p className="text-sm text-[#52625d]">{q || activeTag ? `找到 ${result.data?.total ?? 0} 条资源` : "浏览全部资源"}</p>{activeTag ? <Link href={clearHref} className="inline-flex items-center gap-1 text-sm text-[#254a42] hover:underline"><X className="size-4" />清除 {activeTag.name}</Link> : null}</div>{result.error ? <div className="border border-dashed border-[#a23b2c] px-6 py-14 text-center"><p className="font-serif text-2xl text-[#172d29]">资源目录暂时无法读取</p><p className="mt-2 text-sm text-[#a23b2c]">{result.error}</p></div> : <ResourceList resources={items} detailHrefById={detailHrefById} />}</section><aside className="border-l border-[#254a42]/20 pl-5"><p className="text-sm text-[#a23b2c]">本次目录</p><p className="mt-2 font-serif text-xl">先在公共目录中探索，再将真正想保留的线索放入个人书架。</p></aside></div></main></div>;
}
