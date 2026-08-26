-- Support deterministic discovery lookups by source, relation type, and strength.
-- Run after 20260821_create_library_foundation.sql.

create index if not exists resource_relations_source_type_strength_idx
  on public.resource_relations (
    source_resource_id,
    relation_type,
    strength desc
  );
