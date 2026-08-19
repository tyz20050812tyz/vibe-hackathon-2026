"use client";

import { FormEvent, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  Database,
  LoaderCircle,
  RefreshCw,
  Send,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  ApiFailure,
  ApiSuccess,
  CreateDemoRecordResponse,
  DemoRecord,
  ListDemoRecordsResponse,
} from "@/lib/types/api";

function isFailure(response: ApiFailure | ApiSuccess<unknown>): response is ApiFailure {
  return response.data === null;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

type DemoRecordsTemplateProps = {
  initialRecords: DemoRecord[];
  initialError: string | null;
};

export function DemoRecordsTemplate({
  initialRecords,
  initialError,
}: DemoRecordsTemplateProps) {
  const [content, setContent] = useState("");
  const [records, setRecords] = useState<DemoRecord[]>(initialRecords);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(initialError);
  const [isError, setIsError] = useState(Boolean(initialError));

  const loadRecords = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/demo-records", { cache: "no-store" });
      const body = (await response.json()) as ListDemoRecordsResponse;

      if (!response.ok || isFailure(body)) {
        throw new Error(isFailure(body) ? body.error.message : "读取演练记录失败。");
      }

      setRecords(body.data);
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "读取演练记录失败。");
    } finally {
      setIsLoading(false);
    }
  };

  const submitRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    if (!content.trim()) {
      setIsError(true);
      setMessage("请输入一段演练内容。");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/demo-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const body = (await response.json()) as CreateDemoRecordResponse;

      if (!response.ok || isFailure(body)) {
        throw new Error(isFailure(body) ? body.error.message : "保存演练记录失败。");
      }

      setRecords((current) => [body.data, ...current]);
      setContent("");
      setIsError(false);
      setMessage(`已写入 Supabase，记录 ID：${body.data.id.slice(0, 8)}`);
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "保存演练记录失败。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f1f4ef] text-[#183028]">
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-12">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#183028]/15 pb-7">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-[#cfe756] text-[#183028]">
              <Database className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold">VIBE HACKATHON 2026</p>
              <p className="text-xs text-[#61746a]">Supabase 真实读写模板</p>
            </div>
          </div>
          <span className="rounded-full border border-[#183028]/15 bg-white px-3 py-1.5 text-xs font-medium text-[#52665b]">
            GET + POST /api/demo-records
          </span>
        </header>

        <section className="grid gap-8 py-10 lg:grid-cols-[0.88fr_1.12fr] lg:items-start">
          <div>
            <p className="text-sm font-medium text-[#6b801f]">TEMPLATE FLOW</p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">
              输入一段内容，验证完整数据闭环。
            </h1>
            <p className="mt-5 max-w-md text-sm leading-7 text-[#52665b]">
              这不是 Mock。提交内容会经过 Next.js API 校验后写入 Supabase，再由接口读回显示。
            </p>
            <div className="mt-8 border-l-2 border-[#cfe756] pl-4 text-sm leading-7 text-[#52665b]">
              明天替换表名、字段、接口路径和业务组件，即可将这条链路迁移到赛题中。
            </div>
          </div>

          <form onSubmit={submitRecord} className="border border-[#183028]/15 bg-white p-5 shadow-[5px_5px_0_0_rgba(24,48,40,0.08)] sm:p-6">
            <label htmlFor="demo-content" className="text-sm font-semibold">
              演练内容
            </label>
            <textarea
              id="demo-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={500}
              placeholder="例如：明天的赛题将从这个模板开始。"
              className="mt-3 min-h-32 w-full resize-y border border-[#183028]/20 bg-[#fbfcfa] px-3 py-3 text-sm leading-6 outline-none placeholder:text-[#809087] focus:border-[#6b801f] focus:ring-3 focus:ring-[#cfe756]/50"
            />
            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[#6d7c73]">
              <span>由 Zod 校验，最多 500 个字符</span>
              <span>{content.length}/500</span>
            </div>
            <Button className="mt-6 w-full bg-[#183028] text-white hover:bg-[#2e4c3e]" size="lg" disabled={isSubmitting}>
              {isSubmitting ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
              {isSubmitting ? "正在写入..." : "写入 Supabase"}
            </Button>
          </form>
        </section>

        {message ? (
          <div className={`mb-6 flex items-start gap-3 border px-4 py-3 text-sm ${isError ? "border-[#c45444]/30 bg-[#fff0ec] text-[#8e3226]" : "border-[#7e9b2e]/30 bg-[#f0f7ce] text-[#40520e]"}`} role="status">
            {isError ? <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
            {message}
          </div>
        ) : null}

        <section className="border border-[#183028]/15 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#183028]/15 px-5 py-4 sm:px-6">
            <div>
              <h2 className="font-semibold">最近记录</h2>
              <p className="mt-0.5 text-xs text-[#61746a]">最新 20 条，来自 Supabase</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void loadRecords()} disabled={isLoading}>
              <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} aria-hidden="true" />
              刷新
            </Button>
          </div>

          <div className="divide-y divide-[#183028]/10">
            {isLoading ? (
              <p className="px-5 py-8 text-sm text-[#61746a]">正在读取 Supabase 记录...</p>
            ) : records.length === 0 ? (
              <p className="px-5 py-8 text-sm text-[#61746a]">还没有记录，提交第一条演练内容吧。</p>
            ) : (
              records.map((record) => (
                <article key={record.id} className="px-5 py-4 sm:px-6">
                  <p className="text-sm leading-6">{record.content}</p>
                  <p className="mt-2 font-mono text-xs text-[#728078]">{formatDate(record.createdAt)} · {record.id.slice(0, 8)}</p>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
