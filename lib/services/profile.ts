import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { ProfileUpdateInput } from "@/lib/schemas/profile";
import type { ApiErrorCode } from "@/lib/types/api";
import type { ProfileOverview } from "@/lib/types/profile";

type ProfileServiceErrorCode = Extract<
  ApiErrorCode,
  "UNAUTHORIZED" | "SUPABASE_UNAVAILABLE" | "INTERNAL_ERROR"
>;

export class ProfileServiceError extends Error {
  constructor(
    public readonly code: ProfileServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProfileServiceError";
  }
}

type ProfileRow = {
  id: string;
  display_name: string | null;
};

type SavedResourceStatsRow = {
  resource_id: string;
  note: string | null;
  saved_at: string;
};

type ResourceTagStatsRow = {
  tag_id: string;
};

type EnsuredProfile = {
  user: User;
  profile: ProfileOverview["profile"];
};

function unavailable(message: string) {
  return new ProfileServiceError("SUPABASE_UNAVAILABLE", message);
}

function internal(message: string) {
  return new ProfileServiceError("INTERNAL_ERROR", message);
}

function defaultDisplayName(email: string) {
  return email.split("@", 1)[0].slice(0, 50);
}

function profileFromRow(row: unknown, user: User): ProfileOverview["profile"] {
  const profile = row as Partial<ProfileRow> | null;
  if (
    !profile ||
    typeof profile.id !== "string" ||
    (profile.display_name !== null &&
      typeof profile.display_name !== "string") ||
    !user.email
  ) {
    throw internal("用户资料的数据格式不正确。");
  }

  return {
    id: profile.id,
    displayName: profile.display_name,
    email: user.email,
    joinedAt: typeof user.created_at === "string" ? user.created_at : null,
  };
}

export async function ensureProfile(
  supabase: SupabaseClient,
): Promise<EnsuredProfile> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;
  if (userError || !user) {
    throw new ProfileServiceError("UNAUTHORIZED", "请先登录后查看个人资料。");
  }
  if (!user.email) {
    throw internal("当前账号缺少邮箱资料。");
  }

  const { error: insertError } = await supabase
    .from("profiles")
    .upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });
  if (insertError) {
    throw unavailable("无法初始化用户资料。");
  }

  const { error: defaultNameError } = await supabase
    .from("profiles")
    .update({ display_name: defaultDisplayName(user.email) })
    .eq("id", user.id)
    .is("display_name", null);
  if (defaultNameError) {
    throw unavailable("无法初始化用户显示名。");
  }

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    throw unavailable("无法读取用户资料。");
  }
  if (!profileData) {
    throw internal("用户资料初始化后仍无法读取。");
  }

  return {
    user,
    profile: profileFromRow(profileData, user),
  };
}

async function profileStats(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileOverview["stats"]> {
  const { data: savedData, error: savedError } = await supabase
    .from("saved_resources")
    .select("resource_id, note, saved_at")
    .eq("user_id", userId)
    .order("saved_at", { ascending: false });
  if (savedError) {
    throw unavailable("无法读取个人书架统计。");
  }
  if (!Array.isArray(savedData)) {
    throw internal("个人书架统计的数据格式不正确。");
  }

  const savedRows = savedData as SavedResourceStatsRow[];
  if (
    !savedRows.every(
      (row) =>
        typeof row.resource_id === "string" &&
        (row.note === null || typeof row.note === "string") &&
        typeof row.saved_at === "string",
    )
  ) {
    throw internal("个人书架统计的数据格式不正确。");
  }

  const resourceIds = [...new Set(savedRows.map((row) => row.resource_id))];
  let topicCount = 0;
  if (resourceIds.length > 0) {
    const { data: tagData, error: tagError } = await supabase
      .from("resource_tags")
      .select("tag_id")
      .in("resource_id", resourceIds);
    if (tagError) {
      throw unavailable("无法读取收藏主题统计。");
    }
    if (
      !Array.isArray(tagData) ||
      !(tagData as ResourceTagStatsRow[]).every(
        (row) => typeof row.tag_id === "string",
      )
    ) {
      throw internal("收藏主题统计的数据格式不正确。");
    }
    topicCount = new Set(
      (tagData as ResourceTagStatsRow[]).map((row) => row.tag_id),
    ).size;
  }

  return {
    savedCount: savedRows.length,
    notedCount: savedRows.filter(
      (row) => row.note !== null && row.note.trim().length > 0,
    ).length,
    topicCount,
    latestSavedAt: savedRows[0]?.saved_at ?? null,
  };
}

export async function getProfileOverview(
  supabase: SupabaseClient,
): Promise<ProfileOverview> {
  const ensured = await ensureProfile(supabase);
  return {
    profile: ensured.profile,
    stats: await profileStats(supabase, ensured.user.id),
  };
}

export async function updateProfile(
  supabase: SupabaseClient,
  input: ProfileUpdateInput,
): Promise<ProfileOverview> {
  const ensured = await ensureProfile(supabase);
  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name: input.displayName })
    .eq("id", ensured.user.id)
    .select("id, display_name")
    .maybeSingle();
  if (error) {
    throw unavailable("无法更新用户资料。");
  }
  if (!data) {
    throw internal("用户资料更新后无法读取。");
  }

  return {
    profile: profileFromRow(data, ensured.user),
    stats: await profileStats(supabase, ensured.user.id),
  };
}
