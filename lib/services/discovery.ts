import type { SupabaseClient } from "@supabase/supabase-js";

import { readDiscoveryContext } from "@/lib/discovery-context";
import type { DiscoverRequestInput } from "@/lib/schemas/resources";
import {
  createSupabaseAuthenticatedServerClient,
  createSupabasePublicServerClient,
} from "@/lib/supabase/server";
import type {
  DiscoverData,
  RelationType,
  ResourceListItem,
  ResourceType,
  Tag,
  TagCategory,
} from "@/lib/types/resources";

export class DiscoveryError extends Error {
  constructor(
    public readonly code:
      | "CONFIGURATION_ERROR"
      | "SUPABASE_UNAVAILABLE"
      | "RESOURCE_NOT_FOUND"
      | "INVALID_DISCOVERY_CONTEXT",
    message: string,
  ) {
    super(message);
    this.name = "DiscoveryError";
  }
}

type ResourceRow = {
  id: string;
  slug: string;
  type: ResourceType;
  title: string;
  creators: unknown;
  published_year: number | null;
  languages: Array<"zh" | "en" | "other">;
  summary: string;
  cover_url: string | null;
  availability: "available" | "online" | "reference_only" | "check_library";
  tags: unknown;
};
type RelationRow = {
  id: string;
  relation_type: RelationType;
  explanation: string;
  strength: number;
  target: ResourceRow | null;
};
type TagRow = { id: string; name: string; slug: string; category: TagCategory };
type Preference = { level: "gentle" | "balanced" | "bold"; ids: Set<string> };

const relationTypesByMode: Record<DiscoverRequestInput["mode"], RelationType[]> = {
  extend: ["same_theme"],
  challenge: ["contrasting_view"],
  context: ["historical_context"],
  surprise: ["unexpected_bridge", "contrasting_view", "historical_context", "same_theme"],
};

function publicClient(): SupabaseClient {
  try {
    return createSupabasePublicServerClient();
  } catch {
    throw new DiscoveryError("CONFIGURATION_ERROR", "发现服务配置不完整。");
  }
}

async function authenticatedClient(accessToken?: string): Promise<{
  supabase: SupabaseClient;
  userId: string | null;
}> {
  if (!accessToken) return { supabase: publicClient(), userId: null };

  try {
    const supabase = createSupabaseAuthenticatedServerClient(accessToken);
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) return { supabase, userId: data.user.id };
  } catch {
    // A malformed token must not turn a public discovery request into a failure.
  }

  return { supabase: publicClient(), userId: null };
}

function item(row: ResourceRow): ResourceListItem {
  const tags = Array.isArray(row.tags)
    ? (row.tags as Array<{ tag: TagRow | null }>).flatMap(({ tag }) => tag ? [tag] : [])
    : [];

  return {
    id: row.id,
    slug: row.slug,
    type: row.type,
    title: row.title,
    creators: Array.isArray(row.creators) ? row.creators.filter((creator): creator is string => typeof creator === "string") : [],
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

function affinityRank(value: number, level: Preference["level"]) {
  if (level === "gentle") return -value;
  if (level === "balanced") return Math.abs(value - 0.5);
  return Math.abs(value - 0.2);
}

function meetsContext(
  resource: ResourceListItem,
  filters: NonNullable<ReturnType<typeof readDiscoveryContext>>["filters"],
) {
  return (!filters.tag || resource.tags.some((tag) => tag.slug === filters.tag))
    && (!filters.languages?.length || resource.languages.some((language) => filters.languages?.includes(language)))
    && (!filters.yearFrom || (resource.publishedYear !== null && resource.publishedYear >= filters.yearFrom))
    && (!filters.yearTo || (resource.publishedYear !== null && resource.publishedYear <= filters.yearTo))
    && (!filters.types?.length || filters.types.includes(resource.type))
    && (!filters.availabilities?.length || filters.availabilities.includes(resource.availability));
}

async function preferenceFor(supabase: SupabaseClient, userId: string | null): Promise<Preference | null> {
  if (!userId) return null;
  const { data: profileIsComplete, error: completenessError } = await supabase
    .rpc("reader_profile_is_complete");
  if (completenessError) throw new DiscoveryError("SUPABASE_UNAVAILABLE", "无法读取阅读偏好。");
  if (profileIsComplete !== true) return null;

  const { data: profile, error: profileError } = await supabase
    .from("reader_profiles")
    .select("exploration_level, onboarding_completed_at")
    .eq("user_id", userId)
    .not("onboarding_completed_at", "is", null)
    .maybeSingle();
  if (profileError) throw new DiscoveryError("SUPABASE_UNAVAILABLE", "无法读取阅读偏好。");
  if (!profile) throw new DiscoveryError("SUPABASE_UNAVAILABLE", "无法读取阅读偏好。");

  const { data: links, error: linksError } = await supabase
    .from("reader_profile_tags")
    .select("tag_id")
    .eq("user_id", userId);
  if (linksError) throw new DiscoveryError("SUPABASE_UNAVAILABLE", "无法读取阅读偏好。");

  const ids = new Set((links ?? []).map((link) => link.tag_id));
  return { level: profile.exploration_level as Preference["level"], ids };
}

export async function discover(
  input: DiscoverRequestInput,
  accessToken?: string,
): Promise<DiscoverData> {
  const { supabase, userId } = await authenticatedClient(accessToken);
  const { data: origin, error: originError } = await supabase
    .from("resources")
    .select("id, slug")
    .eq("id", input.originResourceId)
    .maybeSingle();
  if (originError) throw new DiscoveryError("SUPABASE_UNAVAILABLE", "无法读取发现起点。");
  if (!origin) throw new DiscoveryError("RESOURCE_NOT_FOUND", "起点资源不存在。");

  const context = input.discoveryContext
    ? readDiscoveryContext(input.discoveryContext, origin.slug)
    : undefined;
  if (input.discoveryContext && !context) {
    throw new DiscoveryError("INVALID_DISCOVERY_CONTEXT", "当前筛选上下文已失效，请改为自由偏离。");
  }

  const { data, error } = await supabase
    .from("resource_relations")
    .select("id, relation_type, explanation, strength, target:resources!resource_relations_target_resource_id_fkey(id, slug, type, title, creators, published_year, languages, summary, cover_url, availability, tags:resource_tags(tag:tags(id, name, slug, category)))")
    .eq("source_resource_id", origin.id);
  if (error) throw new DiscoveryError("SUPABASE_UNAVAILABLE", "无法读取资源关系。");

  const preference = await preferenceFor(supabase, userId);
  const excluded = new Set(input.excludeResourceIds ?? []);
  const candidates = (data as unknown as RelationRow[]).flatMap((relation) => {
    if (!relation.target || relation.target.id === origin.id || excluded.has(relation.target.id)) return [];
    const target = item(relation.target);
    return context && !meetsContext(target, context.filters) ? [] : [{ relation, target }];
  });

  let selected: { relation: RelationRow; target: ResourceListItem } | undefined;
  for (const relationType of relationTypesByMode[input.mode]) {
    const pool = candidates.filter((candidate) => candidate.relation.relation_type === relationType);
    pool.sort((left, right) => {
      if (left.relation.strength !== right.relation.strength) return right.relation.strength - left.relation.strength;
      if (preference) {
        const leftAffinity = affinity(left.target.tags, preference.ids);
        const rightAffinity = affinity(right.target.tags, preference.ids);
        if (leftAffinity !== null && rightAffinity !== null) {
          const difference = affinityRank(leftAffinity, preference.level) - affinityRank(rightAffinity, preference.level);
          if (difference !== 0) return difference;
        }
      }
      return left.relation.id.localeCompare(right.relation.id);
    });
    if (pool.length) {
      selected = pool[0];
      break;
    }
  }

  return {
    originResourceId: origin.id,
    selectedMode: input.mode,
    usedRelationType: selected?.relation.relation_type ?? null,
    constrainedBySourceFilters: Boolean(context),
    personalization: preference ? "profile" : "catalog",
    recommendation: selected ? {
      resource: selected.target,
      relationExplanation: selected.relation.explanation,
      narration: selected.relation.explanation,
      narrationSource: "template",
    } : null,
  };
}
