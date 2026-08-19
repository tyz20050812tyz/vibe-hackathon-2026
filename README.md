# Vibe Hackathon 2026

Vibe Coding 竞赛双人全栈项目底座。项目已具备 Next.js、Supabase、Vercel 和 GitHub Pull Request 的演练链路，赛题发布后可在此基础上快速实现 MVP。

## 技术栈

- Next.js 16 App Router + React 19
- TypeScript
- Tailwind CSS + shadcn/ui + Lucide React
- Next.js Route Handlers
- Supabase PostgreSQL
- Vercel

## 本地启动

前置条件：Node.js 24（或 Node.js 20+）、npm 和 Git。

```bash
git clone https://github.com/tyz20050812tyz/vibe-hackathon-2026.git
cd vibe-hackathon-2026
npm install
cp .env.example .env.local
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 环境变量

在 `.env.local` 中填写实际值：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
LLM_API_KEY=
```

`.env.local` 不得提交。只有浏览器安全的配置可以使用 `NEXT_PUBLIC_` 前缀；`SUPABASE_SERVICE_ROLE_KEY` 和 LLM key 只允许在服务端代码中读取。

## 验证命令

每次创建 PR 前运行：

```bash
npm run lint
npm run build
```

## 已有演练页面

| 路径 | 用途 |
| --- | --- |
| `/test-pr-workflow` | 演练功能分支、PR、Preview 和合并 `main` 的流程 |
| `/api/health` | 验证部署环境能连接 Supabase |
| `/demo-records` | 真实演练“页面 -> API -> Supabase -> 页面”的读写闭环 |

`/demo-records` 依赖 Supabase 的 `demo_records` 表。首次使用前，请执行 [迁移 SQL](./supabase/migrations/20260820_create_demo_records.sql)。

## 部署

在 Vercel 导入 GitHub 仓库，并在 `Preview`、`Production` 环境配置与 `.env.local` 相同的变量。功能分支创建 PR 后，Vercel 会生成 Preview；确认 `/api/health` 与核心页面正常后再合并 `main`。

## 团队文档

完整赛前资料见 [docs/README.md](./docs/README.md)：

- 技术栈与本地启动
- 后端与部署
- 分工与 API 契约
- Git 协作指南
- 赛题提示词模板
- 赛前待办事项
- Supabase CRUD 演练模板
