import { notFound } from "next/navigation";

import { DemoRecordsTemplate } from "@/components/demo-records-template";
import { listDemoRecords } from "@/lib/services/demo-records";

export const dynamic = "force-dynamic";

async function getInitialRecords() {
  try {
    return {
      records: await listDemoRecords(),
      error: null,
    };
  } catch {
    return {
      records: [],
      error: "无法读取演练记录。请先执行 Supabase 迁移 SQL。",
    };
  }
}

export default async function DemoRecordsPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { records, error } = await getInitialRecords();
  return <DemoRecordsTemplate initialRecords={records} initialError={error} />;
}
