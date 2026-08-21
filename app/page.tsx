import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";

import { CatalogHeader } from "@/components/resources/catalog-header";
import { ResourceCover } from "@/components/resources/resource-cover";
import { resources, popularTags } from "@/lib/mocks/resources";

export default function Home() {
  const featured = resources.filter((resource) => resource.isFeatured).slice(0, 4);
  return <div className="min-h-screen bg-[#fff8e9] text-[#172d29]"><CatalogHeader /><main>
    <section className="border-b border-[#254a42]/20"><div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1.1fr_.9fr] lg:py-20">
      <div className="max-w-2xl"><p className="text-sm text-[#a23b2c]">数字图书馆 / 精选阅读路径</p><h1 className="mt-5 font-serif text-5xl leading-[1.12] sm:text-6xl">从一本书，走向意料之外的下一本。</h1><p className="mt-6 max-w-xl text-base leading-7 text-[#45554f]">在人工智能、城市、文学和设计之间，保存值得回看的线索。先从一个主题开始，再让阅读自然地偏离一点。</p>
        <form action="/search" className="mt-8 flex max-w-lg border border-[#254a42] bg-[#fffdf5]"><label className="sr-only" htmlFor="home-search">搜索资源</label><Search className="m-3.5 size-5 text-[#254a42]" /><input id="home-search" name="q" className="min-w-0 flex-1 bg-transparent py-3 outline-none placeholder:text-[#78837c]" placeholder="搜索 AI、创造力或城市记忆" /><button className="border-l border-[#254a42] px-4 text-sm hover:bg-[#254a42] hover:text-[#fff8e9]" type="submit">搜索</button></form>
      </div>
      <div className="grid grid-cols-[1fr_.78fr] items-end gap-4"><ResourceCover resource={featured[0]} className="rotate-[-2deg]" /><div className="space-y-4"><p className="border-l-2 border-[#c84432] pl-3 text-sm leading-6 text-[#45554f]">本周书架<br />AI 与创造力</p><ResourceCover resource={featured[1]} className="rotate-[2deg]" /></div></div>
    </div></section>
    <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8"><div className="flex items-end justify-between gap-6"><div><p className="text-sm text-[#a23b2c]">主题索引</p><h2 className="mt-2 font-serif text-3xl">先选一条线索</h2></div><Link href="/search" className="hidden items-center gap-1 text-sm text-[#254a42] hover:underline sm:inline-flex">查看全部 <ArrowRight className="size-4" /></Link></div><div className="mt-6 flex flex-wrap gap-2">{popularTags.map((tag) => <Link key={tag.id} href={`/search?tag=${tag.slug}`} className="border border-[#254a42]/35 px-4 py-2 text-sm text-[#254a42] hover:bg-[#e4e7d4]">{tag.name}</Link>)}</div></section>
    <section className="border-t border-[#254a42]/20 bg-[#f0efd9]"><div className="mx-auto max-w-6xl px-5 py-12 sm:px-8"><div className="flex items-end justify-between"><div><p className="text-sm text-[#a23b2c]">精选馆藏</p><h2 className="mt-2 font-serif text-3xl">从这里开始阅读</h2></div><Link href="/search" className="text-sm text-[#254a42] hover:underline">资源目录</Link></div><div className="mt-8 grid gap-x-8 lg:grid-cols-2">{featured.map((resource) => <article key={resource.id} className="grid grid-cols-[5.5rem_1fr] gap-4 border-t border-[#254a42]/20 py-5"><ResourceCover resource={resource} /><div><p className="text-xs text-[#a23b2c]">{resource.tags[0]?.name}</p><h3 className="mt-1 font-serif text-xl"><Link href={`/resources/${resource.slug}`} className="hover:underline">{resource.title}</Link></h3><p className="mt-1 text-sm text-[#52625d]">{resource.creators.join("、")}</p><p className="mt-3 line-clamp-2 text-sm leading-6 text-[#45554f]">{resource.summary}</p></div></article>)}</div></div></section>
  </main></div>;
}
