import type { ApiFailure, ApiSuccess } from "@/lib/types/api";
import type { RelationType, ResourceListItem } from "@/lib/types/resources";

export type DiscoveryItem = ResourceListItem & {
  relationType: RelationType;
  explanation: string;
  strength: number;
};

export type DiscoveryData = {
  source: ResourceListItem | null;
  items: DiscoveryItem[];
  mode: "unexpected_bridge" | "same_theme" | "empty";
};

export type DiscoveryResponse = ApiSuccess<DiscoveryData> | ApiFailure;
