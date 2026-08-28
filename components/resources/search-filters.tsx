"use client";

import { Check, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { parseSearchFilters, serializeSearchFilters } from "@/lib/catalog-filters";
import type { Availability, ResourceLanguage, ResourceType, SearchResourcesQuery } from "@/lib/types/resources";

const options = {
  languages: [["en", "英文"], ["zh", "中文"], ["other", "其他"]] as const,
  types: [["book", "图书"], ["paper", "论文"], ["talk", "讲座"], ["collection", "专题"]] as const,
  availabilities: [["online", "在线"], ["available", "可借阅"], ["check_library", "馆藏待查"], ["reference_only", "仅供参考"]] as const,
};

export function SearchFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = useMemo(() => parseSearchFilters(new URLSearchParams(params.toString())), [params]);

  const update = (patch: Partial<SearchResourcesQuery>) => {
    const next = { ...current, ...patch };
    router.push(`${pathname}?${serializeSearchFilters(next)}`);
  };
  const toggle = (field: "languages" | "types" | "availabilities", value: string) => {
    const values = current[field] ?? [];
    update({ [field]: values.includes(value as never) ? values.filter((item) => item !== value) : [...values, value] } as Partial<SearchResourcesQuery>);
  };

  return <details className="mt-6 border-y border-[#254a42]/20 py-4">
    <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-[#254a42]"><SlidersHorizontal className="size-4" />结构化筛选<span className="text-xs text-[#78837c]">语言、年份、类型、可读状态</span></summary>
    <div className="mt-5 grid gap-5 md:grid-cols-3">
      <FilterGroup title="内容语言">{options.languages.map(([value, label]) => <CheckOption key={value} label={label} checked={current.languages?.includes(value as ResourceLanguage) ?? false} onChange={() => toggle("languages", value)} />)}</FilterGroup>
      <FilterGroup title="资源类型">{options.types.map(([value, label]) => <CheckOption key={value} label={label} checked={current.types?.includes(value as ResourceType) ?? false} onChange={() => toggle("types", value)} />)}</FilterGroup>
      <FilterGroup title="可读状态">{options.availabilities.map(([value, label]) => <CheckOption key={value} label={label} checked={current.availabilities?.includes(value as Availability) ?? false} onChange={() => toggle("availabilities", value)} />)}</FilterGroup>
    </div>
    <div className="mt-5 flex flex-wrap items-end gap-3">
      <YearInput key={`from-${current.yearFrom ?? ""}`} label="最早年份" initialValue={current.yearFrom?.toString() ?? ""} onCommit={(value) => update({ yearFrom: value ? Number(value) : undefined })} />
      <YearInput key={`to-${current.yearTo ?? ""}`} label="最晚年份" initialValue={current.yearTo?.toString() ?? ""} onCommit={(value) => update({ yearTo: value ? Number(value) : undefined })} />
    </div>
  </details>;
}

function YearInput({ label, initialValue, onCommit }: { label: string; initialValue: string; onCommit: (value: string) => void }) {
  const [value, setValue] = useState(initialValue);
  return <label className="text-sm text-[#52625d]">{label}<input type="number" min={1000} max={2100} value={value} onChange={(event) => setValue(event.target.value)} onBlur={() => onCommit(value)} className="mt-1 block w-28 border border-[#254a42]/30 bg-[#fffdf5] px-2 py-1.5" /></label>;
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <fieldset><legend className="mb-2 text-xs uppercase tracking-[0.14em] text-[#78837c]">{title}</legend><div className="space-y-2">{children}</div></fieldset>;
}

function CheckOption({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return <label className="flex cursor-pointer items-center gap-2 text-sm text-[#45554f]"><span className={`flex size-4 items-center justify-center border ${checked ? "border-[#254a42] bg-[#254a42] text-[#fff8e9]" : "border-[#254a42]/40"}`}><input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />{checked ? <Check className="size-3" /> : null}</span>{label}</label>;
}
