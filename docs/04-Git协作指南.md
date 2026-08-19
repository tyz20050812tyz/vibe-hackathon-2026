# Git 协作指南

> 目标：让 `main` 始终可运行、可部署。

## 基本规则

1. 不直接在 `main` 开发。
2. 每个独立功能使用一个分支和一个 PR。
3. 合并前运行 `npm run lint` 与 `npm run build`。
4. 共享类型、SQL、依赖和环境变量修改前先沟通。
5. 合并后同步 `main`，再开下一条分支。

分支命名：`feat/<功能>`、`fix/<问题>`、`docs/<主题>`。

## 常用流程

```bash
git switch main
git pull origin main
git switch -c feat/<功能>

# 完成功能并验证后
git add <文件或目录>
git commit -m "feat: <完成的功能>"
git push -u origin feat/<功能>
```

到 GitHub 创建 PR。PR 中写清：做了什么、如何测试、是否有环境变量或 SQL 变更。由另一位队员检查 Preview 后合并。

## 例子一：前端功能

佟雨泽实现一个提交表单：

```bash
git switch main
git pull origin main
git switch -c feat/analysis-form

# 完成页面和组件
npm run lint
git add app components lib/types
git commit -m "feat: 添加分析提交表单"
git push -u origin feat/analysis-form
```

杨思涵在 PR Preview 中测试空输入、加载、成功和失败状态，确认后合并。

## 例子二：后端功能

杨思涵实现创建分析记录的 API：

```bash
git switch main
git pull origin main
git switch -c feat/analysis-api

# 完成 API 和 service
npm run lint
npm run build
git add app/api lib package.json package-lock.json
git commit -m "feat: 提供分析创建接口"
git push -u origin feat/analysis-api
```

如果 `main` 有新提交：

```bash
git fetch origin
git rebase origin/main
npm run lint
npm run build
git push --force-with-lease
```

只能对自己的功能分支使用 `--force-with-lease`，绝不强推 `main`。若冲突涉及 `lib/types/` 或 SQL，先与对方确认字段再继续。
