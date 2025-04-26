// src/components/CanvasPanel.tsx
import React, { useRef, useState, useEffect } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { writeFile, readTextFile } from "@tauri-apps/plugin-fs";

import { buildTreeFromDots, Dot, DotType, Edge } from "../utils/tree";

const DOT_R = 8;
const EDGE_COLOUR = "#00cc00";
const RING_COLOUR = "#ff5500";
const DOT_COLOUR: Record<DotType, string> = {
  tip: "#4287f5",
  internal: "#f25c54",
  root: "#46b26b",
};

/**
 * Partial tree builder: never throws, returns edges[], free[], newick only if fully connected.
 */
function computePartialTree(
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

export default function CanvasPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contRef = useRef<HTMLDivElement>(null);
  const hiddenImgInput = useRef<HTMLInputElement>(null);
  const fileMenuRef = useRef<HTMLDivElement>(null);
  const draggingForTips = useRef(false);
  
  // about
  const [showAboutModal, setShowAboutModal] = useState(false);

  // Image state
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [grayImg, setGrayImg] = useState<HTMLImageElement | null>(null);
  const [baseName, setBaseName] = useState("tree");

  // Dot state
  const [dots, setDots] = useState<Dot[]>([]);
  const [mode, setMode] = useState<DotType>("tip");
  const [cursor, setCursor] = useState<{ x: number, y: number } | null>(null);

  // Zoom & pan
  const [scale, setScale] = useState(1);
  const [panning, setPanning] = useState(false);
  const panStart = useRef<{ sl: number, st: number, x: number, y: number }>();

  // BW toggle
  const [bw, setBW] = useState(false);

  // Tree overlay
  const [showTree, setShowTree] = useState(false);
  // tip-detect UI state
  const [tipDetectMode, setTipDetectMode] = useState(false);
  const [selStart, setSelStart] = useState<{ x: number; y: number } | null>(null);
  const [selRect, setSelRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const [edges, setEdges] = useState<Edge[]>([]);
  const [freeNodes, setFreeNodes] = useState<number[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const [newick, setNewick] = useState("");
  const [showNewickModal, setShowNewickModal] = useState(false);

  // File‐menu
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        fileMenuOpen &&
        fileMenuRef.current &&
        !fileMenuRef.current.contains(e.target as Node)
      ) {
        setFileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [fileMenuOpen, fileMenuRef]); 

  // Custom tip names
  const [tipNames, setTipNames] = useState<string[] | null>(null);

  const timePerPixel = 1;

  // Recompute whenever dots or tipNames change while tree is visible
  useEffect(() => {
    if (!showTree) return;
  
    try {
      const hasRoot = dots.some(d => d.type === "root");
      if (!hasRoot) {
        setEdges([]);
        setFreeNodes([]);
        setNewick("");
        setBanner("No root node placed yet.");
        return;
      }
  
      const { edges, free, newick } = computePartialTree(dots, timePerPixel, tipNames ?? undefined);
      if (Array.isArray(edges) && Array.isArray(free) && typeof newick === "string") {
        setEdges(edges);
        setFreeNodes(free);
        setNewick(newick);
      }
  
      if (free.length === 1) {
        setBanner("One node is not fully connected.");
      } else if (free.length > 1) {
        setBanner(`There are ${free.length} nodes not fully connected.`);
      } else {
        setBanner(null);
      }
    } catch (err: any) {
      console.error("Error recomputing tree:", err);
      setEdges([]);
      setFreeNodes([]);
      setNewick("");
      setBanner(`Error in tree: ${err.message ?? String(err)}`);
    }
  }, [dots, showTree, tipNames]);


  // Draw canvas
  useEffect(() => {
    if (!img || !canvasRef.current) return;
    const cvs = canvasRef.current;
    const ctx = cvs.getContext("2d")!;
    const w = img.width * scale, h = img.height * scale;
    cvs.width = w; cvs.height = h;

    // Background
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(bw && grayImg ? grayImg : img, 0, 0, w, h);

    // Edges (L-shaped)
    if (showTree) {
      ctx.strokeStyle = EDGE_COLOUR;
      ctx.lineWidth = 2;
      edges.forEach(([p, c]) => {
        const P = dots[p], C = dots[c];
        if (!P || !C) return;
        const cx = C.x * scale, cy = C.y * scale;
        const px = P.x * scale, py = P.y * scale;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(px, cy);
        ctx.lineTo(px, py);
        ctx.stroke();
      });
      // Problem-node rings
      ctx.strokeStyle = RING_COLOUR;
      ctx.lineWidth = 4;
      freeNodes.forEach(i => {
        const d = dots[i];
        ctx.beginPath();
        ctx.arc(d.x * scale, d.y * scale, DOT_R * 2, 0, Math.PI * 2);
        ctx.stroke();
      });
    }

    // Dots
    dots.forEach(d => {
      if (!d) return;  // <--- skip if undefined
      ctx.beginPath();
      ctx.arc(d.x * scale, d.y * scale, DOT_R, 0, Math.PI * 2);
      ctx.fillStyle = DOT_COLOUR[d.type];
      ctx.fill();
    });

    // Crosshair (always thin)
    if (cursor) {
      ctx.setLineDash([4, 2]);
      ctx.strokeStyle = "rgba(0,0,0,0.75)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cursor.x * scale, 0);
      ctx.lineTo(cursor.x * scale, h);
      ctx.moveTo(0, cursor.y * scale);
      ctx.lineTo(w, cursor.y * scale);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // draw live selection rectangle (if any)
    if (selRect) {
      ctx.strokeStyle = "rgba(255,0,0,0.8)";
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(
        selRect.x * scale,
        selRect.y * scale,
        selRect.w * scale,
        selRect.h * scale
      );
      ctx.setLineDash([]);
    }
  }, [img, grayImg, bw, dots, edges, freeNodes, showTree, cursor, scale, selRect]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!img) return;
      if (e.key === "]") {
        zoom(1.25, window.innerWidth / 2, window.innerHeight / 2);
        e.preventDefault();
      } else if (e.key === "[") {
        zoom(0.8, window.innerWidth / 2, window.innerHeight / 2);
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [img, scale]);

  // Zoom helper
  const zoom = (factor: number, cx: number, cy: number) => {
    if (!img || !contRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const ox = cx - rect.left + contRef.current.scrollLeft;
    const oy = cy - rect.top + contRef.current.scrollTop;
    const rx = ox / (img.width * scale);
    const ry = oy / (img.height * scale);
    const ns = Math.min(Math.max(scale * factor, 0.2), 10);
    setScale(ns);
    requestAnimationFrame(() => {
      const nw = img.width * ns, nh = img.height * ns;
      contRef.current!.scrollLeft = rx * nw - contRef.current!.clientWidth / 2;
      contRef.current!.scrollTop = ry * nh - contRef.current!.clientHeight / 2;
    });
  };

  /** File-menu handlers **/
  const chooseImage = () => {
    setFileMenuOpen(false);
    hiddenImgInput.current?.click();
  };

  const saveCSVHandler = async () => {
    setFileMenuOpen(false);
    const header = "x,y,type\n";
    const rows = dots.map(d => `${d.x},${d.y},${d.type}`).join("\n");
    const csv = header + rows;
    const path = await save({
      defaultPath: `${baseName}_node_locations.csv`,
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
    if (path) await writeFile(path, new TextEncoder().encode(csv));
  };

  const loadCSVHandler = async () => {
    setFileMenuOpen(false);
    const path = await open({
      filters: [{ name: "CSV", extensions: ["csv"] }],
      multiple: false,
    });
    if (!path || Array.isArray(path)) return;
    try {
      const text = await readTextFile(path);
      const lines = text.trim().split(/\r?\n/);
      if (!lines[0].toLowerCase().trim().startsWith("x,y,type")) {
        throw new Error("Missing or malformed CSV header");
      }
      const newDots: Dot[] = lines.slice(1).map((ln, i) => {
        const [xs, ys, tp] = ln.split(",");
        if (!xs || !ys || !tp) throw new Error(`Line ${i + 2} malformed`);
        const x = Number(xs), y = Number(ys);
        if (isNaN(x) || isNaN(y)) throw new Error(`Bad coords at line ${i + 2}`);
        if (!["tip", "internal", "root"].includes(tp))
          throw new Error(`Bad type '${tp}' at line ${i + 2}`);
        return { x, y, type: tp as DotType };
      });
      setDots(newDots);
    } catch (err: any) {
      console.error("Error loading CSV:", err);
      setBanner(`Error loading CSV: ${err?.message ?? String(err)}`);
      setTimeout(() => setBanner(null), 6000);
    }
  };

  const addTipNamesHandler = async () => {
    setFileMenuOpen(false);
    const path = await open({
      filters: [{ name: "Text", extensions: ["txt"] }],
      multiple: false,
    });
    if (!path || Array.isArray(path)) return;
    try {
      const text = await readTextFile(path);
      const names = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
      setTipNames(names);
    } catch (err: any) {
      setBanner(`Error loading tip names: ${err.message}`);
      setTimeout(() => setBanner(null), 6000);
    }
  };

  // Image file input (hidden)
  const loadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const i = new Image();
    i.onload = () => {
      setImg(i);
      // build grayscale
      const off = document.createElement("canvas");
      off.width = i.width; off.height = i.height;
      const ctx2 = off.getContext("2d")!;
      ctx2.drawImage(i, 0, 0);
      const imgd = ctx2.getImageData(0, 0, off.width, off.height);
      for (let p = 0; p < imgd.data.length; p += 4) {
        const lum = .3 * imgd.data[p] + .59 * imgd.data[p + 1] + .11 * imgd.data[p + 2];
        imgd.data[p] = imgd.data[p + 1] = imgd.data[p + 2] = lum;
      }
      ctx2.putImageData(imgd, 0, 0);
      const g = new Image(); g.src = off.toDataURL(); setGrayImg(g);

      // reset
      setScale(1);
      setDots([]);
      setShowTree(false);
      setEdges([]);
      setFreeNodes([]);
      setBanner(null);
      setNewick("");
      setShowNewickModal(false);
      setTipNames(null);

      setBaseName(f.name.replace(/\.[^/.]+$/, ""));
    };
    i.src = URL.createObjectURL(f);
  };

  // Toggle tree overlay
  const toggleTree = () => {
    setFileMenuOpen(false);
    setShowTree(prev => {
      if (prev) setBanner(null);   // ← clear the banner if hiding
      return !prev;
    });
  };

  // Mouse & dot handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    /* ───── TIP-DETECT: start rectangle ───── */
    if (tipDetectMode && e.button === 0) {
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top)  / scale;
  
      setSelStart({ x, y });
      setSelRect({ x, y, w: 0, h: 0 });   // zero-size rect so it draws right away
      draggingForTips.current = true;
      e.preventDefault();                 // stop text-selection & scrolling
      return;
    }
  
    /* ───── Ctrl+wheel zoom helpers (unchanged) ───── */
    if (e.ctrlKey) {
      if (e.button === 0) zoom(1.25, e.clientX, e.clientY);
      else if (e.button === 2) zoom(0.8,  e.clientX, e.clientY);
      e.preventDefault();
      return;
    }
  
    /* ───── right-button panning (unchanged) ───── */
    if (e.button === 2) {
      setPanning(true);
      panStart.current = {
        sl: contRef.current!.scrollLeft,
        st: contRef.current!.scrollTop,
        x:  e.clientX,
        y:  e.clientY,
      };
    }
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current || !img) return;
  
    /* ───── TIP-DETECT: update rectangle ───── */
    if (tipDetectMode && selStart) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top)  / scale;
      setSelRect({
        x: Math.min(selStart.x, x),
        y: Math.min(selStart.y, y),
        w: Math.abs(x - selStart.x),
        h: Math.abs(y - selStart.y),
      });
      e.preventDefault();
      return;
    }
  
    /* ───── normal cross-hair & panning (unchanged) ───── */
    const rect = canvasRef.current.getBoundingClientRect();
    setCursor({
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    });
  
    if (panning && panStart.current) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      contRef.current!.scrollLeft = panStart.current.sl - dx;
      contRef.current!.scrollTop  = panStart.current.st - dy;
    }
  };
  
  const handleMouseUp = () => {
    /* ───── finish tip detection ───── */
    if (tipDetectMode && selStart && selRect && img) {
      import("../utils/detectTips").then(({ detectTipsInRect }) => {
        const tips = detectTipsInRect(img, {
          x:      Math.round(selRect.x),
          y:      Math.round(selRect.y),
          width:  Math.round(selRect.w),
          height: Math.round(selRect.h),
        });
  
        const newDots = [...dots];
        tips.forEach(t => {
          if (!newDots.some(d => Math.hypot(d.x - t.x, d.y - t.y) < DOT_R))
            newDots.push({ ...t, type: "tip" });
        });
        setDots(newDots);
      });
  
      /* reset */
      setTipDetectMode(false);
      setSelStart(null);
      setSelRect(null);
      return;
    }
  
    /* ───── ordinary panning end ───── */
    setPanning(false);
  };
  
  const handleMouseLeave = () => {
    setCursor(null);
    draggingForTips.current = false;   // clear any stale drag
  };
  const handleClick = (e: React.MouseEvent) => {
    /* ── BLOCK clicks that belong to a drag-to-detect operation ── */
    if (tipDetectMode || draggingForTips.current) {
      e.preventDefault();
      draggingForTips.current = false;   // reset for next interaction
      return;
    }
  
    /* existing shortcuts */
    if (e.ctrlKey) return;
    if (!canvasRef.current || !img) return;
  
    /* coordinates in image space */
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top)  / scale;
  
    /* build newDots exactly as before */
    let newDots: Dot[];
    if (mode === "root") {
      newDots = [
        ...dots.filter(d => d.type !== "root"),
        { x, y, type: "root" },
      ];
    } else {
      const idx = dots.findIndex(
        d => Math.hypot(d.x - x, d.y - y) < DOT_R / scale
      );
      newDots = idx >= 0
        ? dots.filter((_, i) => i !== idx)          // delete on click
        : [...dots, { x, y, type: mode }];          // add new dot
    }
  
    /* commit + keep your original error handling & tree refresh */
    try {
      setDots(newDots);
  
      if (showTree) {
        setEdges([]);
        setFreeNodes([]);
        setNewick("");
        setBanner(null);
      }
    } catch (err: any) {
      console.error("Error setting new dots:", err);
      setBanner(`Error updating node: ${err.message ?? String(err)}`);
      setTimeout(() => setBanner(null), 6000);
    }
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Banner */}
      {banner && (
        <div style={{ background: "#ffe6e6", color: "#7a0000", padding: 6, textAlign: "center" }}>
          {banner}
        </div>
      )}

      {/* Toolbar + File menu */}
      <div style={{ padding: 8, background: "#f0f0f0", display: "flex", gap: 8, alignItems: "center" }}>
        {/* File menu */}
        <div style={{ position: "relative" }} ref={fileMenuRef}>
          <button
            onClick={() => setFileMenuOpen(f => !f)}
            style={{ padding: "6px 12px", cursor: "pointer" }}
          >
            File ▾
          </button>

          {fileMenuOpen && (
            <div style={{
              position: "absolute", top: "100%", left: 0,
              background: "#fff", border: "1px solid #ccc",
              boxShadow: "0 2px 6px rgba(0,0,0,0.15)", zIndex: 100,
              minWidth: "200px"
            }}>
              <div
                onClick={chooseImage}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f0f0f0"}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = "white"}
                style={{ padding: "6px 12px", cursor: "pointer" }}
              >
                Choose Tree Image
              </div>
              <div
                onClick={saveCSVHandler}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f0f0f0"}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = "white"}
                style={{ padding: "6px 12px", cursor: "pointer" }}
              >
                Save CSV
              </div>
              <div
                onClick={loadCSVHandler}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f0f0f0"}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = "white"}
                style={{ padding: "6px 12px", cursor: "pointer" }}
              >
                Load CSV
              </div>
              <div
                onClick={addTipNamesHandler}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f0f0f0"}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = "white"}
                style={{ padding: "6px 12px", cursor: "pointer" }}
              >
                Add Tip Names
              </div>
            </div>
          )}
        </div>

        {/* hidden image input */}
        <input
          ref={hiddenImgInput}
          type="file"
          accept="image/*"
          onChange={loadImage}
          style={{ display: "none" }}
        />

        {/* dot mode */}
        <button onClick={() => setMode("tip")} style={{ background: mode === "tip" ? "#add8e6" : undefined }}>Tip</button>
        <button onClick={() => setMode("internal")} style={{ background: mode === "internal" ? "#f08080" : undefined }}>Internal</button>
        <button onClick={() => setMode("root")} style={{ background: mode === "root" ? "#90ee90" : undefined }}>Root</button>
        
        {/* automatic tip detection */}
        <button
          onClick={() => {
            setTipDetectMode(prev => {
              const next = !prev;
              if (!next) {
                setSelStart(null);
                setSelRect(null);
                draggingForTips.current = false;
              }
              return next;
            });
          }}
          style={{
            background: tipDetectMode ? "#ffd700" : undefined,
            fontWeight: tipDetectMode ? "bold" : undefined,
          }}
          disabled={!img}
        >
          Detect Tips
        </button>

        {/* tree */}
        <button onClick={toggleTree}>{showTree ? "Hide Tree" : "Show Tree"}</button>
        <button
          onClick={() => setShowNewickModal(true)}
          disabled={!showTree || freeNodes.length > 0}
        >
          Show Newick
        </button>

        {/* BW toggle */}
        <label style={{ marginLeft: "auto" }}>
          <input type="checkbox" checked={bw} onChange={() => setBW(b => !b)} /> B/W
        </label>

        <button
          onClick={() => setShowAboutModal(true)}
          style={{ marginLeft: 8 }}
        >
          About
        </button>
      </div>

      {/* Canvas area */}
      <div
        ref={contRef}
        style={{ flex: 1, overflow: "scroll" }}
        onContextMenu={e => e.preventDefault()}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <canvas
          ref={canvasRef}
          onClick={handleClick}
          style={{
            display: "block",
            cursor: tipDetectMode ? "cell" : "crosshair"  // "cell" = box-drawing cursor
          }}
        />
      </div>

      {/* Newick Modal */}
      {showNewickModal && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", justifyContent: "center", alignItems: "center"
          }}
          onClick={() => setShowNewickModal(false)}
        >
          <div
            style={{ background: "#fff", padding: 20, width: 400, maxWidth: "90%" }}
            onClick={e => e.stopPropagation()}
          >
            <h3>Newick string</h3>
            <textarea
              readOnly
              value={newick}
              style={{ width: "100%", height: 120 }}
            />
            <div style={{ textAlign: "right", marginTop: 8 }}>
              <button
                onClick={async () => {
                  const path = await save({
                    defaultPath: `${baseName}_extracted_newick.nwk`,
                    filters: [{ name: "NWK", extensions: ["nwk"] }],
                  });
                  if (path) {
                    await writeFile(path, new TextEncoder().encode(newick));
                  }
                }}
              >
                Save .nwk
              </button>{" "}
              <button onClick={() => setShowNewickModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showAboutModal && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", justifyContent: "center", alignItems: "center",
          }}
          onClick={() => setShowAboutModal(false)}
        >
          <div
            style={{ background: "#fff", padding: 20, width: 360, maxWidth: "90%", textAlign: "center" }}
            onClick={e => e.stopPropagation()}
          >
            <h3>Treemble v1.0</h3>
            <p style={{ marginBottom: 10 }}>Created by John B. Allard</p>
            <p style={{ fontSize: "0.9em" }}>
              April 26, 2025<br />
              Treemble helps users reconstruct Newick strings from tree images by interactively placing nodes and extracting tips.
            </p>
            <div style={{ marginTop: 12 }}>
              <button onClick={() => setShowAboutModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
