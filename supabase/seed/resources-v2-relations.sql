-- Curated deterministic discovery relations for every catalog resource.
-- Run after resources-v1.sql and 202608220001_add_discovery_relation_index.sql.
-- This script is idempotent and only references resources created by resources-v1.sql.
-- resources-v1.sql owns the original three entry points; this patch completes
-- the remaining catalog so every resource has at least three outgoing paths.

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
      'the-age-of-ai', 'how-to-create-a-mind', 'same_theme',
      '从人工智能的历史判断转向心智模型，比较技术愿景如何借用认知科学。', 5
    ),
    (
      'the-age-of-ai', 'the-creative-act', 'contrasting_view',
      '把技术改变社会的宏观叙述放回个人创作习惯，检验人的判断还保留什么位置。', 4
    ),
    (
      'the-age-of-ai', 'generative-art', 'historical_context',
      '从人工智能的观念史进入算法艺术实践，观察预测如何成为可见的图像形式。', 3
    ),
    (
      'how-to-create-a-mind', 'the-age-of-ai', 'same_theme',
      '从大脑的模式识别模型回到人工智能社会史，比较机制解释和公共想象。', 4
    ),
    (
      'how-to-create-a-mind', 'the-creative-mind', 'contrasting_view',
      '把认知系统怎样生成表征，与创造力怎样突破既有表征放在同一个问题中。', 4
    ),
    (
      'how-to-create-a-mind', 'the-library-of-babel', 'unexpected_bridge',
      '从有限的心智模型偏离到无限文本的寓言，追问知识边界由谁设定。', 3
    ),
    (
      'the-creative-mind', 'the-creative-act', 'same_theme',
      '从创造力的机制分析回到创作日常，检验理论如何转化为可持续的练习。', 5
    ),
    (
      'the-creative-mind', 'generative-art', 'unexpected_bridge',
      '把创造力分类法放进生成艺术的规则系统，观察随机性何时真正产生新意。', 4
    ),
    (
      'the-creative-mind', 'the-design-of-everyday-things', 'historical_context',
      '从创造力的心理机制转向设计史中的可用性，理解新想法怎样进入具体行动。', 3
    ),
    (
      'ways-of-seeing', 'on-photography', 'same_theme',
      '从图像与权力的批评继续到摄影媒介，比较观看如何塑造记忆与证据。', 5
    ),
    (
      'ways-of-seeing', 'the-design-of-everyday-things', 'contrasting_view',
      '把视觉文化的批判带到日常物件，比较被观看的图像和被使用的设计。', 4
    ),
    (
      'ways-of-seeing', 'the-image-of-the-city', 'unexpected_bridge',
      '从画面中的观看位置偏离到城市地标，发现空间同样训练着人的视线。', 3
    ),
    (
      'the-design-of-everyday-things', 'ways-of-seeing', 'same_theme',
      '从物件的可理解性回到视觉文化，追问设计中的提示如何影响观看习惯。', 5
    ),
    (
      'the-design-of-everyday-things', 'the-practice-of-everyday-life', 'historical_context',
      '从设计者预设的使用路径转向使用者的日常策略，补上实践中的改写能力。', 4
    ),
    (
      'the-design-of-everyday-things', 'the-art-of-noticing', 'unexpected_bridge',
      '把界面中的反馈和错误带进注意力练习，学习从细小摩擦里发现设计问题。', 3
    ),
    (
      'the-practice-of-everyday-life', 'the-image-of-the-city', 'same_theme',
      '从日常行走回到城市意象，比较居民经验怎样补充规划者绘出的认知地图。', 5
    ),
    (
      'the-practice-of-everyday-life', 'the-arcades-project', 'historical_context',
      '从当代生活策略回看现代都市片段，理解消费与漫游如何积累成城市记忆。', 4
    ),
    (
      'the-practice-of-everyday-life', 'the-art-of-noticing', 'unexpected_bridge',
      '把战术性的日常行动转为观察练习，在熟悉路线中寻找可以重新命名的细节。', 3
    ),
    (
      'invisible-cities', 'the-image-of-the-city', 'same_theme',
      '从虚构城市回到认知地图，比较叙事和测量如何分别组织空间经验。', 5
    ),
    (
      'invisible-cities', 'the-arcades-project', 'historical_context',
      '从卡尔维诺的城市寓言进入本雅明的城市片段，追踪现代性如何被写成碎片。', 4
    ),
    (
      'invisible-cities', 'the-library-of-babel', 'unexpected_bridge',
      '把想象城市的无穷变化偏离到无限书架，比较世界如何通过组合获得秩序。', 3
    ),
    (
      'on-photography', 'ways-of-seeing', 'same_theme',
      '从摄影的公共观看回到图像批评，理解镜头如何分配注意力和解释权。', 5
    ),
    (
      'on-photography', 'cities-and-memory', 'historical_context',
      '从摄影保存的私人记忆进入城市专题，观察图像怎样成为集体空间的档案。', 4
    ),
    (
      'on-photography', 'the-art-of-noticing', 'unexpected_bridge',
      '把摄影的取景选择转化为无相机的观察练习，训练对日常场景的耐心。', 3
    ),
    (
      'the-arcades-project', 'the-image-of-the-city', 'same_theme',
      '从城市片段的拼贴回到认知地图，比较漫游者和规划者各自保存什么。', 5
    ),
    (
      'the-arcades-project', 'on-photography', 'contrasting_view',
      '把引文式的城市观察与摄影瞬间并置，比较两种媒介如何固定现代生活。', 4
    ),
    (
      'the-arcades-project', 'the-order-of-things', 'unexpected_bridge',
      '从零散的都市引文偏离到知识分类，追问碎片何时会被制度化为档案。', 3
    ),
    (
      'the-order-of-things', 'the-library-of-babel', 'same_theme',
      '从知识分类的制度史回到无限图书馆，比较秩序的权力和无穷的焦虑。', 5
    ),
    (
      'the-order-of-things', 'the-organization-of-knowledge', 'historical_context',
      '从分类如何形成的哲学问题进入编目实践，观察概念怎样落实为检索规则。', 4
    ),
    (
      'the-order-of-things', 'the-myth-of-sisyphus', 'unexpected_bridge',
      '把知识秩序的必然性偏离到荒诞体验，重新追问人在分类之外如何选择意义。', 3
    ),
    (
      'the-organization-of-knowledge', 'the-library-of-babel', 'same_theme',
      '从编目和索引的工具回到无限书架，检验检索系统怎样对抗知识的无边界。', 5
    ),
    (
      'the-organization-of-knowledge', 'the-design-of-everyday-things', 'contrasting_view',
      '把信息架构的分类逻辑与日常设计的反馈原则并置，比较两类可理解性。', 4
    ),
    (
      'the-organization-of-knowledge', 'happy-accidents', 'unexpected_bridge',
      '从严格的检索路径偏离到偶然阅读，观察系统如何为意外发现留下入口。', 3
    ),
    (
      'the-pleasures-of-counting', 'the-library-of-babel', 'same_theme',
      '从数学中的无限与概率回到文学图书馆，比较计数和叙事面对无穷的方式。', 5
    ),
    (
      'the-pleasures-of-counting', 'how-to-create-a-mind', 'historical_context',
      '从组合与概率的直觉进入模式识别模型，理解计算怎样成为认知解释的语言。', 4
    ),
    (
      'the-pleasures-of-counting', 'generative-art', 'unexpected_bridge',
      '把数学游戏的规则偏离到生成艺术，观察同一组约束如何长出视觉形式。', 3
    ),
    (
      'the-myth-of-sisyphus', 'the-order-of-things', 'contrasting_view',
      '把荒诞中的个人选择与知识制度的分类秩序并置，比较意义来自哪里。', 5
    ),
    (
      'the-myth-of-sisyphus', 'the-creative-act', 'same_theme',
      '从荒诞经验回到创作实践，探索人在无法保证结果时为何仍愿意行动。', 4
    ),
    (
      'the-myth-of-sisyphus', 'happy-accidents', 'unexpected_bridge',
      '把重复劳动的荒诞偏离到偶然发现，观察意外如何重新打开选择的可能。', 3
    ),
    (
      'the-art-of-noticing', 'the-creative-act', 'same_theme',
      '从观察练习回到创作习惯，说明注意力如何成为表达之前更基础的材料。', 5
    ),
    (
      'the-art-of-noticing', 'the-image-of-the-city', 'historical_context',
      '从细节观察进入城市意象研究，理解路径和地标怎样塑造共同的注意力。', 4
    ),
    (
      'the-art-of-noticing', 'the-pleasures-of-counting', 'unexpected_bridge',
      '把感官观察偏离到数学计数，体验收集细节也能成为理解模式的方法。', 3
    ),
    (
      'generative-art', 'the-creative-act', 'same_theme',
      '从规则和随机性回到创作实践，比较作者意图如何在生成过程中被重新定义。', 5
    ),
    (
      'generative-art', 'how-to-create-a-mind', 'historical_context',
      '从算法图像回到模式识别模型，理解生成系统借用了哪些关于心智的假设。', 4
    ),
    (
      'generative-art', 'ways-of-seeing', 'unexpected_bridge',
      '把算法生成的图像偏离到观看批评，追问谁决定了视觉结果的意义。', 3
    ),
    (
      'cities-and-memory', 'the-image-of-the-city', 'same_theme',
      '从专题路径回到城市意象研究，比较策展叙事和认知地图如何保存地点。', 5
    ),
    (
      'cities-and-memory', 'invisible-cities', 'contrasting_view',
      '把档案式的城市记忆与虚构城市并置，比较真实经验和想象怎样相互照亮。', 4
    ),
    (
      'cities-and-memory', 'on-photography', 'historical_context',
      '从城市专题的线索回到摄影批评，理解图像为何能既保存又改写记忆。', 3
    ),
    (
      'happy-accidents', 'the-library-of-babel', 'same_theme',
      '从偶然阅读的专题回到无限图书馆，比较迷路如何成为发现知识的方法。', 5
    ),
    (
      'happy-accidents', 'the-myth-of-sisyphus', 'contrasting_view',
      '把意外带来的开放性与荒诞中的选择并置，比较偶然和意志如何塑造意义。', 4
    ),
    (
      'happy-accidents', 'the-organization-of-knowledge', 'historical_context',
      '从偶然发现回到检索系统，理解精心设计的分类如何也能容纳绕路。', 3
    )
) as links(source_slug, target_slug, relation_type, explanation, strength)
join public.resources source_resource on source_resource.slug = links.source_slug
join public.resources target_resource on target_resource.slug = links.target_slug
on conflict (source_resource_id, target_resource_id, relation_type) do update set
  explanation = excluded.explanation,
  strength = excluded.strength;

-- Coverage audit: this returns zero rows only when every public resource has
-- an outgoing relation and every featured entry point has at least three.
with relation_coverage as (
  select
    resource.id,
    resource.slug,
    resource.is_featured,
    count(relation.id)::integer as outgoing_relation_count
  from public.resources resource
  left join public.resource_relations relation
    on relation.source_resource_id = resource.id
  group by resource.id, resource.slug, resource.is_featured
)
select slug, is_featured, outgoing_relation_count
from relation_coverage
where outgoing_relation_count < case when is_featured then 3 else 1 end
order by is_featured desc, slug;
