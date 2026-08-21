# 资源种子数据约定

首版使用人工精选资源，不在种子文件中写入真实用户数据、密钥或受版权限制的长文本。

## 文件命名

```text
supabase/seed/resources-v1.sql
```

种子文件按顺序写入：`tags` -> `resources` -> `resource_tags` -> `resource_relations`。

## 最小质量标准

- 第一批至少 20 条资源，最终扩展到 80 条左右；
- 每条资源有 2 个及以上标签；
- 三条演示故事各有至少 5 条关联资源；
- `resource_relations.explanation` 解释“为什么值得继续探索”，不是重复标题；
- 使用稳定 slug，种子重跑时可用 `on conflict (slug) do update` 保持幂等。
