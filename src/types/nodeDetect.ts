export type PredictedNode = {
  x: number;
  y: number;
  node_type: "internal" | "root" | "tip";
  score: number;
};
