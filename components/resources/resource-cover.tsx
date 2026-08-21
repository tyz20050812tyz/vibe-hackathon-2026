/* eslint-disable @next/next/no-img-element -- seed records supply dynamic Open Library image URLs. */

import type { ResourceListItem } from "@/lib/types/resources";
import { resourceTypeLabel } from "@/lib/resource-presentation";

const covers = ["bg-[#c84432] text-[#fff5de]", "bg-[#244f46] text-[#f6ead0]", "bg-[#d2a85a] text-[#172d29]", "bg-[#303839] text-[#f0dfbb]", "bg-[#6a3b2a] text-[#fff4dc]", "bg-[#596b8a] text-[#fff5dd]"];

export function ResourceCover({ resource, className = "" }: { resource: ResourceListItem; className?: string }) {
  const index = resource.title.split("").reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % covers.length;
  const kind = resourceTypeLabel(resource.type);
  if (resource.coverUrl) {
    return <div className={`relative aspect-[3/4] overflow-hidden border border-black/15 bg-[#e4e7d4] shadow-[5px_6px_0_rgb(21_43_38_/_18%)] ${className}`}><img src={resource.coverUrl} alt={`${resource.title} 封面`} className="size-full object-cover" /><span className="absolute bottom-0 right-0 bg-[#172d29]/85 px-2 py-1 text-[10px] text-[#fff8e9]">演示资料</span></div>;
  }
  return <div className={`relative flex aspect-[3/4] flex-col justify-between overflow-hidden border border-black/15 p-3 shadow-[5px_6px_0_rgb(21_43_38_/_18%)] ${covers[index]} ${className}`}><div className="border-t border-current/50 pt-2 text-[10px] font-semibold">书外之遇 / {kind}</div><div><p className="font-serif text-xl leading-tight">{resource.title}</p><p className="mt-2 text-xs opacity-90">{resource.creators[0]}</p></div><div className="border-t border-current/50 pt-2 text-[10px]"><span>{resource.tags[0]?.name}</span><span className="float-right">演示资料</span></div></div>;
}
