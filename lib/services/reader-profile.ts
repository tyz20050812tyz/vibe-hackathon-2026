import type { SupabaseClient } from "@supabase/supabase-js";

import type { ReplaceReadingProfileInput } from "@/lib/schemas/resources";
import { createSupabaseAuthenticatedServerClient } from "@/lib/supabase/server";
import type { ReadingProfileData, Tag, TagCategory } from "@/lib/types/resources";

export type ReadingProfileErrorCode =
  | "CONFIGURATION_ERROR"
  | "SUPABASE_UNAVAILABLE"
  | "UNAUTHORIZED"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export class ReadingProfileError extends Error {
  constructor(public readonly code: ReadingProfileErrorCode, message: string) {
    super(message);
    this.name = "ReadingProfileError";
  }
}

type TagRow = { id: string; name: string; slug: string; category: TagCategory };
type ProfileRow = { exploration_level: "gentle" | "balanced" | "bold"; onboarding_completed_at: string };
type FavoriteBookRow = { id: string; title: string; author: string | null };

function client(accessToken: string): SupabaseClient {
  try { return createSupabaseAuthenticatedServerClient(accessToken); } catch {
    throw new ReadingProfileError("CONFIGURATION_ERROR", "阅读偏好服务配置不完整。");
  }
}

async function userId(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new ReadingProfileError("UNAUTHORIZED", "登录已失效，请重新登录。");
  return data.user.id;
}

function unavailable(message: string) { return new ReadingProfileError("SUPABASE_UNAVAILABLE", message); }

export async function getReadingProfile(accessToken: string): Promise<ReadingProfileData> {
  const supabase = client(accessToken);
  const id = await userId(supabase);
  const { data: profileIsComplete, error: completenessError } = await supabase
    .rpc("reader_profile_is_complete");
  if (completenessError) throw unavailable("无法读取阅读偏好。");
  if (profileIsComplete !== true) return { status: "incomplete", preferences: null };

  const { data: profile, error: profileError } = await supabase
    .from("reader_profiles")
    .select("exploration_level, onboarding_completed_at")
    .eq("user_id", id)
    .maybeSingle();
  if (profileError) throw unavailable("无法读取阅读偏好。");
  if (!profile) throw new ReadingProfileError("INTERNAL_ERROR", "阅读偏好完整状态与记录不一致。");

  const { data: links, error: linksError } = await supabase
    .from("reader_profile_tags")
    .select("tag:tags(id, name, slug, category)")
    .eq("user_id", id);
  const { data: books, error: booksError } = await supabase
    .from("reader_profile_favorite_books")
    .select("id, title, author")
    .eq("user_id", id)
    .order("created_at", { ascending: true });
  if (linksError || booksError) throw unavailable("无法读取阅读偏好详情。");
  const interestTags = (links as unknown as Array<{ tag: TagRow | null }>).flatMap(({ tag }) => tag ? [{ id: tag.id, name: tag.name, slug: tag.slug, category: tag.category } satisfies Tag] : []);
  return {
    status: "complete",
    preferences: {
      explorationLevel: (profile as ProfileRow).exploration_level,
      onboardingCompletedAt: (profile as ProfileRow).onboarding_completed_at,
      interestTags,
      favoriteBooks: books as FavoriteBookRow[],
    },
  };
}

export async function replaceReadingProfile(accessToken: string, input: ReplaceReadingProfileInput) {
  const supabase = client(accessToken);
  await userId(supabase);
  const { error } = await supabase.rpc("replace_reader_profile", {
    p_interest_tag_ids: input.interestTagIds,
    p_exploration_level: input.explorationLevel,
    p_favorite_books: input.favoriteBooks ?? [],
    p_consent: input.consent,
  });
  if (error) {
    if (/INVALID|DUPLICATE|CONSENT|TOO_MANY/.test(error.message)) {
      throw new ReadingProfileError("VALIDATION_ERROR", "阅读偏好内容不合法。");
    }
    throw unavailable("无法保存阅读偏好。");
  }
  return getReadingProfile(accessToken);
}

export async function clearReadingProfile(accessToken: string) {
  const supabase = client(accessToken);
  await userId(supabase);
  const { error } = await supabase.rpc("clear_reader_profile");
  if (error) throw unavailable("无法清空阅读偏好。");
  return { cleared: true };
}
