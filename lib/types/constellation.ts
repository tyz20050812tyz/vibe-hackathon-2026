import type { ApiFailure, ApiSuccess } from "@/lib/types/api";
import type {
  RelationType,
  ResourceListItem,
} from "@/lib/types/resources";

export type ConstellationDepth = 1 | 2;

export type ConstellationNode = {
  resource: ResourceListItem;
  hop: 0 | 1 | 2;
  relationStrength: number | null;
  relationTypes: RelationType[];
  isSaved: boolean;
  affinity: number | null;
};

export type ConstellationEdge = {
  id: string;
  sourceResourceId: string;
  targetResourceId: string;
  relationType: RelationType;
  explanation: string;
  strength: number;
  direction: "outbound" | "inbound";
};

export type ConstellationData = {
  centerResourceId: string;
  nodes: ConstellationNode[];
  edges: ConstellationEdge[];
  hasMoreSecondHop: boolean;
  personalization: "profile" | "catalog";
};

export type ConstellationResponse =
  | ApiSuccess<ConstellationData>
  | ApiFailure;
