"use client";

import { CheckCircle2, CircleAlert, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type State = "processing" | "complete" | "error";

export function ConfirmationHandler() {
  const router = useRouter();
  const [state, setState] = useState<State>("processing");
  const [message, setMessage] = useState("正在完成邮箱验证并建立安全登录会话...");

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    // Supabase sends credentials in the hash. Remove them before any further navigation.
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);

    if (!accessToken || !refreshToken) {
      const task = window.setTimeout(() => {
        setState("complete");
        setMessage("邮箱已确认。现在可以前往个人书架登录。");
      }, 0);
      return () => window.clearTimeout(task);
    }

    void (async () => {
      try {
        const response = await fetch("/api/auth/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken, refreshToken }),
        });
        const body = await response.json() as { error?: { message?: string } };
        if (!response.ok) throw new Error(body.error?.message ?? "无法完成登录。");
        setState("complete");
        setMessage("邮箱已确认，正在打开你的个人书架...");
        router.replace("/library");
      } catch (error) {
        setState("error");
        setMessage(error instanceof Error ? error.message : "无法完成登录，请返回个人书架重新登录。");
      }
    })();
  }, [router]);

  const icon = state === "processing" ? <LoaderCircle className="size-7 animate-spin text-[#a23b2c]" aria-hidden="true" /> : state === "complete" ? <CheckCircle2 className="size-7 text-[#254a42]" aria-hidden="true" /> : <CircleAlert className="size-7 text-[#a23b2c]" aria-hidden="true" />;
  return <main className="grid min-h-screen place-items-center bg-[#fff8e9] px-5 text-[#172d29]"><section className="max-w-md border border-[#254a42]/30 bg-[#f0efd9] p-7 shadow-[5px_5px_0_#254a42]"><div className="flex items-center gap-3">{icon}<p className="text-sm text-[#a23b2c]">邮箱验证</p></div><h1 className="mt-4 font-serif text-4xl">{state === "error" ? "确认未完成" : "确认你的邮箱"}</h1><p className="mt-4 leading-7 text-[#45554f]" role="status">{message}</p>{state !== "processing" ? <Link href="/library" className="mt-7 inline-flex h-11 items-center border border-[#254a42] bg-[#254a42] px-4 text-sm text-[#fff8e9] hover:bg-[#172d29]">前往个人书架</Link> : null}</section></main>;
}
