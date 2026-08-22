import type { SupabaseClient } from "@supabase/supabase-js";

import type { DiscoverQueryInput } from "@/lib/schemas/discovery";
import type { ApiErrorCode } from "@/lib/types/api";
import type { DiscoveryData } from "@/lib/types/discovery";
import type {
  Availability,
  RelationType,
  ResourceListItem,
  ResourceType,
  Tag,
  TagCategory,
} from "@/lib/types/resources";

type DiscoveryErrorCode = Extract<
  ApiErrorCode,
  "UNAUTHORIZED" | "RESOURCE_NOT_FOUND" | "SUPABASE_UNAVAILABLE" | "INTERNAL_ERROR"
>;

export class DiscoveryServiceError extends Error {
  constructor(
    public readonly code: DiscoveryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DiscoveryServiceError";
  }
}

type TagRow = {
  id: string;
  name: string;
  slug: string;
  category: TagCategory;
};

type ResourceRow = {
  id: string;
  slug: string;
  type: ResourceType;
  title: string;
  creators: unknown;
  summary: string;
  cover_url: string | null;
  availability: Availability;
  resource_tags: unknown;
};

type RelationRow = {
  target_resource_id: string;
  relation_type: RelationType;
  explanation: string;
  strength: number;
};

const resourceListSelect =
  "id, slug, type, title, creators, summary, cover_url, availability, resource_tags(tag:tags(id, name, slug, category))";

function unavailable(message: string) {
  return new DiscoveryServiceError("SUPABASE_UNAVAILABLE", message);
}

function internal(message: string) {
  return new DiscoveryServiceError("INTERNAL_ERROR", message);
}

function tagsFrom(value: unknown): Tag[] {
  if (!Array.isArray(value)) {
    throw internal("推荐资源标签的数据格式不正确。");
  }

  const tags = value.flatMap((link) => {
    const tag = (link as { tag?: unknown }).tag as Partial<TagRow> | null;
    if (!tag) return [];
    if (
      typeof tag.id !== "string" ||
      typeof tag.name !== "string" ||
      typeof tag.slug !== "string" ||
      typeof tag.category !== "string"
    ) {
      throw internal("推荐资源标签的数据格式不正确。");
    }
    return [tag as Tag];
  });

  return tags.sort(
    (left, right) =>
      left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
  );
}

function resourceFrom(value: unknown): ResourceListItem {
  const row = value as Partial<ResourceRow> | null;
  if (
    !row ||
    typeof row.id !== "string" ||
    typeof row.slug !== "string" ||
    typeof row.type !== "string" ||
    typeof row.title !== "string" ||
    !Array.isArray(row.creators) ||
    !row.creators.every((creator) => typeof creator === "string") ||
    typeof row.summary !== "string" ||
    (row.cover_url !== null && typeof row.cover_url !== "string") ||
    typeof row.availability !== "string"
  ) {
    throw internal("推荐资源的数据格式不正确。");
  }

  return {
    id: row.id,
    slug: row.slug,
    type: row.type as ResourceType,
    title: row.title,
    creators: row.creators as string[],
    summary: row.summary,
    coverUrl: row.cover_url,
    availability: row.availability as Availability,
    tags: tagsFrom(row.resource_tags),
  };
}

async function recentSourceId(supabase: SupabaseClient) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;
  if (userError || !user) {
    throw new DiscoveryServiceError(
      "UNAUTHORIZED",
      "请先登录后从个人书架开始探索。",
    );
  }

  const { data, error } = await supabase
    .from("saved_resources")
    .select("resource_id")
    .eq("user_id", user.id)
    .order("saved_at", { ascending: false })
    .order("resource_id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw unavailable("无法读取最近收藏。");
  }
  if (!data) return null;
  if (typeof data.resource_id !== "string") {
    throw internal("最近收藏的数据格式不正确。");
  }
  return data.resource_id;
}

async function sourceResource(supabase: SupabaseClient, sourceId: string) {
  const { data, error } = await supabase
    .from("resources")
    .select(resourceListSelect)
    .eq("id", sourceId)
    .maybeSingle();
  if (error) {
    throw unavailable("无法读取探索起点资源。");
  }
  if (!data) {
    throw new DiscoveryServiceError(
      "RESOURCE_NOT_FOUND",
      "探索起点资源不存在。",
    );
  }
  return resourceFrom(data);
}

async function relationsByType(
  supabase: SupabaseClient,
  sourceId: string,
  relationType: Extract<RelationType, "unexpected_bridge" | "same_theme">,
) {
  const { data, error } = await supabase
    .from("resource_relations")
    .select("target_resource_id, relation_type, explanation, strength")
    .eq("source_resource_id", sourceId)
    .eq("relation_type", relationType)
    .neq("target_resource_id", sourceId)
    .order("strength", { ascending: false })
    .order("target_resource_id", { ascending: true })
    .limit(3);
  if (error) {
    throw unavailable("无法读取资源发现关系。");
  }
  if (!Array.isArray(data)) {
    throw internal("资源发现关系的数据格式不正确。");
  }

  const rows = data as RelationRow[];
  if (
    !rows.every(
      (row) =>
        typeof row.target_resource_id === "string" &&
        row.relation_type === relationType &&
        typeof row.explanation === "string" &&
        typeof row.strength === "number",
    )
  ) {
    throw internal("资源发现关系的数据格式不正确。");
  }
  return rows;
}

async function targetResources(
  supabase: SupabaseClient,
  relations: RelationRow[],
) {
  const targetIds = relations.map((relation) => relation.target_resource_id);
  const { data, error } = await supabase
    .from("resources")
    .select(resourceListSelect)
    .in("id", targetIds);
  if (error) {
    throw unavailable("无法读取推荐资源。");
  }
  if (!Array.isArray(data)) {
    throw internal("推荐资源的数据格式不正确。");
  }

  const resources = new Map(
    data.map((row) => {
      const resource = resourceFrom(row);
      return [resource.id, resource] as const;
    }),
  );

  return relations.map((relation) => {
    const resource = resources.get(relation.target_resource_id);
    if (!resource) {
      throw internal("资源发现关系引用了不可读取的资源。");
    }
    return {
      ...resource,
      relationType: relation.relation_type,
      explanation: relation.explanation,
      strength: relation.strength,
    };
  });
}

export async function getDiscovery(
  supabase: SupabaseClient,
  query: DiscoverQueryInput,
): Promise<DiscoveryData> {
  const sourceId =
    query.sourceResourceId ?? (await recentSourceId(supabase));
  if (!sourceId) {
    return { source: null, items: [], mode: "empty" };
  }

  const source = await sourceResource(supabase, sourceId);
  let mode: DiscoveryData["mode"] = "unexpected_bridge";
  let relations = await relationsByType(
    supabase,
    sourceId,
    "unexpected_bridge",
  );
  if (relations.length === 0) {
    mode = "same_theme";
    relations = await relationsByType(supabase, sourceId, "same_theme");
  }
  if (relations.length === 0) {
    return { source, items: [], mode: "empty" };
  }

  return {
    source,
    items: await targetResources(supabase, relations),
    mode,
  };
}
