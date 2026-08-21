import type { Resource, ResourceListItem, Tag } from "@/lib/types/resources";

const tag = (slug: string, name: string, category: Tag["category"]): Tag => ({ id: `tag-${slug}`, slug, name, category });

const ai = tag("artificial-intelligence", "人工智能", "discipline");
const psychology = tag("psychology", "心理学", "discipline");
const literature = tag("literature", "文学", "discipline");
const design = tag("design", "设计", "discipline");
const city = tag("city", "城市", "discipline");
const sociology = tag("sociology", "社会学", "discipline");
const creativity = tag("creativity", "创造力", "theme");
const memory = tag("memory", "记忆", "theme");
const serendipity = tag("serendipity", "偶然", "theme");
const philosophy = tag("philosophy", "哲学", "discipline");
const photography = tag("photography", "摄影", "format");
const libraries = tag("libraries", "图书馆", "theme");

export const popularTags = [ai, psychology, literature, design, city, sociology];

type MockResource = Omit<Resource, "id" | "coverUrl" | "externalUrl">;

const catalog: MockResource[] = [
  { slug: "the-creative-act", type: "book", title: "The Creative Act", subtitle: "A Way of Being", creators: ["Rick Rubin"], publishedYear: 2023, summary: "从日常观察出发讨论创作习惯、注意力与判断力，适合作为 AI 与创造力故事的起点。", location: null, availability: "check_library", tags: [creativity, psychology], isFeatured: true },
  { slug: "the-age-of-ai", type: "book", title: "The Age of AI", subtitle: "And Our Human Future", creators: ["Henry A. Kissinger", "Eric Schmidt", "Daniel Huttenlocher"], publishedYear: 2021, summary: "以历史和哲学视角讨论人工智能如何改变知识、决策与人的自我理解。", location: null, availability: "check_library", tags: [ai, philosophy], isFeatured: true },
  { slug: "how-to-create-a-mind", type: "book", title: "How to Create a Mind", subtitle: null, creators: ["Ray Kurzweil"], publishedYear: 2012, summary: "从模式识别和脑科学的角度介绍心智模型，为理解生成式系统提供跨学科入口。", location: null, availability: "check_library", tags: [ai, psychology], isFeatured: false },
  { slug: "the-creative-mind", type: "book", title: "The Creative Mind", subtitle: "Myths and Mechanisms", creators: ["Margaret A. Boden"], publishedYear: 2004, summary: "解释组合、探索与变革三类创造力机制，帮助读者区分生成结果与创造过程。", location: null, availability: "online", tags: [creativity, psychology, ai], isFeatured: true },
  { slug: "ways-of-seeing", type: "book", title: "Ways of Seeing", subtitle: null, creators: ["John Berger"], publishedYear: 1972, summary: "通过图像、权力和观看习惯重新理解视觉文化，是设计与摄影主题的重要入口。", location: null, availability: "check_library", tags: [design, photography], isFeatured: true },
  { slug: "the-image-of-the-city", type: "book", title: "The Image of the City", subtitle: null, creators: ["Kevin Lynch"], publishedYear: 1960, summary: "研究人们如何通过路径、边界和地标形成城市意象，适合城市与记忆故事。", location: null, availability: "check_library", tags: [city, memory], isFeatured: true },
  { slug: "invisible-cities", type: "book", title: "Invisible Cities", subtitle: null, creators: ["Italo Calvino"], publishedYear: 1972, summary: "用想象中的城市讨论记忆、欲望与语言，让城市经验从测量转向叙事。", location: null, availability: "check_library", tags: [city, literature, memory], isFeatured: true },
  { slug: "the-library-of-babel", type: "book", title: "The Library of Babel", subtitle: null, creators: ["Jorge Luis Borges"], publishedYear: 1941, summary: "一座容纳所有可能文本的图书馆，引出秩序、偶然与知识边界的思考。", location: null, availability: "check_library", tags: [literature, libraries, serendipity], isFeatured: true },
  { slug: "generative-art", type: "collection", title: "Generative Art", subtitle: "Rules, randomness, and visual form", creators: ["书外之遇编辑部"], publishedYear: 2026, summary: "围绕 AI、算法、随机性和视觉表达策展，连接人工智能、设计和当代艺术的不同读法。", location: null, availability: "online", tags: [ai, design, creativity], isFeatured: true },
  { slug: "cities-and-memory", type: "collection", title: "Cities and Memory", subtitle: "Reading the city through stories and images", creators: ["书外之遇编辑部"], publishedYear: 2026, summary: "把城市研究、文学与摄影放在同一条阅读路径中，观察空间如何保存个人和集体记忆。", location: null, availability: "online", tags: [city, memory, sociology], isFeatured: true },
];

export const resources: Resource[] = catalog.map((resource, index) => ({ ...resource, id: `f2000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, coverUrl: null, externalUrl: null }));

export const toListItem = (resource: Resource): ResourceListItem => ({
  id: resource.id,
  slug: resource.slug,
  type: resource.type,
  title: resource.title,
  creators: resource.creators,
  summary: resource.summary,
  coverUrl: resource.coverUrl,
  availability: resource.availability,
  tags: resource.tags,
});
export const findResource = (slug: string) => resources.find((resource) => resource.slug === slug);
export const findRelated = (resource: Resource) => resources.filter((item) => item.id !== resource.id && item.tags.some((itemTag) => resource.tags.some((resourceTag) => itemTag.slug === resourceTag.slug))).slice(0, 3).map(toListItem);
export const searchMockResources = (query: string, tagSlug: string | null) => resources.filter((resource) => {
  const text = [resource.title, resource.summary, ...resource.creators, ...resource.tags.map((item) => item.name)].join(" ").toLocaleLowerCase();
  return (!query || text.includes(query.toLocaleLowerCase())) && (!tagSlug || resource.tags.some((item) => item.slug === tagSlug));
});
