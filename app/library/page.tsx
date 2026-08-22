import { CatalogHeader } from "@/components/resources/catalog-header";
import { LibraryContent } from "@/components/library/library-content";

export default function LibraryPage() {
  return <div className="min-h-screen bg-[#fff8e9] text-[#172d29]"><CatalogHeader /><main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 lg:py-14"><p className="text-sm text-[#a23b2c]">个人中心 / 阅读档案</p><h1 className="mt-2 max-w-2xl font-serif text-4xl sm:text-5xl">把偶然遇见的书，留成自己的路径。</h1><p className="mt-4 max-w-2xl leading-7 text-[#45554f]">收藏、笔记和下一条偏离的方向，都在这里慢慢长成一份阅读档案。</p><div className="mt-10"><LibraryContent /></div></main></div>;
}
