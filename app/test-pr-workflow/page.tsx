"use client";

import { useState } from "react";
import {
  Check,
  ChevronRight,
  CircleDotDashed,
  Cloud,
  GitBranch,
  GitPullRequest,
  Play,
  Rocket,
  ShieldCheck,
  Terminal,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const stages = [
  {
    id: "branch",
    label: "功能分支",
    detail: "feat/pr-workflow-demo",
    icon: GitBranch,
  },
  {
    id: "checks",
    label: "本地检查",
    detail: "lint + production build",
    icon: ShieldCheck,
  },
  {
    id: "pr",
    label: "创建 Pull Request",
    detail: "请求队友审查",
    icon: GitPullRequest,
  },
  {
    id: "preview",
    label: "Vercel Preview",
    detail: "测试临时部署链接",
    icon: Cloud,
  },
  {
    id: "merge",
    label: "合并 main",
    detail: "部署稳定版本",
    icon: Rocket,
  },
];

const commands = [
  "git switch main && git pull origin main",
  "git switch -c feat/pr-workflow-demo",
  "npm run lint && npm run build",
  "git add app && git commit -m \"feat: add PR workflow demo\"",
  "git push -u origin feat/pr-workflow-demo",
];

export default function PullRequestWorkflowPage() {
  const [activeStage, setActiveStage] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  const runDemo = async () => {
    setIsRunning(true);
    for (let index = 0; index < stages.length; index += 1) {
      setActiveStage(index);
      await new Promise((resolve) => window.setTimeout(resolve, 600));
    }
    setIsRunning(false);
  };

  const finished = activeStage === stages.length - 1 && !isRunning;
  const active = stages[activeStage];

  return (
    <main className="min-h-screen bg-[#f3f5f1] text-[#16251e]">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
        <header className="border-b border-[#16251e]/15 pb-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-lg bg-[#d7ef45] text-[#16251e]">
                <GitPullRequest className="size-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold">VIBE HACKATHON 2026</p>
                <p className="text-xs text-[#526359]">协作演练 / Pull Request 流程</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#16251e]/15 bg-white px-3 py-1.5 text-xs font-medium">
              <CircleDotDashed className="size-3.5 text-[#6a7d1e]" aria-hidden="true" />
              演练页面，不连接真实仓库
            </span>
          </div>
          <div className="mt-9 grid gap-5 lg:grid-cols-[1fr_0.86fr] lg:items-end">
            <div>
              <p className="text-sm font-medium text-[#637268]">将一项功能安全带到生产环境</p>
              <h1 className="mt-2 max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
                从个人分支，到团队可用的部署版本。
              </h1>
            </div>
            <p className="max-w-lg border-l-2 border-[#d7ef45] pl-4 text-sm leading-6 text-[#526359]">
              这是一条完整的协作主线。完成本地检查后，才将代码交给 Pull Request 和 Vercel Preview 检验。
            </p>
          </div>
        </header>

        <section className="mt-8 grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
          <div className="border border-[#16251e]/15 bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">演练进度</h2>
              <span className="font-mono text-xs text-[#637268]">{activeStage + 1} / {stages.length}</span>
            </div>
            <ol className="mt-6 space-y-1">
              {stages.map((stage, index) => {
                const Icon = stage.icon;
                const isComplete = index < activeStage || finished;
                const isCurrent = index === activeStage && !finished;

                return (
                  <li key={stage.id}>
                    <button
                      type="button"
                      onClick={() => !isRunning && setActiveStage(index)}
                      disabled={isRunning}
                      className={`flex w-full items-center gap-3 rounded-md p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6a7d1e] disabled:cursor-wait ${
                        isCurrent ? "bg-[#ecf5bd]" : "hover:bg-[#f3f5f1]"
                      }`}
                    >
                      <span className={`grid size-7 shrink-0 place-items-center rounded-full border ${isComplete ? "border-[#6a7d1e] bg-[#6a7d1e] text-white" : isCurrent ? "border-[#6a7d1e] text-[#6a7d1e]" : "border-[#c9d1cb] text-[#7c8b82]"}`}>
                        {isComplete ? <Check className="size-4" aria-hidden="true" /> : <Icon className="size-4" aria-hidden="true" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{stage.label}</span>
                        <span className="block truncate text-xs text-[#637268]">{stage.detail}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <Button className="mt-6 w-full bg-[#16251e] text-white hover:bg-[#2d4237]" size="lg" onClick={runDemo} disabled={isRunning}>
              <Play className="size-4" aria-hidden="true" />
              {isRunning ? "正在演练..." : finished ? "重新演练流程" : "开始演练"}
            </Button>
          </div>

          <div className="border border-[#16251e]/15 bg-[#16251e] p-5 text-white sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/15 pb-5">
              <div>
                <p className="font-mono text-xs text-[#d7ef45]">CURRENT CHECKPOINT</p>
                <h2 className="mt-2 text-2xl font-semibold">{active.label}</h2>
                <p className="mt-1 text-sm text-white/60">{active.detail}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${finished ? "bg-[#d7ef45] text-[#16251e]" : "bg-white/10 text-white/80"}`}>
                {finished ? "流程完成" : isRunning ? "进行中" : "等待操作"}
              </span>
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-white/45">这一步要确认</p>
                <p className="mt-2 text-sm leading-6 text-white/85">
                  {activeStage === 0 && "从最新 main 创建独立分支。不要直接在 main 上开发。"}
                  {activeStage === 1 && "本地 lint 和 production build 都通过，才可以推送。"}
                  {activeStage === 2 && "说明改动内容、测试方式，以及是否改了接口或环境变量。"}
                  {activeStage === 3 && "打开 Vercel Preview，用真实浏览器走完核心用户路径。"}
                  {activeStage === 4 && "审查通过后合并 main；Vercel 自动发布生产版本。"}
                </p>
              </div>
              <div className="border-l border-white/15 pl-5">
                <p className="text-xs font-semibold text-white/45">谁来负责</p>
                <p className="mt-2 text-sm leading-6 text-white/85">
                  {activeStage < 2 ? "功能开发者" : activeStage === 2 ? "开发者发起，队友审查" : activeStage === 3 ? "两人共同验收" : "PR 审查者合并"}
                </p>
              </div>
            </div>

            <div className="mt-8 rounded-md border border-white/15 bg-black/20 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-white/55">
                <Terminal className="size-3.5" aria-hidden="true" />
                本次真实执行命令
              </div>
              <code className="mt-3 block overflow-x-auto whitespace-nowrap font-mono text-xs leading-6 text-[#e9f0d2]">
                {commands[Math.min(activeStage, commands.length - 1)]}
              </code>
            </div>

            <div className="mt-6 flex items-center gap-2 text-xs text-white/55">
              <ChevronRight className="size-4 text-[#d7ef45]" aria-hidden="true" />
              {finished ? "下一步：推送功能分支并在 GitHub 创建真实 PR。" : "点击左侧阶段可查看对应职责与检查点。"}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-px overflow-hidden border border-[#16251e]/15 bg-[#16251e]/15 sm:grid-cols-3">
          {[
            ["开发者", "负责小范围改动、本地验证和 PR 描述"],
            ["审查者", "负责 Preview 验收与共享契约检查"],
            ["main", "只接收已验证、可部署的代码"],
          ].map(([title, copy]) => (
            <div key={title} className="bg-[#f3f5f1] p-5">
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-1 text-sm leading-6 text-[#526359]">{copy}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
