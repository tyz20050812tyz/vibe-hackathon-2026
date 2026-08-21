-- Curated demo catalog for the "Beyond the Shelf" first phase.
-- Run in order after:
-- 1. 20260821_create_library_foundation.sql
-- 2. 202608210001_add_resource_catalog_search.sql
-- The UI-only "演示资料" label and Mock catalog live in PR #11;
-- this seed intentionally does not add an isDemo field to the API contract.
-- The script is idempotent and contains no user data.

insert into public.tags (name, slug, category)
values
  ('人工智能', 'artificial-intelligence', 'discipline'),
  ('心理学', 'psychology', 'discipline'),
  ('文学', 'literature', 'discipline'),
  ('设计', 'design', 'discipline'),
  ('城市', 'city', 'discipline'),
  ('社会学', 'sociology', 'discipline'),
  ('创造力', 'creativity', 'theme'),
  ('记忆', 'memory', 'theme'),
  ('偶然', 'serendipity', 'theme'),
  ('哲学', 'philosophy', 'discipline'),
  ('摄影', 'photography', 'format'),
  ('图书馆', 'libraries', 'theme')
on conflict (slug) do update set
  name = excluded.name,
  category = excluded.category;

insert into public.resources (
  slug, type, title, subtitle, creators, published_year, summary, cover_url,
  location, availability, external_url, is_featured
)
values
  (
    'the-creative-act', 'book', 'The Creative Act', 'A Way of Being',
    '["Rick Rubin"]'::jsonb, 2023,
    '从日常观察出发讨论创作习惯、注意力与判断力，适合作为 AI 与创造力故事的起点。',
    null, null, 'check_library', null, true
  ),
  (
    'the-age-of-ai', 'book', 'The Age of AI', 'And Our Human Future',
    '["Henry A. Kissinger", "Eric Schmidt", "Daniel Huttenlocher"]'::jsonb, 2021,
    '以历史和哲学视角讨论人工智能如何改变知识、决策与人的自我理解。',
    null, null, 'check_library', null, true
  ),
  (
    'how-to-create-a-mind', 'book', 'How to Create a Mind', null,
    '["Ray Kurzweil"]'::jsonb, 2012,
    '从模式识别和脑科学的角度介绍心智模型，为理解生成式系统提供跨学科入口。',
    null, null, 'check_library', null, false
  ),
  (
    'the-creative-mind', 'book', 'The Creative Mind', 'Myths and Mechanisms',
    '["Margaret A. Boden"]'::jsonb, 2004,
    '解释组合、探索与变革三类创造力机制，帮助读者区分生成结果与创造过程。',
    null, null, 'online', 'https://www.routledge.com/The-Creative-Mind-Myths-and-Mechanisms/Boden/p/book/9780415314527', true
  ),
  (
    'ways-of-seeing', 'book', 'Ways of Seeing', null,
    '["John Berger"]'::jsonb, 1972,
    '通过图像、权力和观看习惯重新理解视觉文化，是设计与摄影主题的重要入口。',
    null, null, 'check_library', null, true
  ),
  (
    'the-design-of-everyday-things', 'book', 'The Design of Everyday Things', null,
    '["Don Norman"]'::jsonb, 2013,
    '以日常物件说明可理解性、反馈与错误设计，连接设计思考和用户体验。',
    null, null, 'check_library', null, false
  ),
  (
    'the-image-of-the-city', 'book', 'The Image of the City', null,
    '["Kevin Lynch"]'::jsonb, 1960,
    '研究人们如何通过路径、边界和地标形成城市意象，适合城市与记忆故事。',
    null, null, 'check_library', null, true
  ),
  (
    'the-practice-of-everyday-life', 'book', 'The Practice of Everyday Life', null,
    '["Michel de Certeau"]'::jsonb, 1984,
    '从行走、叙述与消费行为理解普通人怎样在城市结构中创造自己的生活空间。',
    null, null, 'check_library', null, false
  ),
  (
    'invisible-cities', 'book', 'Invisible Cities', null,
    '["Italo Calvino"]'::jsonb, 1972,
    '用想象中的城市讨论记忆、欲望与语言，让城市经验从测量转向叙事。',
    null, null, 'check_library', null, true
  ),
  (
    'on-photography', 'book', 'On Photography', null,
    '["Susan Sontag"]'::jsonb, 1977,
    '以短文分析摄影如何影响记忆、旅行和公共观看，是城市摄影的批判性参考。',
    null, null, 'check_library', null, false
  ),
  (
    'the-arcades-project', 'book', 'The Arcades Project', null,
    '["Walter Benjamin"]'::jsonb, 1999,
    '由城市片段、引文和观察组成的未完成著作，呈现现代都市与集体记忆的关系。',
    null, null, 'check_library', null, false
  ),
  (
    'the-library-of-babel', 'book', 'The Library of Babel', null,
    '["Jorge Luis Borges"]'::jsonb, 1941,
    '一座容纳所有可能文本的图书馆，引出秩序、偶然与知识边界的思考。',
    null, null, 'check_library', null, true
  ),
  (
    'the-order-of-things', 'book', 'The Order of Things', null,
    '["Michel Foucault"]'::jsonb, 1966,
    '讨论知识如何被分类与命名，能把小说里的无限书架带向知识制度的问题。',
    null, null, 'check_library', null, false
  ),
  (
    'the-organization-of-knowledge', 'book', 'Organizing Knowledge: Introduction to Access to Information', null,
    '["J. E. Rowley", "John Farrow"]'::jsonb, 2018,
    '介绍分类法、索引与检索系统的基本思想，连接图书馆实践和信息架构。',
    null, null, 'check_library', 'https://www.routledge.com/Organizing-Knowledge-Introduction-to-Access-to-Information-Introduction-to-Access-to-Information/Rowley-Farrow/p/book/9781138717947', false
  ),
  (
    'the-pleasures-of-counting', 'book', 'The Pleasures of Counting', null,
    '["T. W. Korner"]'::jsonb, 1996,
    '从数学故事谈无限、概率和发现的乐趣，为偶然阅读提供一个理性而轻盈的岔路。',
    null, null, 'check_library', null, false
  ),
  (
    'the-myth-of-sisyphus', 'book', 'The Myth of Sisyphus', null,
    '["Albert Camus"]'::jsonb, 1942,
    '从荒诞经验讨论意义的生成，为偶然和选择提供存在主义的观看方式。',
    null, null, 'check_library', null, false
  ),
  (
    'the-art-of-noticing', 'book', 'The Art of Noticing', null,
    '["Rob Walker"]'::jsonb, 2019,
    '通过练习注意力和观察日常场景，帮助读者从习以为常的环境里发现新的问题。',
    null, null, 'check_library', 'https://www.penguinrandomhouse.com/books/570033/the-art-of-noticing-by-rob-walker/', true
  ),
  (
    'generative-art', 'collection', 'Generative Art', 'Rules, randomness, and visual form',
    '["书外之遇编辑部"]'::jsonb, 2026,
    '围绕 AI、算法、随机性和视觉表达策展，连接人工智能、设计和当代艺术的不同读法。',
    null, '数字展柜 E-02', 'online', null, true
  ),
  (
    'cities-and-memory', 'collection', 'Cities and Memory', 'Reading the city through stories and images',
    '["书外之遇编辑部"]'::jsonb, 2026,
    '把城市研究、文学与摄影放在同一条阅读路径中，观察空间如何保存个人和集体记忆。',
    null, '数字展柜 E-04', 'online', null, true
  ),
  (
    'happy-accidents', 'collection', 'Happy Accidents', 'A collection for productive detours',
    '["书外之遇编辑部"]'::jsonb, 2026,
    '从小说、哲学和分类学中挑选意外相遇的文本，为第二阶段的探索关系保留起点。',
    null, '数字展柜 E-06', 'online', null, true
  )
on conflict (slug) do update set
  type = excluded.type,
  title = excluded.title,
  subtitle = excluded.subtitle,
  creators = excluded.creators,
  published_year = excluded.published_year,
  summary = excluded.summary,
  cover_url = excluded.cover_url,
  location = excluded.location,
  availability = excluded.availability,
  external_url = excluded.external_url,
  is_featured = excluded.is_featured;

insert into public.resource_tags (resource_id, tag_id)
select resource.id, tag.id
from (
  values
    ('the-creative-act', 'creativity'), ('the-creative-act', 'psychology'),
    ('the-age-of-ai', 'artificial-intelligence'), ('the-age-of-ai', 'philosophy'),
    ('how-to-create-a-mind', 'artificial-intelligence'), ('how-to-create-a-mind', 'psychology'),
    ('the-creative-mind', 'creativity'), ('the-creative-mind', 'psychology'),
    ('ways-of-seeing', 'design'), ('ways-of-seeing', 'photography'),
    ('the-design-of-everyday-things', 'design'), ('the-design-of-everyday-things', 'psychology'),
    ('the-image-of-the-city', 'city'), ('the-image-of-the-city', 'memory'),
    ('the-practice-of-everyday-life', 'city'), ('the-practice-of-everyday-life', 'sociology'),
    ('invisible-cities', 'city'), ('invisible-cities', 'literature'), ('invisible-cities', 'memory'),
    ('on-photography', 'photography'), ('on-photography', 'memory'), ('on-photography', 'city'),
    ('the-arcades-project', 'city'), ('the-arcades-project', 'literature'), ('the-arcades-project', 'memory'),
    ('the-library-of-babel', 'literature'), ('the-library-of-babel', 'libraries'), ('the-library-of-babel', 'serendipity'),
    ('the-order-of-things', 'philosophy'), ('the-order-of-things', 'libraries'),
    ('the-organization-of-knowledge', 'libraries'), ('the-organization-of-knowledge', 'design'),
    ('the-pleasures-of-counting', 'serendipity'), ('the-pleasures-of-counting', 'philosophy'),
    ('the-myth-of-sisyphus', 'philosophy'), ('the-myth-of-sisyphus', 'serendipity'),
    ('the-art-of-noticing', 'creativity'), ('the-art-of-noticing', 'serendipity'),
    ('generative-art', 'artificial-intelligence'), ('generative-art', 'design'), ('generative-art', 'creativity'),
    ('cities-and-memory', 'city'), ('cities-and-memory', 'memory'), ('cities-and-memory', 'photography'),
    ('happy-accidents', 'serendipity'), ('happy-accidents', 'libraries'), ('happy-accidents', 'philosophy')
) as links(resource_slug, tag_slug)
join public.resources resource on resource.slug = links.resource_slug
join public.tags tag on tag.slug = links.tag_slug
on conflict (resource_id, tag_id) do nothing;

insert into public.resource_relations (
  source_resource_id, target_resource_id, relation_type, explanation, strength
)
select source_resource.id, target_resource.id, links.relation_type, links.explanation, links.strength
from (
  values
    ('the-creative-act', 'the-creative-mind', 'same_theme', '从创作实践转向创造力机制，理解灵感背后的认知过程。', 5),
    ('the-creative-act', 'the-age-of-ai', 'contrasting_view', '把个人创作经验放到人工智能参与创作的时代背景中重新审视。', 4),
    ('the-creative-act', 'generative-art', 'unexpected_bridge', '用生成艺术的规则和随机性，测试创作是否必须从个人表达开始。', 4),
    ('the-creative-act', 'the-art-of-noticing', 'same_theme', '注意力练习为日常创作提供了比技巧更基础的入口。', 3),
    ('the-creative-act', 'ways-of-seeing', 'unexpected_bridge', '改变观看方式能让创作从表达自我转向理解图像与权力。', 3),
    ('the-image-of-the-city', 'invisible-cities', 'contrasting_view', '把城市的认知地图与文学想象并置，比较测量和叙事如何保存城市。', 5),
    ('the-image-of-the-city', 'on-photography', 'unexpected_bridge', '摄影能把城市地标转成私人记忆，也暴露观看城市的选择性。', 4),
    ('the-image-of-the-city', 'the-practice-of-everyday-life', 'historical_context', '从城市形象继续追问居民如何通过日常行动使用和改写空间。', 4),
    ('the-image-of-the-city', 'the-arcades-project', 'historical_context', '现代都市的碎片式观察，为地图之外的城市经验补上历史纹理。', 3),
    ('the-image-of-the-city', 'cities-and-memory', 'same_theme', '策展专题把研究、小说和摄影组织成一条可直接浏览的城市路径。', 3),
    ('the-library-of-babel', 'the-order-of-things', 'historical_context', '从无限文本的幻想转向知识分类何以成为一种权力结构的问题。', 5),
    ('the-library-of-babel', 'the-organization-of-knowledge', 'same_theme', '小说中的无穷书架与真实世界的编目、索引和检索系统形成对照。', 4),
    ('the-library-of-babel', 'the-pleasures-of-counting', 'unexpected_bridge', '无限的文学想象可以延伸到数学中的概率、计数与秩序。', 4),
    ('the-library-of-babel', 'the-myth-of-sisyphus', 'contrasting_view', '面对无法穷尽的知识，存在主义提供了关于意义和选择的另一种回应。', 3),
    ('the-library-of-babel', 'happy-accidents', 'same_theme', '策展专题保留了从一本小说偏离到哲学和设计的阅读入口。', 3)
) as links(source_slug, target_slug, relation_type, explanation, strength)
join public.resources source_resource on source_resource.slug = links.source_slug
join public.resources target_resource on target_resource.slug = links.target_slug
on conflict (source_resource_id, target_resource_id, relation_type) do update set
  explanation = excluded.explanation,
  strength = excluded.strength;
