import Link from "next/link";
import { Bookmark, Search } from "lucide-react";

export function CatalogHeader() {
  return <header className="border-b border-[#254a42]/20 bg-[#fff8e9]"><div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8"><Link href="/" className="font-serif text-xl text-[#172d29]">书外之遇</Link><nav className="flex items-center gap-1" aria-label="主导航"><Link href="/search" className="inline-flex h-9 items-center gap-1.5 px-3 text-sm text-[#254a42] hover:bg-[#e4e7d4]"><Search className="size-4" />找资源</Link><Link href="/library" className="inline-flex h-9 items-center gap-1.5 px-3 text-sm text-[#254a42] hover:bg-[#e4e7d4]"><Bookmark className="size-4" />个人中心</Link></nav></div></header>;
}
