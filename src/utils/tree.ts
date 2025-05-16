// src/utils/tree.ts
// ------------------------------------------------------------
// Build a bifurcating tree, with optional custom tip names.
// ------------------------------------------------------------

export type DotType = "tip" | "internal" | "root";

export interface Dot {
  x: number;
  y: number;
  type: DotType;
}

export type Edge = [number, number];

export interface BuiltTree {
  edges: Edge[];        // parent→child pairs
  newick: string;       // Newick string w/ branch lengths
  timePerPixel: number; // value used for lengths
}

export function isTreeUltrametric(dots: Dot[]): boolean {
  const tipXs = dots
    .filter(d => d.type === "tip")
    .map(d => d.x);

  if (tipXs.length < 2) return true;

  const first = tipXs[0];
  const EPSILON = 1e-6;

  return tipXs.every(x => Math.abs(x - first) < EPSILON);
}

/**
 * Partial tree builder: never throws, returns edges[], free[], newick only if fully connected.
 */
export function computePartialTree(
  dots: Dot[],
  timePerPixel: number,
  tipNames?: string[],
) {
  const n = dots.length;
  const xy = dots.map(d => [d.x, d.y]) as [number, number][];
  const root = dots.findIndex(d => d.type === "root");
  if (root < 0) return { edges: [] as Edge[], free: [...Array(n).keys()], newick: "" };

  const internals = new Set<number>(
    dots.map((d, i) => (d.type === "tip" ? -1 : i)).filter(i => i >= 0)
  );
  const order = [...internals].sort((a, b) => xy[b][0] - xy[a][0]);

  const parent: Record<number, number> = {};
  const children: Record<number, number[]> = {};
  const free = new Set<number>([...Array(n).keys()]);
  free.delete(root);

  let changed = true;
  while (changed) {
    changed = false;
    for (const u of order) {
      if ((children[u]?.length ?? 0) === 2) continue;
      const [xu, yu] = xy[u];
      let bestA = -1, bestB = -1, bestAy = Infinity, bestBy = Infinity;
      free.forEach(v => {
        const [xv, yv] = xy[v];
        if (xv <= xu) return;
        const dy = Math.abs(yv - yu);
        if (yv > yu && dy < bestAy) { bestA = v; bestAy = dy; }
        else if (yv < yu && dy < bestBy) { bestB = v; bestBy = dy; }
      });
      if (bestA >= 0 && bestB >= 0) {
        for (const v of [bestA, bestB]) {
          parent[v] = u;
          (children[u] = children[u] || []).push(v);
          free.delete(v);
        }
        changed = true;
        break;
      }
    }
  }

  const tips = dots
    .map((d, i) => ({ ...d, index: i }))
    .filter(d => d.type === "tip")
    .sort((a, b) => a.y - b.y);

  const edges: Edge[] = Object.entries(parent)
    .map(([c, p]) => [Number(p), Number(c)]);

  const fullyConnected = free.size === 0;
  const nameCountMatches = !tipNames || tipNames.length === tips.length;

  let newick = "";
  if (fullyConnected && nameCountMatches) {
    const label: Record<number, string> = {};
    tips.forEach((d, k) => {
      const rawName = tipNames?.[k];
        label[d.index] = rawName
          ? rawName.replace(/ /g, "_").replace(/[^a-zA-Z0-9_]/g, "")
          : `tip${k + 1}`;
    });
    let ic = 1;
    for (let i = 0; i < dots.length; i++) {
      if (!label[i]) label[i] = `internal${ic++}`;
    }

    const bl: Record<number, number> = { [root]: 0 };
    edges.forEach(([p, c]) => {
      bl[c] = (xy[c][0] - xy[p][0]) * timePerPixel;
    });

    const adj: Record<number, number[]> = {};
    edges.forEach(([p, c]) => {
      (adj[p] = adj[p] ?? []).push(c);
      (adj[c] = adj[c] ?? []).push(p);
    });

    const toNewick = (u: number, p: number | null): string => {
      const kids = (adj[u] ?? []).filter(v => v !== p);
      const lenStr = `:${Number(bl[u].toFixed(6))}`;
      if (!kids.length) return label[u] + lenStr;
      return `(${kids.map(k => toNewick(k, u)).join(",")})` + lenStr;
    };

    newick = toNewick(root, null) + ";";
  }

  return { edges, free: [...free], newick };
}

export function findAsymmetricalNodes(
  edges: Edge[],
  dots: Dot[],
  ratioThreshold = 3
): number[] {
  const childMap: Record<number, number[]> = {};
  edges.forEach(([p, c]) => {
    (childMap[p] = childMap[p] ?? []).push(c);
  });

  const result: number[] = [];

  for (const [parentStr, children] of Object.entries(childMap)) {
    if (children.length !== 2) continue;
    const p = parseInt(parentStr);
    const [c1, c2] = children;
    const py = dots[p].y;
    const y1 = dots[c1].y;
    const y2 = dots[c2].y;
    const d1 = Math.abs(py - y1);
    const d2 = Math.abs(py - y2);

    const min = Math.min(d1, d2);
    const max = Math.max(d1, d2);

    if (min > 0 && max / min >= ratioThreshold) {
      result.push(p);
    }
  }

  return result;
}

