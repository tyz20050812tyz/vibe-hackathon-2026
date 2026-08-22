-- Curated deterministic discovery relations for the three phase-two stories.
-- Run after resources-v1.sql and 202608220001_add_discovery_relation_index.sql.
-- This script is idempotent and only references resources created by resources-v1.sql.

insert into public.resource_relations (
  source_resource_id,
  target_resource_id,
  relation_type,
  explanation,
  strength
)
select
  source_resource.id,
  target_resource.id,
  links.relation_type,
  links.explanation,
  links.strength
from (
  values
    (
      'the-creative-act',
      'generative-art',
      'unexpected_bridge',
      '用生成艺术的规则和随机性，测试创作是否必须从个人表达开始。',
      4
    ),
    (
      'the-creative-act',
      'ways-of-seeing',
      'unexpected_bridge',
      '改变观看方式能让创作从表达自我转向理解图像与权力。',
      3
    ),
    (
      'the-creative-act',
      'the-creative-mind',
      'same_theme',
      '从创作实践转向创造力机制，理解灵感背后的认知过程。',
      5
    ),
    (
      'the-image-of-the-city',
      'on-photography',
      'unexpected_bridge',
      '摄影能把城市地标转成私人记忆，也暴露观看城市的选择性。',
      4
    ),
    (
      'the-image-of-the-city',
      'the-art-of-noticing',
      'unexpected_bridge',
      '从城市意象转向日常观察练习，重新发现熟悉空间里被忽略的线索。',
      3
    ),
    (
      'the-image-of-the-city',
      'cities-and-memory',
      'same_theme',
      '策展专题把研究、小说和摄影组织成一条可直接浏览的城市路径。',
      3
    ),
    (
      'the-library-of-babel',
      'the-pleasures-of-counting',
      'unexpected_bridge',
      '无限的文学想象可以延伸到数学中的概率、计数与秩序。',
      4
    ),
    (
      'the-library-of-babel',
      'the-art-of-noticing',
      'unexpected_bridge',
      '从无法穷尽的文本宇宙转向具体观察练习，在有限细节中重新发现秩序。',
      3
    ),
    (
      'the-library-of-babel',
      'the-organization-of-knowledge',
      'same_theme',
      '小说中的无穷书架与真实世界的编目、索引和检索系统形成对照。',
      4
    )
) as links(source_slug, target_slug, relation_type, explanation, strength)
join public.resources source_resource on source_resource.slug = links.source_slug
join public.resources target_resource on target_resource.slug = links.target_slug
on conflict (source_resource_id, target_resource_id, relation_type) do update set
  explanation = excluded.explanation,
  strength = excluded.strength;
