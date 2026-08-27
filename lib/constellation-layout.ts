import type { ConstellationNode } from "@/lib/types/constellation";

export type ConstellationPosition = {
  x: number;
  y: number;
};

/**
 * Keeps a graph legible without treating a visual position as persisted data.
 * Sorting each ring by resource id makes a topology render identically on every load.
 */
export function createConstellationLayout(
  nodes: ConstellationNode[],
): Map<string, ConstellationPosition> {
  const positions = new Map<string, ConstellationPosition>();
  const center = nodes.find((node) => node.hop === 0);
  if (center) positions.set(center.resource.id, { x: 50, y: 50 });

  for (const [hop, radius] of [[1, 34], [2, 43]] as const) {
    const ring = nodes
      .filter((node) => node.hop === hop)
      .sort((left, right) => left.resource.id.localeCompare(right.resource.id));
    ring.forEach((node, index) => {
      const angle = (-Math.PI / 2) + (Math.PI * 2 * index) / ring.length;
      positions.set(node.resource.id, {
        x: 50 + Math.cos(angle) * radius,
        y: 50 + Math.sin(angle) * radius * 0.74,
      });
    });
  }

  return positions;
}
