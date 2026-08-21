import type { ApiFailure, ApiSuccess } from "@/lib/types/api";

export type ResourceType = "book" | "paper" | "talk" | "collection";

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
  type?: ResourceType;
  limit?: number;
};

export type SearchResourcesData = {
  items: ResourceListItem[];
  total: number;
  appliedFilters: {
    q: string;
    tag: string | null;
    type: ResourceType | null;
  };
};

export type GetResourceData = {
  resource: Resource;
  related: ResourceListItem[];
};

export type CreateSavedResourceRequest = {
  resourceId: string;
  note?: string;
};

export type SearchResourcesResponse = ApiSuccess<SearchResourcesData> | ApiFailure;
export type GetResourceResponse = ApiSuccess<GetResourceData> | ApiFailure;
export type ListSavedResourcesResponse = ApiSuccess<SavedResource[]> | ApiFailure;
export type CreateSavedResourceResponse = ApiSuccess<SavedResource> | ApiFailure;
