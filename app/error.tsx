"use client";

import Link from "next/link";

export default function Error({ retry }: { retry: () => void }) {
  return (
    <main className="min-h-screen bg-[#fff8e9] px-5 py-16 text-[#172d29] sm:px-8">
      <section className="mx-auto max-w-xl border-y border-[#254a42]/25 py-10">
        <p className="text-sm text-[#a23b2c]">暂时中断</p>
        <h1 className="mt-3 font-serif text-3xl">这一页还没有准备好</h1>
        <p className="mt-4 leading-7 text-[#45554f]">
          页面暂时无法打开。你可以重新尝试，或回到首页继续浏览。
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={retry}
            className="border border-[#254a42] px-4 py-2 text-sm text-[#254a42] hover:bg-[#254a42] hover:text-[#fff8e9]"
          >
            再试一次
          </button>
          <Link
            href="/"
            className="border border-[#254a42]/35 px-4 py-2 text-sm text-[#254a42] hover:bg-[#e4e7d4]"
          >
            返回首页
          </Link>
        </div>
      </section>
    </main>
  );
}
