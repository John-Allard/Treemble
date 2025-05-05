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

/**
 * Reconstruct a strictly bifurcating rooted tree and
 * return both the edge list and a Newick string that
 * includes branch lengths.
 *
 * @param dots         user‐placed nodes
 * @param timePerPixel horizontal scaling of branch lengths
 * @param tipNames     optional list of tip labels (top→bottom order)
 */
export function buildTreeFromDots(
  dots: Dot[],
  timePerPixel = 1,
  tipNames?: string[],
): BuiltTree {
  if (dots.length === 0) throw new Error("No nodes placed yet.");

  const n = dots.length;
  const coords = dots.map(d => [d.x, d.y]) as [number, number][];

  // find the single root
  const root = dots.findIndex(d => d.type === "root");
  if (root < 0) throw new Error("Exactly one node must be tagged as root.");
  if (dots.filter(d => d.type === "root").length > 1)
    throw new Error("Multiple roots found; only one allowed.");

  // internals = all non-tips (including root)
  const internals = new Set<number>(
    dots.map((d,i) => (d.type === "tip" ? -1 : i)).filter(i => i >= 0)
  );

  // sweep parents right→left (more constrained first)
  const order = [...internals].sort((a,b) => coords[b][0] - coords[a][0]);

  const parent: Record<number,number> = {};
  const children: Record<number,number[]> = {};
  const free = new Set<number>(Array.from({length:n},(_,i)=>i));
  free.delete(root);

  let changed = true;
  while (changed) {
    changed = false;
    for (const u of order) {
      if ((children[u]?.length ?? 0) === 2) continue;
      const [xu,yu] = coords[u];
      let bestAbove = -1, bestBelow = -1;
      let bestAy = Infinity, bestBy = Infinity;

      free.forEach(v => {
        const [xv,yv] = coords[v];
        if (xv <= xu) return;             // must be to the right
        const dy = Math.abs(yv - yu);     // vertical distance
        if (yv > yu && dy < bestAy) {
          bestAbove = v; bestAy = dy;
        } else if (yv < yu && dy < bestBy) {
          bestBelow = v; bestBy = dy;
        }
      });

      if (bestAbove >= 0 && bestBelow >= 0) {
        for (const v of [bestAbove, bestBelow]) {
          parent[v] = u;
          (children[u] = children[u] ?? []).push(v);
          free.delete(v);
        }
        changed = true;
        break;
      }
    }
  }

  if (free.size)
    throw new Error(`Unattached nodes remain: ${[...free].join(", ")}`);

  // build edges list
  const edges: Edge[] = Object.entries(parent).map(([c,p])=>[Number(p), Number(c)]);

  // LABEL MAP
  const label: Record<number,string> = {};
  // sort tips top→bottom
  const tips = dots
    .map((d,i)=>[i,d] as const)
    .filter(([,d])=>d.type==="tip")
    .sort((a,b)=>a[1].y - b[1].y)
    .map(([i])=>i);

  if (tipNames) {
    if (tipNames.length !== tips.length)
      throw new Error(`Tip names (${tipNames.length}) ≠ tip count (${tips.length})`);
    tips.forEach((idx,k)=> {
      // replace any space characters in the provided tip names
      label[idx] = tipNames[k].replace(/ /g, '_');
    });
  } else {
    tips.forEach((idx,k)=> { label[idx] = `tip${k+1}`; });
  }

  // internal labels
  let ic = 1;
  for (let i = 0; i < n; i++) {
    if (!label[i]) {
      label[i] = `internal${ic++}`;
    }
  }

  // branch lengths (root = 0)
  const bl: Record<number,number> = { [root]: 0 };
  edges.forEach(([p,c]) => {
    const dx = coords[c][0] - coords[p][0];
    bl[c] = dx * timePerPixel;
  });

  // adjacency for Newick recursion
  const adj: Record<number,number[]> = {};
  edges.forEach(([p,c]) => {
    (adj[p] = adj[p] ?? []).push(c);
    (adj[c] = adj[c] ?? []).push(p);
  });

  // recursive Newick builder
  const toNewick = (u:number, p:number|null): string => {
    const kids = (adj[u] ?? []).filter(v=>v!==p);
    const lenStr = `:${Number(bl[u].toFixed(6))}`;
    if (!kids.length) return label[u] + lenStr;
    return `(${kids.map(k=>toNewick(k,u)).join(",")})` + lenStr;
  };

  return {
    edges,
    newick: toNewick(root, null) + ";",
    timePerPixel,
  };
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

  const edges: Edge[] = Object.entries(parent)
    .map(([c, p]) => [Number(p), Number(c)]);

  const fully = free.size === 0;
  const newick = fully
    ? buildTreeFromDots(dots, timePerPixel, tipNames ?? undefined).newick
    : "";

  return { edges, free: [...free] as number[], newick };
}
