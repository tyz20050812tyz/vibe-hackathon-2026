import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DemoRecord } from "@/lib/types/api";

type DemoRecordRow = {
  id: string;
  content: string;
  created_at: string;
};

function toDemoRecord(row: DemoRecordRow): DemoRecord {
  return {
    id: row.id,
    content: row.content,
    createdAt: row.created_at,
  };
}

export async function listDemoRecords(): Promise<DemoRecord[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("demo_records")
    .select("id, content, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw error;
  }

  return (data as DemoRecordRow[]).map(toDemoRecord);
}

export async function createDemoRecord(content: string): Promise<DemoRecord> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("demo_records")
    .insert({ content })
    .select("id, content, created_at")
    .single();

  if (error) {
    throw error;
  }

  return toDemoRecord(data as DemoRecordRow);
}
