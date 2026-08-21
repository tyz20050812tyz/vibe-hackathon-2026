import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabasePublicServerClient } from "@/lib/supabase/server";
import type { SearchResourcesQueryInput } from "@/lib/schemas/resources";
import type {
  Availability,
  GetResourceData,
  Resource,
  ResourceListItem,
  ResourceType,
  SearchResourcesData,
  Tag,
  TagCategory,
} from "@/lib/types/resources";

export type ResourceCatalogErrorCode =
  | "CONFIGURATION_ERROR"
  | "SUPABASE_UNAVAILABLE"
  | "INTERNAL_ERROR";

export class ResourceCatalogError extends Error {
  constructor(
    public readonly code: ResourceCatalogErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ResourceCatalogError";
  }
}

type TagRow = {
  id: string;
  name: string;
  slug: string;
  category: TagCategory;
};

type ResourceListRow = {
  id: string;
  slug: string;
  type: ResourceType;
  title: string;
  creators: unknown;
  summary: string;
  cover_url: string | null;
  availability: Availability;
};

type ResourceRow = ResourceListRow & {
  subtitle: string | null;
  published_year: number | null;
  location: string | null;
  external_url: string | null;
  is_featured: boolean;
};

type SearchResourceRow = ResourceListRow & {
  tags: unknown;
  total_count: number;
};

type ResourceTagRow = {
  resource_id: string;
  tag_id: string;
};

type ResourceRelationRow = {
  target_resource_id: string;
  strength: number;
  created_at: string;
  id: string;
};

function publicClient(): SupabaseClient {
  try {
    return createSupabasePublicServerClient();
  } catch {
    throw new ResourceCatalogError(
      "CONFIGURATION_ERROR",
      "Supabase 公开读取配置不完整。",
    );
  }
}

function unavailable(message: string): ResourceCatalogError {
  return new ResourceCatalogError("SUPABASE_UNAVAILABLE", message);
}

function invalidData(message: string): ResourceCatalogError {
  return new ResourceCatalogError("INTERNAL_ERROR", message);
}

function creatorsFrom(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw invalidData("资源作者数据格式不正确。");
  }

  return value;
}

function tagFrom(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    category: row.category,
  };
}

function tagsFrom(value: unknown): Tag[] {
  if (!Array.isArray(value)) {
    throw invalidData("资源标签数据格式不正确。");
  }

  return (value as TagRow[]).map(tagFrom);
}

function listItemFrom(row: ResourceListRow, tags: Tag[]): ResourceListItem {
  return {
    id: row.id,
    slug: row.slug,
    type: row.type,
    title: row.title,
    creators: creatorsFrom(row.creators),
    summary: row.summary,
    coverUrl: row.cover_url,
    availability: row.availability,
    tags,
  };
}

function resourceFrom(row: ResourceRow, tags: Tag[]): Resource {
  return {
    ...listItemFrom(row, tags),
    subtitle: row.subtitle,
    publishedYear: row.published_year,
    location: row.location,
    externalUrl: row.external_url,
    isFeatured: row.is_featured,
  };
}

async function tagsByResourceId(
  supabase: SupabaseClient,
  resourceIds: string[],
): Promise<Map<string, Tag[]>> {
  const result = new Map<string, Tag[]>();
  resourceIds.forEach((id) => result.set(id, []));

  if (resourceIds.length === 0) {
    return result;
  }

  const { data: linksData, error: linksError } = await supabase
    .from("resource_tags")
    .select("resource_id, tag_id")
    .in("resource_id", resourceIds);

  if (linksError) {
    throw unavailable("无法读取资源标签关系。");
  }

  const links = linksData as ResourceTagRow[];
  const tagIds = [...new Set(links.map((link) => link.tag_id))];
  if (tagIds.length === 0) {
    return result;
  }

  const { data: tagsData, error: tagsError } = await supabase
    .from("tags")
    .select("id, name, slug, category")
    .in("id", tagIds)
    .order("name", { ascending: true })
    .order("id", { ascending: true });

  if (tagsError) {
    throw unavailable("无法读取资源标签。");
  }

  const tags = new Map(
    (tagsData as TagRow[]).map((row) => [row.id, tagFrom(row)]),
  );

  links.forEach((link) => {
    const tag = tags.get(link.tag_id);
    if (tag) {
      result.get(link.resource_id)?.push(tag);
    }
  });

  result.forEach((resourceTags) => {
    resourceTags.sort(
      (left, right) =>
        left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
    );
  });

  return result;
}

export async function searchResources(
  query: SearchResourcesQueryInput,
): Promise<SearchResourcesData> {
  const supabase = publicClient();
  const { data, error } = await supabase.rpc("search_resource_catalog", {
    p_q: query.q ?? null,
    p_tag: query.tag ?? null,
    p_type: query.type ?? null,
    p_limit: query.limit,
  });

  if (error) {
    throw unavailable("无法搜索资源目录。");
  }

  const rows = data as SearchResourceRow[];
  return {
    items: rows.map((row) => listItemFrom(row, tagsFrom(row.tags))),
    total: rows[0]?.total_count ?? 0,
    appliedFilters: {
      q: query.q ?? "",
      tag: query.tag ?? null,
      type: query.type ?? null,
    },
  };
}

export async function getResourceBySlug(
  slug: string,
): Promise<GetResourceData | null> {
  const supabase = publicClient();
  const { data: resourceData, error: resourceError } = await supabase
    .from("resources")
    .select(
      "id, slug, type, title, subtitle, creators, published_year, summary, cover_url, location, availability, external_url, is_featured",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (resourceError) {
    throw unavailable("无法读取资源详情。");
  }
  if (!resourceData) {
    return null;
  }

  const resourceRow = resourceData as ResourceRow;
  const resourceTags = await tagsByResourceId(supabase, [resourceRow.id]);

  const { data: relationData, error: relationError } = await supabase
    .from("resource_relations")
    .select("target_resource_id, strength, created_at, id")
    .eq("source_resource_id", resourceRow.id)
    .order("strength", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (relationError) {
    throw unavailable("无法读取关联资源。");
  }

  const relations = relationData as ResourceRelationRow[];
  const targetIds = [
    ...new Set(relations.map((relation) => relation.target_resource_id)),
  ];
  if (targetIds.length === 0) {
    return {
      resource: resourceFrom(
        resourceRow,
        resourceTags.get(resourceRow.id) ?? [],
      ),
      related: [],
    };
  }

  const { data: relatedData, error: relatedError } = await supabase
    .from("resources")
    .select(
      "id, slug, type, title, creators, summary, cover_url, availability",
    )
    .in("id", targetIds);

  if (relatedError) {
    throw unavailable("无法读取关联资源详情。");
  }

  const relatedRows = relatedData as ResourceListRow[];
  const relatedTags = await tagsByResourceId(supabase, targetIds);
  const relatedById = new Map(
    relatedRows.map((row) => [
      row.id,
      listItemFrom(row, relatedTags.get(row.id) ?? []),
    ]),
  );

  return {
    resource: resourceFrom(resourceRow, resourceTags.get(resourceRow.id) ?? []),
    related: targetIds.flatMap((id) => {
      const resource = relatedById.get(id);
      return resource ? [resource] : [];
    }),
  };
}
