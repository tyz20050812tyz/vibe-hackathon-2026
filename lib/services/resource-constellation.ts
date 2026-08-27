import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createSupabaseAuthenticatedServerClient,
  createSupabasePublicServerClient,
} from "@/lib/supabase/server";
import type {
  ConstellationData,
  ConstellationEdge,
  ConstellationNode,
} from "@/lib/types/constellation";
import type {
  Availability,
  RelationType,
  ResourceLanguage,
  ResourceListItem,
  ResourceType,
  Tag,
  TagCategory,
} from "@/lib/types/resources";

export type ResourceConstellationErrorCode =
  | "CONFIGURATION_ERROR"
  | "RESOURCE_NOT_FOUND"
  | "SUPABASE_UNAVAILABLE"
  | "INTERNAL_ERROR";

export class ResourceConstellationError extends Error {
  constructor(
    public readonly code: ResourceConstellationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ResourceConstellationError";
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
  published_year: number | null;
  languages: ResourceLanguage[];
  summary: string;
  cover_url: string | null;
  availability: Availability;
  tags: unknown;
};

type RelationRow = {
  id: string;
  source_resource_id: string;
  target_resource_id: string;
  relation_type: RelationType;
  explanation: string;
  strength: number;
};

type RelationEndpointRow = Pick<
  RelationRow,
  "source_resource_id" | "target_resource_id"
>;

const resourceSelect =
  "id, slug, type, title, creators, published_year, languages, summary, cover_url, availability, tags:resource_tags(tag:tags(id, name, slug, category))";
const relationSelect =
  "id, source_resource_id, target_resource_id, relation_type, explanation, strength";
const relationTypeOrder: RelationType[] = [
  "same_theme",
  "contrasting_view",
  "historical_context",
  "unexpected_bridge",
];

function unavailable(message: string) {
  return new ResourceConstellationError("SUPABASE_UNAVAILABLE", message);
}

function invalidData(message: string) {
  return new ResourceConstellationError("INTERNAL_ERROR", message);
}

function publicClient(): SupabaseClient {
  try {
    return createSupabasePublicServerClient();
  } catch {
    throw new ResourceConstellationError(
      "CONFIGURATION_ERROR",
      "Supabase 星图公开读取配置不完整。",
    );
  }
}

function resourceFrom(row: ResourceRow): ResourceListItem {
  if (!Array.isArray(row.creators) ||
      !row.creators.every((creator) => typeof creator === "string") ||
      !Array.isArray(row.languages)) {
    throw invalidData("星图资源数据格式不正确。");
  }

  const links = Array.isArray(row.tags) ? row.tags : [];
  const tags = links.flatMap((link) => {
    const tag = (link as { tag?: TagRow | null }).tag;
    return tag ? [tag satisfies Tag] : [];
  });

  return {
    id: row.id,
    slug: row.slug,
    type: row.type,
    title: row.title,
    creators: row.creators,
    publishedYear: row.published_year,
    languages: row.languages,
    summary: row.summary,
    coverUrl: row.cover_url,
    availability: row.availability,
    tags,
  };
}

function affinity(tags: Tag[], interestIds: Set<string>) {
  if (!tags.length || !interestIds.size) return null;
  const overlap = tags.filter((tag) => interestIds.has(tag.id)).length;
  return (2 * overlap) / (tags.length + interestIds.size);
}

async function authenticatedMetadata(
  accessToken: string | undefined,
  resourceIds: string[],
): Promise<{
  savedIds: Set<string>;
  interestIds: Set<string> | null;
}> {
  if (!accessToken) return { savedIds: new Set(), interestIds: null };

  let supabase: SupabaseClient;
  try {
    supabase = createSupabaseAuthenticatedServerClient(accessToken);
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return { savedIds: new Set(), interestIds: null };
    }

    const userId = data.user.id;
    const [savedResult, completenessResult] = await Promise.all([
      supabase
        .from("saved_resources")
        .select("resource_id")
        .eq("user_id", userId)
        .in("resource_id", resourceIds),
      supabase.rpc("reader_profile_is_complete"),
    ]);

    if (savedResult.error) throw unavailable("无法读取星图收藏状态。");
    if (completenessResult.error) throw unavailable("无法读取星图阅读偏好。");

    const savedIds = new Set(
      (savedResult.data as Array<{ resource_id: string }> | null ?? [])
        .map((row) => row.resource_id),
    );
    if (completenessResult.data !== true) {
      return { savedIds, interestIds: null };
    }

    const { data: links, error: linksError } = await supabase
      .from("reader_profile_tags")
      .select("tag_id")
      .eq("user_id", userId);
    if (linksError) throw unavailable("无法读取星图兴趣标签。");

    return {
      savedIds,
      interestIds: new Set(
        (links as Array<{ tag_id: string }> | null ?? [])
          .map((row) => row.tag_id),
      ),
    };
  } catch (error) {
    if (error instanceof ResourceConstellationError) throw error;
    return { savedIds: new Set(), interestIds: null };
  }
}

async function hasSecondHop(
  supabase: SupabaseClient,
  centerId: string,
  neighborIds: string[],
) {
  if (!neighborIds.length) return false;

  const ids = neighborIds.join(",");
  const { data, error } = await supabase
    .from("resource_relations")
    .select("source_resource_id, target_resource_id")
    .or(`source_resource_id.in.(${ids}),target_resource_id.in.(${ids})`);
  if (error) throw unavailable("无法检查星图二跳候选。");

  const visibleIds = new Set([centerId, ...neighborIds]);
  return (data as RelationEndpointRow[] | null ?? []).some((relation) =>
    relation.source_resource_id !== relation.target_resource_id &&
    (!visibleIds.has(relation.source_resource_id) ||
      !visibleIds.has(relation.target_resource_id)),
  );
}

export async function getResourceConstellation(
  slug: string,
  accessToken?: string,
): Promise<ConstellationData> {
  const supabase = publicClient();
  const { data: centerData, error: centerError } = await supabase
    .from("resources")
    .select(resourceSelect)
    .eq("slug", slug)
    .maybeSingle();
  if (centerError) throw unavailable("无法读取星图中心资源。");
  if (!centerData) {
    throw new ResourceConstellationError(
      "RESOURCE_NOT_FOUND",
      "资源不存在。",
    );
  }

  const center = resourceFrom(centerData as ResourceRow);
  const [outboundResult, inboundResult] = await Promise.all([
    supabase
      .from("resource_relations")
      .select(relationSelect)
      .eq("source_resource_id", center.id),
    supabase
      .from("resource_relations")
      .select(relationSelect)
      .eq("target_resource_id", center.id),
  ]);
  if (outboundResult.error || inboundResult.error) {
    throw unavailable("无法读取星图资源关系。");
  }

  const relationById = new Map<string, RelationRow>();
  for (const relation of [
    ...(outboundResult.data as RelationRow[] | null ?? []),
    ...(inboundResult.data as RelationRow[] | null ?? []),
  ]) {
    if (relation.source_resource_id === relation.target_resource_id) continue;
    if (relation.source_resource_id !== center.id &&
        relation.target_resource_id !== center.id) continue;
    relationById.set(relation.id, relation);
  }

  const relationRows = [...relationById.values()];
  const neighborIds = [...new Set(relationRows.map((relation) =>
    relation.source_resource_id === center.id
      ? relation.target_resource_id
      : relation.source_resource_id,
  ))];

  let resources = new Map<string, ResourceListItem>();
  if (neighborIds.length) {
    const { data, error } = await supabase
      .from("resources")
      .select(resourceSelect)
      .in("id", neighborIds);
    if (error) throw unavailable("无法批量读取星图相邻资源。");
    resources = new Map(
      (data as ResourceRow[] | null ?? []).map((row) => {
        const resource = resourceFrom(row);
        return [resource.id, resource] as const;
      }),
    );
  }

  const edges: ConstellationEdge[] = relationRows.flatMap((relation) => {
    const neighborId = relation.source_resource_id === center.id
      ? relation.target_resource_id
      : relation.source_resource_id;
    if (!resources.has(neighborId)) return [];
    return [{
      id: relation.id,
      sourceResourceId: relation.source_resource_id,
      targetResourceId: relation.target_resource_id,
      relationType: relation.relation_type,
      explanation: relation.explanation,
      strength: relation.strength,
      direction: relation.source_resource_id === center.id
        ? "outbound"
        : "inbound",
    } satisfies ConstellationEdge];
  }).sort((left, right) =>
    right.strength - left.strength || left.id.localeCompare(right.id),
  );

  const visibleNeighborIds = [...new Set(edges.map((edge) =>
    edge.sourceResourceId === center.id
      ? edge.targetResourceId
      : edge.sourceResourceId,
  ))];
  const allResourceIds = [center.id, ...visibleNeighborIds];
  const [{ savedIds, interestIds }, moreSecondHop] = await Promise.all([
    authenticatedMetadata(accessToken, allResourceIds),
    hasSecondHop(supabase, center.id, visibleNeighborIds),
  ]);

  const nodes: ConstellationNode[] = [
    {
      resource: center,
      hop: 0,
      relationStrength: null,
      relationTypes: [],
      isSaved: savedIds.has(center.id),
      affinity: null,
    },
    ...visibleNeighborIds.flatMap((resourceId) => {
      const resource = resources.get(resourceId);
      if (!resource) return [];
      const directEdges = edges.filter((edge) =>
        edge.sourceResourceId === resourceId ||
        edge.targetResourceId === resourceId,
      );
      const presentTypes = new Set(
        directEdges.map((edge) => edge.relationType),
      );
      return [{
        resource,
        hop: 1 as const,
        relationStrength: Math.max(...directEdges.map((edge) => edge.strength)),
        relationTypes: relationTypeOrder.filter((type) => presentTypes.has(type)),
        isSaved: savedIds.has(resourceId),
        affinity: interestIds ? affinity(resource.tags, interestIds) : null,
      } satisfies ConstellationNode];
    }),
  ];
  nodes.sort((left, right) =>
    left.hop - right.hop ||
    (right.relationStrength ?? Number.POSITIVE_INFINITY) -
      (left.relationStrength ?? Number.POSITIVE_INFINITY) ||
    left.resource.id.localeCompare(right.resource.id),
  );

  return {
    centerResourceId: center.id,
    nodes,
    edges,
    hasMoreSecondHop: moreSecondHop,
    personalization: interestIds ? "profile" : "catalog",
  };
}
