import type { ApiFailure, ApiSuccess } from "@/lib/types/api";

export type ResourceType = "book" | "paper" | "talk" | "collection";
export type ResourceLanguage = "zh" | "en" | "other";
export type SearchSort = "catalog" | "personalized";
export type ExplorationLevel = "gentle" | "balanced" | "bold";
export type DiscoveryMode = "extend" | "challenge" | "context" | "surprise";

export type Availability =
  | "available"
  | "online"
  | "reference_only"
  | "check_library";

export type TagCategory = "discipline" | "theme" | "format";

export type RelationType =
  | "same_theme"
  | "contrasting_view"
  | "historical_context"
  | "unexpected_bridge";

export type Tag = {
  id: string;
  name: string;
  slug: string;
  category: TagCategory;
};

export type Resource = {
  id: string;
  slug: string;
  type: ResourceType;
  title: string;
  subtitle: string | null;
  creators: string[];
  publishedYear: number | null;
  languages: ResourceLanguage[];
  summary: string;
  coverUrl: string | null;
  location: string | null;
  availability: Availability;
  externalUrl: string | null;
  tags: Tag[];
  isFeatured: boolean;
};

export type ResourceListItem = Pick<
  Resource,
  | "id"
  | "slug"
  | "type"
  | "title"
  | "creators"
  | "publishedYear"
  | "languages"
  | "summary"
  | "coverUrl"
  | "availability"
  | "tags"
>;

export type ResourceRelation = {
  id: string;
  sourceResourceId: string;
  targetResourceId: string;
  relationType: RelationType;
  explanation: string;
  strength: number;
};

export type SavedResource = {
  resource: ResourceListItem;
  note: string | null;
  savedAt: string;
};

export type SearchResourcesQuery = {
  q?: string;
  tag?: string;
  languages?: ResourceLanguage[];
  yearFrom?: number;
  yearTo?: number;
  types?: ResourceType[];
  availabilities?: Availability[];
  sort?: SearchSort;
  limit?: number;
};

export type SearchResourcesData = {
  items: ResourceListItem[];
  total: number;
  appliedFilters: {
    q: string;
    tag: string | null;
    languages: ResourceLanguage[];
    yearFrom: number | null;
    yearTo: number | null;
    types: ResourceType[];
    availabilities: Availability[];
  };
  appliedSort: SearchSort;
  personalization: "profile" | "catalog";
};

export type GetResourceData = {
  resource: Resource;
  related: ResourceListItem[];
};

export type CreateSavedResourceRequest = {
  resourceId: string;
  note?: string;
};

export type ReadingProfile = {
  explorationLevel: ExplorationLevel;
  interestTags: Tag[];
  favoriteBooks: Array<{ id: string; title: string; author: string | null }>;
  onboardingCompletedAt: string;
};

export type ReadingProfileData =
  | { status: "incomplete"; preferences: null }
  | { status: "complete"; preferences: ReadingProfile };

export type ReplaceReadingProfileRequest = {
  interestTagIds: string[];
  explorationLevel: ExplorationLevel;
  favoriteBooks?: Array<{ title: string; author?: string }>;
  consent: true;
};

export type ClearReadingProfileData = {
  cleared: true;
};

export type DiscoverRequest = {
  originResourceId: string;
  mode?: DiscoveryMode;
  excludeResourceIds?: string[];
  discoveryContext?: string;
};

export type DiscoveryContextPayload = {
  version: 1;
  originSlug: string;
  filters: Pick<
    SearchResourcesQuery,
    | "tag"
    | "languages"
    | "yearFrom"
    | "yearTo"
    | "types"
    | "availabilities"
  >;
  issuedAt: number;
  expiresAt: number;
};

export type DiscoverRecommendation = {
  resource: ResourceListItem;
  relationExplanation: string;
  narration: string;
  narrationSource: "template" | "deepseek";
};

export type DiscoverData = {
  originResourceId: string;
  selectedMode: DiscoveryMode;
  usedRelationType: RelationType | null;
  constrainedBySourceFilters: boolean;
  personalization: "profile" | "catalog";
  recommendation: DiscoverRecommendation | null;
};

export type SearchResourcesResponse = ApiSuccess<SearchResourcesData> | ApiFailure;
export type GetResourceResponse = ApiSuccess<GetResourceData> | ApiFailure;
export type ListSavedResourcesResponse = ApiSuccess<SavedResource[]> | ApiFailure;
export type CreateSavedResourceResponse = ApiSuccess<SavedResource> | ApiFailure;
export type DeleteSavedResourceResponse =
  | ApiSuccess<{ resourceId: string }>
  | ApiFailure;
export type ReadingProfileResponse = ApiSuccess<ReadingProfileData> | ApiFailure;
export type ClearReadingProfileResponse =
  | ApiSuccess<ClearReadingProfileData>
  | ApiFailure;
export type DiscoverResponse = ApiSuccess<DiscoverData> | ApiFailure;
