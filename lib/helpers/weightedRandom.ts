export type WeightedSegment = {
  label: string;
  pointsReward: number;
  weight: number;
  color: string;
};

export function weightedRandom(segments: WeightedSegment[]): { segment: WeightedSegment; index: number } {
  const total = segments.reduce((s, seg) => s + seg.weight, 0);
  let rand = Math.random() * total;
  for (let i = 0; i < segments.length; i++) {
    rand -= segments[i].weight;
    if (rand <= 0) return { segment: segments[i], index: i };
  }
  const last = segments.length - 1;
  return { segment: segments[last], index: last };
}
