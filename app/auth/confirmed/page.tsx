import Link from "next/link";

export default function AuthConfirmedPage() {
  return <main className="grid min-h-screen place-items-center bg-[#fff8e9] px-5 text-[#172d29]">
    <section className="max-w-md border border-[#254a42]/30 bg-[#f0efd9] p-7 shadow-[5px_5px_0_#254a42]">
      <p className="text-sm text-[#a23b2c]">邮箱已确认</p>
      <h1 className="mt-2 font-serif text-4xl">现在可以登录了</h1>
      <p className="mt-4 leading-7 text-[#45554f]">回到个人书架，使用刚刚注册的邮箱和密码登录。</p>
      <Link href="/library" className="mt-7 inline-flex h-11 items-center border border-[#254a42] bg-[#254a42] px-4 text-sm text-[#fff8e9] hover:bg-[#172d29]">前往个人书架</Link>
    </section>
  </main>;
}
