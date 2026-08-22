import { Bookmark, BookOpenCheck, MessageSquareText, Tags } from "lucide-react";

export type LibraryStatsData = {
  savedCount: number;
  notedCount: number;
  topicCount: number;
  latestSavedAt: string | null;
};

function formatSavedAt(value: string | null) {
  if (!value) return "还没有收藏";
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(new Date(value));
}

export function LibraryStats({ stats }: { stats: LibraryStatsData }) {
  const items = [
    { label: "已存线索", value: String(stats.savedCount), icon: Bookmark },
    { label: "留下笔记", value: String(stats.notedCount), icon: MessageSquareText },
    { label: "触及主题", value: String(stats.topicCount), icon: Tags },
    { label: "最近收藏", value: formatSavedAt(stats.latestSavedAt), icon: BookOpenCheck },
  ];

  return <dl className="grid border-y border-[#254a42]/20 sm:grid-cols-2 lg:grid-cols-4">
    {items.map(({ label, value, icon: Icon }) => <div key={label} className="min-h-28 border-b border-[#254a42]/20 px-4 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 lg:px-5">
      <dt className="flex items-center gap-2 text-xs text-[#52625d]"><Icon className="size-3.5 text-[#a23b2c]" />{label}</dt>
      <dd className="mt-4 font-serif text-2xl leading-none text-[#172d29]">{value}</dd>
    </div>)}
  </dl>;
}
