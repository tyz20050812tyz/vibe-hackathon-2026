import { ResourceCard } from "@/components/resources/resource-card";
import type { ResourceListItem } from "@/lib/types/resources";

export function ResourceList({ resources, detailHrefById }: { resources: ResourceListItem[]; detailHrefById?: Record<string, string> }) {
  if (!resources.length) return <div className="border border-dashed border-[#254a42]/35 px-6 py-14 text-center"><p className="font-serif text-2xl text-[#172d29]">没有找到相符的资源</p><p className="mt-2 text-sm text-[#52625d]">试试更短的关键词，或清除当前主题筛选。</p></div>;
  return <div>{resources.map((resource) => <ResourceCard key={resource.id} resource={resource} detailHref={detailHrefById?.[resource.id]} />)}</div>;
}
