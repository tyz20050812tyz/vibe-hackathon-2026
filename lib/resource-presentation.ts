import type { Availability, ResourceType } from "@/lib/types/resources";

const resourceTypeLabels: Record<ResourceType, string> = {
  book: "馆藏图书",
  paper: "研究论文",
  talk: "讲座",
  collection: "策展专题",
};

const availabilityLabels: Record<Availability, string> = {
  online: "可在线阅读",
  available: "馆内可读（演示状态）",
  reference_only: "仅供参考（演示状态）",
  check_library: "馆藏待查（演示状态）",
};

export function resourceTypeLabel(type: ResourceType) {
  return resourceTypeLabels[type];
}

export function availabilityLabel(availability: Availability) {
  return availabilityLabels[availability];
}
