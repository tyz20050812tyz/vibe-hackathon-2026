import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAuthenticatedServerClient } from "@/lib/supabase/server";
import type { CreateSavedResourceInput } from "@/lib/schemas/resources";
import type { Availability, ResourceListItem, ResourceType, SavedResource, TagCategory } from "@/lib/types/resources";

export type PersonalLibraryErrorCode = "CONFIGURATION_ERROR" | "SUPABASE_UNAVAILABLE" | "UNAUTHORIZED" | "ALREADY_SAVED" | "INTERNAL_ERROR";

export class PersonalLibraryError extends Error {
  constructor(public readonly code: PersonalLibraryErrorCode, message: string) {
    super(message);
    this.name = "PersonalLibraryError";
  }
}

type SavedRow = { note: string | null; saved_at: string; resource: unknown };
type ResourceRow = { id: string; slug: string; type: ResourceType; title: string; creators: unknown; summary: string; cover_url: string | null; availability: Availability; resource_tags: unknown };
type TagRow = { id: string; name: string; slug: string; category: TagCategory };

function client(accessToken: string): SupabaseClient {
  try {
    return createSupabaseAuthenticatedServerClient(accessToken);
  } catch {
    throw new PersonalLibraryError("CONFIGURATION_ERROR", "Supabase 用户服务配置不完整。");
  }
}

function unavailable(message: string) { return new PersonalLibraryError("SUPABASE_UNAVAILABLE", message); }
function internal(message: string) { return new PersonalLibraryError("INTERNAL_ERROR", message); }

async function userId(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new PersonalLibraryError("UNAUTHORIZED", "登录已失效，请重新登录。");
  return data.user.id;
}

function resourceFrom(value: unknown): ResourceListItem {
  const row = value as ResourceRow;
  if (!row || !Array.isArray(row.creators) || !Array.isArray(row.resource_tags)) throw internal("收藏资源的数据格式不正确。");
  const tags = row.resource_tags.flatMap((link) => {
    const tag = (link as { tag?: unknown }).tag as TagRow | null;
    return tag ? [{ id: tag.id, name: tag.name, slug: tag.slug, category: tag.category }] : [];
  });
  return { id: row.id, slug: row.slug, type: row.type, title: row.title, creators: row.creators as string[], summary: row.summary, coverUrl: row.cover_url, availability: row.availability, tags };
}

const savedSelect = "note, saved_at, resource:resources(id, slug, type, title, creators, summary, cover_url, availability, resource_tags(tag:tags(id, name, slug, category)))";

export async function listSavedResources(accessToken: string): Promise<SavedResource[]> {
  const supabase = client(accessToken);
  const id = await userId(supabase);
  const { data, error } = await supabase.from("saved_resources").select(savedSelect).eq("user_id", id).order("saved_at", { ascending: false });
  if (error) throw unavailable("无法读取个人书架。");
  return (data as SavedRow[]).map((row) => ({ resource: resourceFrom(row.resource), note: row.note, savedAt: row.saved_at }));
}

export async function saveResource(accessToken: string, input: CreateSavedResourceInput): Promise<SavedResource> {
  const supabase = client(accessToken);
  const id = await userId(supabase);
  const { error } = await supabase.from("saved_resources").insert({ user_id: id, resource_id: input.resourceId, note: input.note ?? null });
  if (error?.code === "23505") throw new PersonalLibraryError("ALREADY_SAVED", "这项资源已在你的书架中。");
  if (error) throw unavailable("无法保存到个人书架。");
  const saved = await listSavedResources(accessToken);
  const resource = saved.find((item) => item.resource.id === input.resourceId);
  if (!resource) throw internal("收藏已保存，但无法读取资源详情。");
  return resource;
}

export async function removeSavedResource(accessToken: string, resourceId: string) {
  const supabase = client(accessToken);
  const id = await userId(supabase);
  const { error } = await supabase.from("saved_resources").delete().eq("user_id", id).eq("resource_id", resourceId);
  if (error) throw unavailable("无法从个人书架移除资源。");
  return { resourceId };
}
