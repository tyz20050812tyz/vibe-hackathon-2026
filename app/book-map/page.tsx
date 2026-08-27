import { CatalogHeader } from "@/components/resources/catalog-header";
import { BookMapClient } from "@/components/resources/book-map-client";

export default function BookMapPage() {
  return <div className="min-h-screen bg-[#fff8e9] text-[#172d29]"><CatalogHeader /><BookMapClient /></div>;
}
