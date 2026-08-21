import { CatalogHeader } from "@/components/resources/catalog-header";
import { ResourceDetailClient } from "@/components/resources/resource-detail-client";

export default async function ResourcePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <div className="min-h-screen bg-[#fff8e9] text-[#172d29]"><CatalogHeader /><ResourceDetailClient slug={slug} /></div>;
}
