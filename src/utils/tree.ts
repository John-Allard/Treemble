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

export function isTreeUltrametric(
  dots: Dot[],
  treeShape: "rectangular" | "circular" = "rectangular"
): boolean {
  const tipVals = dots
    .filter(d => d.type === "tip")
    .map(d => (treeShape === "circular" ? d.x : d.x)); // x already stores r in tree-coords

  if (tipVals.length < 2) return true;
  const first = tipVals[0];
  const EPSILON = 1e-6;
  return tipVals.every(v => Math.abs(v - first) < EPSILON);
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
  // `xy[i] = [r, θ]` in circular mode, or [x, y] in rectangular
  const xy = dots.map(d => [d.x, d.y]) as [number, number][];

  const root = dots.findIndex(d => d.type === "root");
  if (root < 0) {
    return { edges: [] as Edge[], free: [...Array(n).keys()], newick: "" };
  }

  const internals = new Set<number>(
    dots.map((d, i) => (d.type === "tip" ? -1 : i)).filter(i => i >= 0)
  );
  const order = [...internals].sort((a, b) => xy[b][0] - xy[a][0]);

  const parent: Record<number, number> = {};
  const children: Record<number, number[]> = {};
  const free = new Set<number>([...Array(n).keys()]);
  free.delete(root);

  /* Detect “circular” input (all θ within one full turn) */
  const TAU = 2 * Math.PI;
  const isCircular = xy.every(([, yy]) => yy >= 0 && yy < TAU + 1e-6);

  let changed = true;
  while (changed) {
    changed = false;
    for (const u of order) {
      if ((children[u]?.length ?? 0) === 2) continue;
      const [xu, yu] = xy[u];

      let bestCW = -1, bestCCW = -1;   // clockwise & counter‐cw neighbours
      let bestCWd = Infinity, bestCCWd = Infinity;

      free.forEach(v => {
        const [xv, yv] = xy[v];
        if (xv <= xu) return; // child must be “to the right”

        if (isCircular) {
          // angular gaps modulo 2π – small positive = nearest
          const dCW = (yv - yu + TAU) % TAU;   // clockwise gap
          const dCCW = (yu - yv + TAU) % TAU;  // anti‐clockwise gap
          if (dCW > 0 && dCW < bestCWd)  { bestCW = v; bestCWd = dCW; }
          if (dCCW > 0 && dCCW < bestCCWd) { bestCCW = v; bestCCWd = dCCW; }
        } else {
          // rectangular behaviour (original code)
          const dy = Math.abs(yv - yu);
          if (yv > yu && dy < bestCWd)  { bestCW = v; bestCWd = dy; }
          else if (yv < yu && dy < bestCCWd) { bestCCW = v; bestCCWd = dy; }
        }
      });

      if (bestCW >= 0 && bestCCW >= 0) {
        for (const v of [bestCW, bestCCW]) {
          parent[v] = u;
          (children[u] = children[u] || []).push(v);
          free.delete(v);
        }
        changed = true;
        break;
      }
    }
  }

  // ─── 1) Sort tips now, same as before ─────────────────────────────────
  // (θ used for circular; y used for rectangular)
  const tips = dots
    .map((d, i) => ({ ...d, index: i }))
    .filter(d => d.type === "tip")
    .sort((a, b) => {
      if (isCircular) {
        const aDist = (TAU - a.y) % TAU;
        const bDist = (TAU - b.y) % TAU;
        return aDist - bDist;
      }
      return a.y - b.y;
    });

  // ─── 2) Build edge list ────────────────────────────────────────────────
  const edges: Edge[] = Object.entries(parent)
    .map(([c, p]) => [Number(p), Number(c)]);

  const fullyConnected = free.size === 0;
  const nameCountMatches = !tipNames || tipNames.length === tips.length;

  let newick = "";
  if (fullyConnected && nameCountMatches) {
    // ─── 3) Assign labels in tip‐sorted order ────────────────────────────
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

    // ─── 4) Compute branch‐lengths ───────────────────────────────────────
    const bl: Record<number, number> = { [root]: 0 };
    edges.forEach(([p, c]) => {
      bl[c] = (xy[c][0] - xy[p][0]) * timePerPixel;
    });

    // ─── 5) Build adjacency list for the entire tree ─────────────────────
    const adj: Record<number, number[]> = {};
    edges.forEach(([p, c]) => {
      (adj[p] = adj[p] ?? []).push(c);
      (adj[c] = adj[c] ?? []).push(p);
    });

    // ──────────────────────────────────────────────────────────────────────
    // ─── 6) Precompute “min tip order” for every node in a single pass ───
    // This replaces the old getMinTipOrder recursion inside each sort.
    // ──────────────────────────────────────────────────────────────────────

    // `minOrder[u]` = smallest “tip‐order key” in the subtree rooted at u.
    // For leaves: that key is (TAU - θ)%TAU in circular, or raw y in rectangular.
    const minOrder = new Array<number>(n).fill(Infinity);

    // Depth‐first post‐order traversal from the root:
    const dfsCompute = (u: number, p: number | null) => {
      const kids = (adj[u] ?? []).filter(v => v !== p);
      if (kids.length === 0) {
        // Leaf (tip or maybe a dangling internal but still with no children)
        minOrder[u] = isCircular
          ? (TAU - xy[u][1]) % TAU
          : xy[u][1];
      } else {
        let best = Infinity;
        for (const c of kids) {
          dfsCompute(c, u);
          if (minOrder[c] < best) best = minOrder[c];
        }
        minOrder[u] = best;
      }
    };

    dfsCompute(root, null);

    // ──────────────────────────────────────────────────────────────────────
    // ─── 7) Build Newick by walking down from the root, sorting kids by precomputed minOrder ───
    // ──────────────────────────────────────────────────────────────────────
    const toNewick = (u: number, p: number | null): string => {
      // children, excluding the edge back to parent
      const kids = (adj[u] ?? []).filter(v => v !== p);

      // Sort siblings by their cached minOrder[u]:
      kids.sort((a, b) => minOrder[a] - minOrder[b]);

      const lenStr = `:${Number(bl[u].toFixed(6))}`;
      if (kids.length === 0) {
        return label[u] + lenStr; // leaf
      }

      // internal node → parenthesize children
      return `(${kids.map(c => toNewick(c, u)).join(",")})${lenStr}`;
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

  // Build a map from each parent → [its two children]
  const childMap: Record<number, number[]> = {};
  edges.forEach(([p, c]) => {
    (childMap[p] = childMap[p] ?? []).push(c);
  });

  const result: number[] = [];
  for (const [pStr, children] of Object.entries(childMap)) {
    if (children.length !== 2) continue;
    const p = Number(pStr);
    const [c1, c2] = children;

    const d1 = Math.abs(dots[p].y - dots[c1].y);
    const d2 = Math.abs(dots[p].y - dots[c2].y);
    const min = Math.min(d1, d2);
    const max = Math.max(d1, d2);

    if (min > 0 && max / min >= ratioThreshold) {
      result.push(p);
    }
  }

  return result;
}