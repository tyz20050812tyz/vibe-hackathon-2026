# 书外之遇

> 从一本书，走向意料之外的下一本。

书外之遇是一个以人工策展资源关系为基础的数字图书馆。读者可以浏览和筛选公共目录，沿资源关系继续探索，建立个人书架与阅读偏好，并在需要时获得 AI 生成的阅读引导。

项目基于 Next.js 与 Supabase 构建，适合作为 Vibe Coding Hackathon 2026 的全栈作品与协作底座。

## 功能

- 资源目录：按关键词、主题、语言、年份、类型与可读状态筛选图书、论文、讲座和专题。
- 资源详情与关系图：查看人工策展的关联理由，并在 Book Map 中探索相邻资源。
- 意外发现：在延展主题、对照观点、历史背景和意外桥接四种模式中继续阅读；可保留当前筛选范围，或自由偏离。
- 个人书架：邮箱注册和登录后收藏资源、记录笔记、维护个人资料。
- 阅读偏好：选择主题、探索程度和喜欢的书目，获得个性化排序与发现结果。
- AI 阅读引导：可选接入 DeepSeek；服务端包含超时、结构校验、缓存、预算、并发控制与熔断降级。

## 技术栈

- Next.js 16 App Router、React 19、TypeScript
- Tailwind CSS、shadcn/ui、Lucide React
- Supabase PostgreSQL、Auth 与 Row Level Security
- Zod、Vitest、Playwright
- Vercel

## 快速开始

前置条件：Node.js 20+（推荐 Node.js 24）、npm、Git，以及一个 Supabase 项目。

```bash
git clone https://github.com/tyz20050812tyz/vibe-hackathon-2026.git
cd vibe-hackathon-2026
npm install
cp .env.example .env.local
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。首次启动前，须完成下方的数据库初始化和环境变量配置。

## 环境变量

将 `.env.example` 复制为 `.env.local` 后填写实际值。`.env.local` 不得提交；仅 `NEXT_PUBLIC_` 前缀变量可出现在浏览器中。

| 变量 | 必需 | 用途 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | 是 | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 是 | 浏览器和受 RLS 保护的服务端查询使用的 publishable key |
| `NEXT_PUBLIC_SITE_URL` | 是 | 注册邮件确认页的规范站点 URL，例如 `http://localhost:3000` |
| `SUPABASE_SERVICE_ROLE_KEY` | 是 | 服务端管理操作、健康检查和限流 RPC；绝不能使用 `NEXT_PUBLIC_` 前缀 |
| `DISCOVERY_CONTEXT_ENCRYPTION_KEY` | 推荐 | 筛选上下文令牌的 AES-256-GCM 密钥；须为 32 字节随机值的 Base64 编码 |
| `DISCOVERY_LIMIT_HASH_SALT` | 推荐 | 请求与模型限流的身份哈希盐 |
| `TRUST_PROXY` | 生产必填 | 部署平台可信代理已正确传递客户端 IP 时设为 `true` |
| `DEEPSEEK_ENABLED` | 否 | 设为 `true` 后启用 AI 阅读引导 |
| `DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL` | 启用 AI 时必需 | DeepSeek 服务端配置 |
| `SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASS`、`SMTP_FROM` | 启用注册时必需 | 邮箱确认邮件的 SMTP 配置 |

生成发现上下文密钥：

```bash
openssl rand -base64 32
```

AI 功能默认关闭，未配置时会安全回退到人工策展说明。注册邮件的 QQ SMTP 配置与 Supabase Redirect URL 设置见 [认证与邮件配置](./docs/10-认证与邮件配置.md)。

## 数据库初始化

在新的 Supabase 项目中，按文件名顺序执行 `supabase/migrations/` 下的 migration。它们会创建资源目录、收藏、阅读偏好、搜索 RPC、AI 控制和请求限流所需的表、函数、索引与 RLS 策略。

随后执行种子数据：

```text
supabase/seed/resources-v1.sql
supabase/seed/resources-v2-relations.sql
```

种子文件提供公开资源、标签和人工策展关系。具体数据约定见 [种子数据说明](./supabase/seed/README.md)。开发演练用的 `demo_records` 表由 `20260820_create_demo_records.sql` 创建。

## 常用命令

```bash
npm run dev          # 本地开发服务器
npm run lint         # ESLint
npm test             # Vitest 单元、组件、API 和迁移契约测试
npm run build        # 生产构建与 TypeScript 检查
npm run test:e2e     # Playwright 浏览器测试
npm run start        # 启动已构建的生产服务
```

提交或发布前至少运行：

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

数据库集成测试默认不会访问远程环境。仅在独立的测试项目中设置 `RUN_SUPABASE_INTEGRATION=1` 或 `RUN_SUPABASE_MIGRATION_TESTS=1` 及相应数据库变量后执行，避免将测试用户或 migration 试验写入生产库。

## 主要路由

| 路径 | 说明 |
| --- | --- |
| `/` | 首页与精选资源 |
| `/search` | 资源目录与筛选 |
| `/resources/[slug]` | 资源详情、收藏与意外发现 |
| `/resources/[slug]/constellation` | 单个资源的关系图 |
| `/book-map` | Book Map 关系探索 |
| `/library` | 登录、个人资料和个人书架 |
| `/onboarding` | 阅读偏好设置 |
| `/api/health` | 服务端 Supabase 连通性检查 |

`/demo-records` 和 `/test-pr-workflow` 是开发协作演练页面，不应作为正式产品路径或发布验收依据。

## 部署

1. 在 Vercel 导入 GitHub 仓库，框架选择 Next.js，生产分支设为 `main`。
2. 在 Preview 与 Production 中配置所需环境变量；服务端密钥、SMTP 和 DeepSeek 密钥不能暴露给浏览器。
3. 在 Supabase Auth 中将生产域名加入 `Site URL` 和 Redirect URLs，确保包含 `/auth/confirmed`。
4. 在独立测试库完成 migration 与 RLS 验证后，再对目标环境执行 migration 和 seed。
5. 通过 Preview 依次验收目录搜索、邮箱注册确认、登录收藏、阅读偏好、发现和 `/api/health`。

生产部署必须为认证与发现入口增加边缘/WAF 限流，并为 `DISCOVERY_LIMIT_HASH_SALT`、`TRUST_PROXY`、日志和告警建立上线检查。详细风险与改进项见 [代码审查报告](./docs/ai-discovery/代码审查.md)。

## 项目结构

```text
app/                 页面、Route Handlers 与错误边界
components/          按领域划分的 React UI 组件
lib/services/        业务逻辑、认证、目录、发现与 AI 适配
lib/schemas/         Zod 输入校验
lib/supabase/        浏览器、Cookie 与服务端 Supabase 客户端
supabase/migrations/ 数据库结构、RLS、函数和索引
supabase/seed/       演示资源、标签与关系数据
tests/               Vitest 与 Playwright 测试
docs/                协作、部署、接口与验收文档
```

## 协作资料

- [团队文档索引](./docs/README.md)
- [技术栈与本地启动](./docs/01-技术栈与本地启动.md)
- [后端与部署](./docs/02-后端与部署.md)
- [接口与分工约定](./docs/03-分工与接口契约.md)
- [Git 协作指南](./docs/04-Git协作指南.md)
- [AI 发现方案与审查记录](./docs/ai-discovery/)
