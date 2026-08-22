import type { ApiFailure, ApiSuccess } from "@/lib/types/api";

export type ReaderProfile = {
  id: string;
  displayName: string | null;
  email: string;
  joinedAt: string | null;
};

export type LibraryStats = {
  savedCount: number;
  notedCount: number;
  topicCount: number;
  latestSavedAt: string | null;
};

export type ProfileOverview = {
  profile: ReaderProfile;
  stats: LibraryStats;
};

export type ProfileUpdateRequest = { displayName: string };

export type ProfileOverviewResponse = ApiSuccess<ProfileOverview> | ApiFailure;
