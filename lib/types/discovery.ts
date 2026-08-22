import type {
  RelationType,
  ResourceListItem,
} from "@/lib/types/resources";

export type DiscoveryData = {
  source: ResourceListItem | null;
  items: Array<
    ResourceListItem & {
      relationType: RelationType;
      explanation: string;
      strength: number;
    }
  >;
  mode: "unexpected_bridge" | "same_theme" | "empty";
};
