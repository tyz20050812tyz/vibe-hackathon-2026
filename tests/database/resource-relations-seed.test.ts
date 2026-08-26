import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const seed = readFileSync(
  fileURLToPath(new URL("../../supabase/seed/resources-v2-relations.sql", import.meta.url)),
  "utf8",
);
const foundationSeed = readFileSync(
  fileURLToPath(new URL("../../supabase/seed/resources-v1.sql", import.meta.url)),
  "utf8",
);

const relationPattern = /\(\s*'([a-z0-9-]+)',\s*'([a-z0-9-]+)',\s*'(same_theme|contrasting_view|historical_context|unexpected_bridge)'/g;
const additionalRelationSources = [...seed.matchAll(relationPattern)]
  .map(([, source, target, relationType]) => ({ source, target, relationType }));
const allRelations = [...foundationSeed.matchAll(relationPattern), ...seed.matchAll(relationPattern)]
  .map(([, source, target, relationType]) => ({ source, target, relationType }));

const catalogResources = [
  "the-creative-act", "the-age-of-ai", "how-to-create-a-mind", "the-creative-mind",
  "ways-of-seeing", "the-design-of-everyday-things", "the-image-of-the-city",
  "the-practice-of-everyday-life", "invisible-cities", "on-photography", "the-arcades-project",
  "the-library-of-babel", "the-order-of-things", "the-organization-of-knowledge",
  "the-pleasures-of-counting", "the-myth-of-sisyphus", "the-art-of-noticing", "generative-art",
  "cities-and-memory", "happy-accidents",
];
const featuredResources = [
  "the-creative-act", "the-age-of-ai", "the-creative-mind", "ways-of-seeing",
  "the-image-of-the-city", "invisible-cities", "the-library-of-babel", "the-art-of-noticing",
  "generative-art", "cities-and-memory", "happy-accidents",
];

describe("resource relation coverage seed", () => {
  it("adds at least the audited 33 unique curated relations", () => {
    const keys = new Set(additionalRelationSources.map(({ source, target, relationType }) => `${source}:${target}:${relationType}`));
    expect(keys.size).toBe(additionalRelationSources.length);
    expect(keys.size).toBeGreaterThanOrEqual(33);
  });

  it("provides three outgoing additions for each catalog resource missing from the original seed", () => {
    const counts = new Map<string, number>();
    additionalRelationSources.forEach(({ source }) => counts.set(source, (counts.get(source) ?? 0) + 1));
    expect([...counts.values()]).toHaveLength(17);
    expect([...counts.values()].every((count) => count >= 3)).toBe(true);
  });

  it("leaves every catalog resource discoverable and every featured entry point with three paths", () => {
    const counts = new Map<string, number>();
    allRelations.forEach(({ source }) => counts.set(source, (counts.get(source) ?? 0) + 1));
    catalogResources.forEach((slug) => expect(counts.get(slug) ?? 0).toBeGreaterThanOrEqual(1));
    featuredResources.forEach((slug) => expect(counts.get(slug) ?? 0).toBeGreaterThanOrEqual(3));
  });

  it("ships a zero-row SQL audit for public and featured coverage thresholds", () => {
    expect(seed).toContain("outgoing_relation_count < case when is_featured then 3 else 1 end");
    expect(seed).toContain("left join public.resource_relations relation");
  });
});
