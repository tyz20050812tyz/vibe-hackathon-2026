-- Support constellation inbound-edge reads without changing relation data.
-- Run after 202608220001_add_discovery_relation_index.sql.

create index if not exists resource_relations_target_strength_idx
  on public.resource_relations (target_resource_id, strength desc);
