"use client";

import { KeyRound, Mail } from "lucide-react";
import { useId, useState } from "react";

import type { AuthResult } from "@/lib/types/auth";

type Mode = "sign-in" | "sign-up";

const passwordHint = "至少 8 位，包含字母、数字和特殊字符。";

function fieldError(email: string, password: string) {
  if (!/^\S+@\S+\.\S+$/.test(email)) return "请输入有效的邮箱地址。";
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) return passwordHint;
  return null;
}

export function AuthForm({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const emailId = useId();
  const passwordId = useId();

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const error = fieldError(email.trim(), password);
    if (error) { setMessage(error); return; }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json() as { data?: AuthResult; error?: { message?: string } };
      if (!response.ok || !body.data) {
        setMessage(body.error?.message ?? "认证服务暂时不可用，请稍后重试。");
        return;
      }
      if (body.data.status === "confirmation_required") {
        setMessage("注册成功。请在 QQ 邮箱中完成验证，再返回这里登录。");
        setMode("sign-in");
        return;
      }
      onAuthenticated();
    } catch {
      setMessage("网络暂时不可用，请稍后重试。");
    } finally {
      setBusy(false);
    }
  };

  return <section className="max-w-md border border-[#254a42]/30 bg-[#f0efd9] p-6 shadow-[5px_5px_0_#254a42] sm:p-7">
    <div className="flex items-start justify-between gap-6">
      <div><p className="text-sm text-[#a23b2c]">个人书架</p><h2 className="mt-2 font-serif text-3xl">把阅读线索留在这里</h2></div>
      <KeyRound aria-hidden="true" className="mt-1 size-6 shrink-0 text-[#a23b2c]" />
    </div>
    <p className="mt-4 text-sm leading-6 text-[#45554f]">登录后，收藏会安全地保留在你的书架中。</p>
    <div className="mt-6 grid grid-cols-2 border border-[#254a42]/30 p-1" role="tablist" aria-label="认证方式">
      <button type="button" role="tab" aria-selected={mode === "sign-in"} onClick={() => { setMode("sign-in"); setMessage(""); }} className={`h-9 text-sm ${mode === "sign-in" ? "bg-[#254a42] text-[#fff8e9]" : "text-[#254a42] hover:bg-[#e4e7d4]"}`}>登录</button>
      <button type="button" role="tab" aria-selected={mode === "sign-up"} onClick={() => { setMode("sign-up"); setMessage(""); }} className={`h-9 text-sm ${mode === "sign-up" ? "bg-[#254a42] text-[#fff8e9]" : "text-[#254a42] hover:bg-[#e4e7d4]"}`}>注册</button>
    </div>
    <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
      <label className="block text-sm font-medium" htmlFor={emailId}>QQ 邮箱或常用邮箱</label>
      <div className="relative -mt-2"><Mail aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#52625d]" /><input id={emailId} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} className="h-11 w-full border border-[#254a42]/30 bg-[#fffdf5] pl-10 pr-3 outline-none focus:border-[#254a42] focus:ring-2 focus:ring-[#a23b2c]/30 disabled:opacity-60" placeholder="name@qq.com" /></div>
      <label className="block text-sm font-medium" htmlFor={passwordId}>密码</label>
      <div className="-mt-2"><input id={passwordId} type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} className="h-11 w-full border border-[#254a42]/30 bg-[#fffdf5] px-3 outline-none focus:border-[#254a42] focus:ring-2 focus:ring-[#a23b2c]/30 disabled:opacity-60" placeholder="输入密码" />{mode === "sign-up" ? <p className="mt-2 text-xs leading-5 text-[#52625d]">{passwordHint}</p> : null}</div>
      <button type="submit" disabled={busy} className="h-11 w-full border border-[#254a42] bg-[#254a42] text-sm text-[#fff8e9] transition-colors hover:bg-[#172d29] disabled:opacity-60">{busy ? "正在处理..." : mode === "sign-in" ? "登录并查看书架" : "注册账号"}</button>
    </form>
    {message ? <p className="mt-4 text-sm leading-6 text-[#a23b2c]" role="status">{message}</p> : null}
  </section>;
}
