import { CatalogHeader } from "@/components/resources/catalog-header";
import { BookMapClient } from "@/components/resources/book-map-client";

export default async function ConstellationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <div className="min-h-screen bg-[#fff8e9] text-[#172d29]"><CatalogHeader /><BookMapClient initialSlug={slug} /></div>;
}
