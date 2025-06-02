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
    .map(d => treeShape === "circular" ? d.x : d.x);   // x already stores r in tree-coords

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

  /* Detect “circular” input (all θ within one full turn) */
  const isCircular = xy.every(([, yy]) => yy >= 0 && yy < 2 * Math.PI + 1e-6);
  const TAU = 2 * Math.PI;

  let changed = true;
  while (changed) {
    changed = false;
    for (const u of order) {
      if ((children[u]?.length ?? 0) === 2) continue;
      const [xu, yu] = xy[u];

      let bestCW = -1, bestCCW = -1;   // clockwise & counter-cw neighbours
      let bestCWd = Infinity, bestCCWd = Infinity;

      free.forEach(v => {
        const [xv, yv] = xy[v];
        if (xv <= xu) return;                     // child must be “to the right”

        if (isCircular) {
          // angular gaps modulo 2π – small positive = nearest
          const dCW = (yv - yu + TAU) % TAU;     // clockwise  gap
          const dCCW = (yu - yv + TAU) % TAU;     // anti-clockwise gap
          if (dCW > 0 && dCW < bestCWd) { bestCW = v; bestCWd = dCW; }
          if (dCCW > 0 && dCCW < bestCCWd) { bestCCW = v; bestCCWd = dCCW; }
        } else {
          // rectangular behaviour (original code)
          const dy = Math.abs(yv - yu);
          if (yv > yu && dy < bestCWd) { bestCW = v; bestCWd = dy; }
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

    /** Return the smallest Y-coordinate of any tip in the subtree rooted
     *  at `node` (ignoring the edge back to `parent`).  We’ll use this to
     *  keep child sub-trees in the same visual top-to-bottom order when
     *  we serialise the Newick string.
     */
    const getMinTipOrder = (node: number, parent: number | null): number => {
        const children = (adj[node] ?? []).filter(v => v !== parent);
        if (!children.length) {
          return isCircular
            ? (TAU - xy[node][1]) % TAU
            : xy[node][1];
        }
        return Math.min(...children.map(c => getMinTipOrder(c, node)));
      };

    const toNewick = (u: number, p: number | null): string => {
      // children, excluding the edge we came from
      const kids = (adj[u] ?? []).filter(v => v !== p);

      /* 🔑 Sort children so that the subtree whose first tip is higher up
      *    (smaller Y) appears first.  This preserves the original screen
      *    order (top → bottom) in the final Newick string.
      */
      kids.sort((a, b) => getMinTipOrder(a, u) - getMinTipOrder(b, u));

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

