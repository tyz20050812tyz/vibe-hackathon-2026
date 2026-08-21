import Link from "next/link";
export default function NotFound() { return <div className="min-h-screen bg-[#fff8e9] p-8 text-[#172d29]"><p className="font-serif text-3xl">这条书架线索不存在。</p><Link href="/search" className="mt-4 inline-block text-[#254a42] underline">回到资源目录</Link></div>; }
