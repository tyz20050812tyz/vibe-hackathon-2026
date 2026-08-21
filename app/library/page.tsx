import { CatalogHeader } from "@/components/resources/catalog-header";
import { LibraryContent } from "@/components/library/library-content";

export default function LibraryPage() {
  return <div className="min-h-screen bg-[#fff8e9] text-[#172d29]"><CatalogHeader /><main className="mx-auto max-w-5xl px-5 py-10 sm:px-8"><p className="text-sm text-[#a23b2c]">个人书架</p><h1 className="mt-2 font-serif text-4xl">留下想继续阅读的线索</h1><p className="mt-4 max-w-xl leading-7 text-[#45554f]">你的收藏只对自己可见，也会在刷新和下次登录后继续保留。</p><div className="mt-10 max-w-3xl"><LibraryContent /></div></main></div>;
}
