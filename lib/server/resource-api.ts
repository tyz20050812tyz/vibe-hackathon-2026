import { searchResources } from "@/lib/services/resource-catalog";
import { searchResourcesQuerySchema } from "@/lib/schemas/resources";
import type { SearchResourcesQuery } from "@/lib/types/resources";

export async function searchResourceCatalog(query: SearchResourcesQuery = {}) {
  try {
    const parsed = searchResourcesQuerySchema.safeParse(query);
    if (!parsed.success) return { data: null, error: parsed.error.issues[0]?.message ?? "搜索条件不合法。" };
    return { data: await searchResources(parsed.data), error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "资源目录暂时无法读取，请稍后重试。",
    };
  }
}
