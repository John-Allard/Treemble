// src/components/CanvasPanel.tsx
import React, { useRef, useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { useAutosave } from "../hooks/useAutosave";
import Toolbar from "./Toolbar";
import { computePartialTree, Dot, DotType } from "../utils/tree";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { emitTo } from "@tauri-apps/api/event";
import { listen } from "@tauri-apps/api/event";
import { saveCSV, loadCSV } from "../utils/csvHandlers";
import { useDragAndDrop } from "../hooks/useDragAndDrop";
import { diffTipNamesFromText } from "../utils/csvHandlers";
import { findAsymmetricalNodes } from "../utils/tree";
import { exportTreeSVG } from "../utils/exportTreeSVG";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useSketchLayer } from "../hooks/useSketchLayer";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useCanvasContext } from "../context/CanvasContext";
import { useOutsideClick } from "../hooks/useOutsideClick";
import { useMouseHandlers } from "../hooks/useCanvasMouseHandlers";
import { clearSketchHistory } from "../hooks/useSketchUndoRedo";

import AboutModal from "./modals/AboutModal";
import OptionsModal from "./modals/OptionsModal";
import UnitsPrompt from "./modals/UnitsPrompt";
import NewickModal from "./modals/NewickModal";
import BlankCanvasModal from "./modals/BlankCanvasModal";
import EqualizeModal from "./modals/EqualizeModal";
import ShortcutsModal from "./modals/ShortcutsModal";
import QuickStartModal from "./modals/QuickStartModal";

// Off-screen master canvas storing sketch strokes in full image coords
let sketchMasterCanvas: HTMLCanvasElement | null = null;

const DOT_R = 8;
const LABEL_RADIAL_OFFSET = DOT_R + 2;   // pixels outward from tip
const ERASER_RADIUS = 20;
const EDGE_COLOUR = "#00cc00";
const RING_COLOUR = "#ff5500";
const DOT_COLOUR: Record<DotType, string> = {
  tip: "#4287f5",
  internal: "#f25c54",
  root: "#46b26b",
};

export default function CanvasPanel() {

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const vLineRef = useRef<HTMLDivElement>(null);
  const hLineRef = useRef<HTMLDivElement>(null);
  const contRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<{ x: number; y: number } | null>(null);
  const hiddenImgInput = useRef<HTMLInputElement>(null);
  const fileMenuRef = useRef<HTMLDivElement>(null);
  const draggingForTips = useRef(false);

  // ─── Canvas state from hook ───────────────────────────────────────────
  const {
    showAboutModal, setShowAboutModal,
    setShowShortcutsModal,
    setShowNewickModal,
    setShowBlankCanvasModal,
    setShowOptionsModal,
    setShowQuickStartModal,

    img, setImg,
    grayImg, setGrayImg,
    baseName, setBaseName,

    dots, setDots,
    lockedEdges, setLockedEdges,
    connectingFrom, setConnectingFrom,
    tipCount,
    hasRoot,

    scale, setScale,
    fontSize,
    bw,
    showTree, setShowTree,
    treeReady, setTreeReady,
    selRect, 
    setUnitsInput,
    calCursorX,
    toolMode, setToolMode,
    openEqualizeModal,

    edges, setEdges,
    freeNodes, setFreeNodes,
    banner, setBanner,
    setNewick,
    dragOver, setDragOver,

    isBlankCanvasMode, setIsBlankCanvasMode,
    drawDropdownOpen, setDrawDropdownOpen,

    branchThickness,
    asymmetryThreshold,
    tipLabelColor,

    treeType,
    treeShape,
    geometry,
    breakPointScreen,

    setLastSavePath,
    timePerPixel, setTimePerPixel,

    isDarkMode, setIsDarkMode,

    tipNames, setTipNames,

    tipLabelMismatch,
    asymmetricalNodes,

    getImgDims,

    clearHistory,
  } = useCanvasContext();

  const [panning, setPanning] = useState(false);
  const panStart = useRef<{ sl: number, st: number, x: number, y: number }>();

  // Node dragging
  const [draggingNodeIndex, setDraggingNodeIndex] = useState<number | null>(null);
  const wasDragging = useRef(false);
  const [hoveringNodeIndex, setHoveringNodeIndex] = useState<number | null>(null);
  const dragFrame = useRef<number | null>(null);

  // Misc
  const skipNextClick = useRef(false);
  const windowIsFocused = useRef(true);
  const focusTimestampRef = useRef<number>(Date.now());

  // blank canvas and draw mode
  const sketchRef = useRef<HTMLCanvasElement>(null);
  useSketchLayer(sketchRef, toolMode, scale, sketchMasterCanvas);

  // always holds the current array so listeners see fresh data
  const tipNamesRef = useRef<string[]>([]);
  const dotsRef = useRef<Dot[]>([]);
  dotsRef.current = dots;          // update every render
  tipNamesRef.current = tipNames;

  useEffect(() => {
    console.log("→ toolMode is now:", toolMode);
  }, [toolMode]);

  const resetAppStateForNewImage = (fileName: string) => {
    // leave scale unchanged – auto-fit effect will adjust appropriately
    setLastSavePath(null);
    setToolMode("none");
    setIsBlankCanvasMode(false);
    clearSketch();
    setDots([]);
    setLockedEdges([]);
    setConnectingFrom(null);
    setShowTree(false);
    setEdges([]);
    setFreeNodes([]);
    setBanner(null);
    setNewick("");
    setShowNewickModal(false);
    setTipNames([]);
    setTimePerPixel(1);
    setUnitsInput("");
    clearHistory();  // Clear undo/redo history for new image

    emitTo("tip-editor", "update-tip-editor", {
      text: "",
      tipCount: 0,
    }).catch(() => { });

    setBaseName(fileName.replace(/\.[^/.]+$/, ""));
  };

  useDragAndDrop(
    setImg,
    setGrayImg,
    setDots,
    setTipNames,
    setBanner,
    setDragOver,
    resetAppStateForNewImage,
    tipNamesRef,
    dotsRef,
    getImgDims,
  );

  const { RestorePromptOverlay } = useAutosave({
    dots,
    tipNames,
    lockedEdges,
    img,
    sketchMasterCanvas,
    isBlankCanvasMode,
    setDots,
    setTipNames,
    setLockedEdges,
    setImg,
    setGrayImg,
    setIsBlankCanvasMode,
    setConnectingFrom,
  });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  // ─── Clear-sketch handler ───────────────────────────────
  const clearSketch = () => {
    const prevToolMode = toolMode;
    setToolMode("none");

    // clear the on-screen sketch layer
    if (sketchRef.current) {
      const ctx = sketchRef.current.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, sketchRef.current.width, sketchRef.current.height);
    }

    // clear the master (unscaled) copy
    if (sketchMasterCanvas) {
      const mctx = sketchMasterCanvas.getContext("2d");
      if (mctx) mctx.clearRect(0, 0, sketchMasterCanvas.width, sketchMasterCanvas.height);
    }

    // clear sketch undo/redo history
    clearSketchHistory();

    // broadcast change so downstream listeners refresh
    if (sketchRef.current && typeof window !== "undefined") {
      const evt = new CustomEvent("sketch-updated", {
        detail: {
          width: sketchRef.current.width,
          height: sketchRef.current.height,
          image: sketchRef.current.toDataURL(),
        },
      });
      window.dispatchEvent(evt);
    }

    // restore previous draw mode after clearing finishes
    setTimeout(() => {
      setToolMode(prevToolMode);
    }, 0);
  };

  function drawOverlay() {
    const canvas = overlayRef.current;
    if (!(canvas instanceof HTMLCanvasElement)) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;    // already scaled
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const cur = cursorRef.current;
    if (!cur) return;

    /* ──────────────────────────────────────────────
       ① Special guide when choosing the centre
    ────────────────────────────────────────────── */
    if (toolMode === "centreSelect") {
      ctx.save();
      ctx.strokeStyle = "rgba(0,0,255,0.7)";
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      const radii = [50, 100, 150];       // px at image scale=1
      radii.forEach(r => {
        ctx.beginPath();
        ctx.arc(cur.x * scale, cur.y * scale, r * scale, 0, 2 * Math.PI);
        ctx.stroke();
      });
      ctx.restore();
      return;     // nothing else while centre picking
    }

    /* ──────────────────────────────────────────────
       ② Circular mode overlay (centre already chosen)
    ────────────────────────────────────────────── */
    if (treeShape === "circular" && geometry.getCentre()) {
      const centre = geometry.getCentre()!;

      ctx.save();
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);

      // Dashed circle at cursor radius
      const dx = (cur.x - centre.x) * scale;
      const dy = (cur.y - centre.y) * scale;
      const r = Math.hypot(dx, dy);
      ctx.beginPath();
      ctx.arc(centre.x * scale, centre.y * scale, r, 0, 2 * Math.PI);
      ctx.stroke();

      // Radial line extended to the image edge
      const vx = dx / r;            // unit vector from centre to cursor (scaled)
      const vy = dy / r;
      // Compute max t to hit any border
      const borders = [
        ((centre.x * scale) - 0) / (-vx || 1e-9),
        ((centre.y * scale) - 0) / (-vy || 1e-9),
        (w - centre.x * scale) / (vx || 1e-9),
        (h - centre.y * scale) / (vy || 1e-9),
      ].filter(t => t > 0);
      const tMax = Math.min(...borders);
      const endX = centre.x * scale + vx * tMax;
      const endY = centre.y * scale + vy * tMax;

      ctx.beginPath();
      ctx.moveTo(centre.x * scale, centre.y * scale);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.restore();
    } else {
      /* cross-hair lines are now handled by CSS divs; skip overlay crosshair drawing to avoid duplication */
    }

    /* Eraser preview circle (unchanged) */
    if (toolMode === "drawEraser") {
      const radiusPx = ERASER_RADIUS;
      ctx.strokeStyle = "rgba(0,0,0,0.8)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cur.x * scale, cur.y * scale, radiusPx, 0, 2 * Math.PI);
      ctx.stroke();
    }

    if (
      treeShape === "circular" &&
      geometry.getCentre() &&
      toolMode !== "breakSelect" &&
      breakPointScreen
    ) {
      const ctx = canvas.getContext("2d")!;
      const breakTheta = geometry.getBreakTheta();

      // Convert screen → tree coords for the break point
      const { r, theta } = geometry.toTree({
        x: breakPointScreen.x,
        y: breakPointScreen.y,
      });

      // Compute rotation exactly as for tip labels
      let rot = breakTheta - theta;
      if (rot > Math.PI) rot -= 2 * Math.PI;
      if (rot < -Math.PI) rot += 2 * Math.PI;
      if (rot > Math.PI / 2 || rot < -Math.PI / 2) rot += Math.PI;

      // Convert back to screen for placement
      const pos = geometry.toScreen({ r, theta });
      const px = pos.x * scale;
      const py = pos.y * scale;

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(rot);

      ctx.fillStyle = "#004080";
      const fontSize = Math.max(12, Math.min(24, canvas.width / 100));
      ctx.font = `${fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("-- Circle Break Point --", 0, 0);

      ctx.restore();
    }

    // Draw manual connection preview line if user is linking nodes
    if (connectingFrom !== null) {
      const origin = dots[connectingFrom];
      if (origin) {
        ctx.save();
        ctx.strokeStyle = "#00aa00";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(origin.x * scale, origin.y * scale);
        ctx.lineTo(cur.x * scale, cur.y * scale);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // Toggle tree overlay
  const toggleTree = () => {
    setFileMenuOpen(false);
    setShowTree(prev => {
      if (prev) setBanner(null);   // ← clear the banner if hiding
      return !prev;
    });
  };

  useEffect(() => {
    if (treeShape === "circular" && !geometry.getCentre() && showTree) {
      setShowTree(false);
    }
  }, [treeShape, geometry, showTree, setShowTree]);

  // Tree drawing: Recompute whenever dots or tipNames change while tree is visible
  useEffect(() => {
    if (!showTree) return;

    // In circular mode we cannot show without centre
    if (treeShape === "circular" && !geometry.getCentre()) {
      setEdges([]);
      setFreeNodes([]);
      setNewick("");
      setTreeReady(false);
      setBanner({ text: "The center and break point must be selected before a circular tree can be shown.", type: "error" });
      return;
    }

    try {
      const hasRoot = dots.some(d => d.type === "root");
      if (!hasRoot) {
        setEdges([]);
        setFreeNodes([]);
        setNewick("");
        setTreeReady(false);

        setBanner({
          text: "No root node placed yet.",
          type: "error"
        });
        return;
      }

      // project screen‐space dots into “tree” coordinates via geometry
      const projectedDots = dots.map(d => {
        const t = geometry.toTree({ x: d.x, y: d.y });
        return { x: t.r, y: t.theta, type: d.type } as Dot;
      });
      const { edges, free, newick } = computePartialTree(
        projectedDots,
        timePerPixel,
        tipNames.length ? tipNames : undefined,
        lockedEdges,
        treeShape
      );

      // In cladogram mode -- drop every ":<number>" branch-length token
      let finalNewick = newick;
      if (treeType === "clado") {
        finalNewick = finalNewick.replace(/:\d+(?:\.\d+)?/g, "");
      }

      if (Array.isArray(edges) && Array.isArray(free) && typeof finalNewick === "string") {
        setEdges(edges);
        setFreeNodes(free);
        setNewick(finalNewick);
        setTreeReady(free.length === 0);
      }

      // compute asymmetry on the freshly built tree
      const hasAsymmetry = treeShape === "freeform"
        ? false
        : findAsymmetricalNodes(edges, dots, asymmetryThreshold).length > 0;

      if (free.length === 1) {
        setBanner({
          text: "One node is not fully connected (red circle)." + (hasAsymmetry ? " Check near nodes with asymmetry (yellow circles)." : ""),
          type: "error"
        });
      } else if (free.length > 1) {
        setBanner({
          text: `There are ${free.length} nodes not fully connected (red circles).` + (hasAsymmetry ? " Check near nodes with asymmetry (yellow circles)." : ""),
          type: "error"
        });
      } else {
        setBanner((prev) => {
          if (prev?.type === "error") {
            return null;
          }
          return prev;  // leave success banners alone
        });
      }
    } catch (err: any) {
      console.error("Error recomputing tree:", err);
      setEdges([]);
      setFreeNodes([]);
      setNewick("");
      setBanner({
        text: `Error in tree: ${err.message ?? String(err)}`,
        type: "error"
      });
    }
  }, [dots, showTree, tipNames, timePerPixel, asymmetryThreshold, treeType, treeShape, geometry, lockedEdges]);

    // ─── Scale limits helper (min canvas 300 px, max 16 700 px) ────
  function clampScale(s: number): number {
    if (!img) return s;
    const minDim = Math.min(img.width, img.height);
    const maxDim = Math.max(img.width, img.height);
    const minS = Math.max(300 / minDim, 0.2);
    const maxS = 16250 / maxDim;
    return Math.min(Math.max(s, minS), maxS);
  }

  // ── One-time sizing *and* sketch sync when a new image is loaded ───────
  useEffect(() => {
    if (!img) return;

    /* 1️⃣  Resize the overlay & on-screen sketch canvases (unscaled) */
    if (overlayRef.current) {
      overlayRef.current.width = img.width;
      overlayRef.current.height = img.height;
    }
    if (sketchRef.current) {
      sketchRef.current.width = img.width;
      sketchRef.current.height = img.height;
    }

    /* 0️⃣  Auto-fit: initial zoom so the image roughly fills the container width */
    if (img && contRef.current) {
      const contW = contRef.current.clientWidth;
      if (contW) {
        const rawFit = Math.min(contW / img.width, 1);
        const fitScale = clampScale(rawFit);
        setScale(prev => Math.abs(prev - fitScale) > 0.001 ? fitScale : prev);
      }
    }

    /* 2️⃣  Ensure the off-screen master canvas exists */
    if (!sketchMasterCanvas) {
      sketchMasterCanvas = document.createElement("canvas");
      sketchMasterCanvas.width = img.width;
      sketchMasterCanvas.height = img.height;
    }

    /* 3️⃣  🔑  After an autosave restore the master already
            holds the user’s strokes.  Copy it onto the
            on-screen sketch layer now that the latter exists.          */
    if (sketchRef.current && sketchMasterCanvas) {
      const sctx = sketchRef.current.getContext("2d")!;
      sctx.clearRect(0, 0, sketchRef.current.width, sketchRef.current.height);
      sctx.drawImage(sketchMasterCanvas, 0, 0);
    }
  }, [img]);

  // ── Visual zoom: keep layout boxes in step with zoom (no transforms) ──
  useEffect(() => {
    if (!img || !overlayRef.current || !vLineRef.current || !hLineRef.current) return;

    /*  A.  SKETCH  (drawn strokes)  */
    // bitmap never changes → DON’T touch .width /.height here
    if (sketchRef.current) {
      sketchRef.current.style.width = `${img.width * scale}px`;
      sketchRef.current.style.height = `${img.height * scale}px`;
    }
    // ✖️ no transform – we scale only by enlarging the element’s box

    /*  B.  OVERLAY  (cross-hairs etc.)  */
    overlayRef.current.width = img.width * scale;  // bitmap matches zoom
    overlayRef.current.height = img.height * scale;
    overlayRef.current.style.width = `${img.width * scale}px`;  // layout box
    overlayRef.current.style.height = `${img.height * scale}px`;

    /*  C.  CROSSHAIR DIVS  */
    vLineRef.current.style.height = `${img.height * scale}px`;
    hLineRef.current.style.width = `${img.width * scale}px`;

    // 🖌️  After resizing overlay, redraw immediately to avoid flicker
    drawOverlay();
  }, [scale, img]);

  useEffect(() => {
    const handler = (e: any) => {
      if (!e.detail?.image) return;

      const img = new Image();
      img.onload = () => {
        /* 1️⃣  Update the off-screen master bitmap -------------------- */
        if (!sketchMasterCanvas) {
          sketchMasterCanvas = document.createElement("canvas");
        }
        sketchMasterCanvas.width = e.detail.width;
        sketchMasterCanvas.height = e.detail.height;
        const mctx = sketchMasterCanvas.getContext("2d")!;
        mctx.clearRect(0, 0, sketchMasterCanvas.width, sketchMasterCanvas.height);
        mctx.drawImage(img, 0, 0);

        /* 2️⃣  Mirror the master onto the on-screen sketch layer -------- */
        if (sketchRef.current) {
          sketchRef.current.width = e.detail.width;
          sketchRef.current.height = e.detail.height;
          const sctx = sketchRef.current.getContext("2d")!;
          sctx.clearRect(0, 0, sketchRef.current.width, sketchRef.current.height);
          sctx.drawImage(sketchMasterCanvas, 0, 0);
        }
      };
      img.src = e.detail.image;
    };

    window.addEventListener("sketch-updated", handler);
    return () => window.removeEventListener("sketch-updated", handler);
  }, []);

  // Draw canvas
  useEffect(() => {
    try {
      // ── Guard against missing image or canvas ─────────────────────────
      if (!img || !canvasRef.current) return;
      const cvs = canvasRef.current;
      const ctx = cvs.getContext("2d");
      if (!ctx) throw new Error("No 2D context");

      // ── Resize to match image & scale ────────────────────────────────
      const w = img.width * scale;
      const h = img.height * scale;
      cvs.width = w;
      cvs.height = h;

      // ── Clear & draw background ──────────────────────────────────────
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(bw && grayImg ? grayImg : img, 0, 0, w, h);

      // Edges (via geometry)
      if (showTree && !(treeShape === "circular" && !geometry.getCentre())) {
        ctx.strokeStyle = EDGE_COLOUR;
        ctx.lineWidth = branchThickness;
        edges.forEach(([pi, ci]) => {
          const parentDot = dots[pi];
          const childDot = dots[ci];
          if (!parentDot || !childDot) return;

          const parentTree = geometry.toTree({ x: parentDot.x, y: parentDot.y });
          const childTree = geometry.toTree({ x: childDot.x, y: childDot.y });

          const centre = geometry.getCentre() ?? { x: 0, y: 0 };
          geometry.drawEdge(ctx, parentTree, childTree, scale, centre);
        });
        // Problem-node rings
        ctx.strokeStyle = RING_COLOUR;
        ctx.lineWidth = 4;
        freeNodes.forEach(i => {
          const d = dots[i];
          ctx.beginPath();
          ctx.arc(d.x * scale, d.y * scale, DOT_R * 2.4, 0, Math.PI * 2);
          ctx.stroke();
        });
        // Asymmetry rings (yellow) — only if tree is invalid
        if (freeNodes.length > 0 && asymmetricalNodes.length > 0) {
          ctx.strokeStyle = "#ffcc00"; // yellow
          ctx.lineWidth = 3;

          asymmetricalNodes.forEach((p) => {
            const d = dots[p];
            ctx.beginPath();
            ctx.arc(d.x * scale, d.y * scale, DOT_R * 1.9, 0, Math.PI * 2);
            ctx.stroke();
          });
        }

      }

      // Manual hard-wired connections (green dashed lines)
      lockedEdges.forEach(([p, c]) => {
        const pd = dots[p];
        const cd = dots[c];
        if (!pd || !cd) return;
        ctx.save();
        ctx.strokeStyle = "#00aa00";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(pd.x * scale, pd.y * scale);
        ctx.lineTo(cd.x * scale, cd.y * scale);
        ctx.stroke();
        ctx.restore();
      });

      // Dots
      dots.forEach(d => {
        if (!d) return;  // <--- skip if undefined
        ctx.beginPath();
        ctx.arc(d.x * scale, d.y * scale, DOT_R, 0, Math.PI * 2);
        ctx.fillStyle = DOT_COLOUR[d.type];
        ctx.fill();
      });

      // Tip labels (if tree is shown and names exist)
      if (showTree && tipNames && tipNames.length) {
        const tips = dots
          .map((d, i) => ({ ...d, index: i }))
          .filter(d => d.type === "tip");

        ctx.font = `${fontSize * scale}px sans-serif`;
        ctx.fillStyle = tipLabelColor;
        ctx.textBaseline = "middle";   // easier radial centring

        if (treeShape === "rectangular" || treeShape === "freeform") {
          // ─── horizontal labels with vertical offset ───
          ctx.textBaseline = "top";
          tips
            .sort((a, b) => a.y - b.y)
            .forEach((tip, i) => {
              const name = tipNames[i];
              if (!name) return;
              const x = (tip.x + DOT_R + 2) * scale;
              const y = (tip.y + DOT_R / 2) * scale;
              ctx.textAlign = "left";
              ctx.fillText(name, x, y);
            });
        } else {
          // ─── circular mode: radial labels ───
          const centre = geometry.getCentre();
          if (!centre) return;
          const breakTheta = geometry.getBreakTheta();
          const TAU = 2 * Math.PI;

          // 1) Collect tip infos
          const tipInfos = tips.map((tip, idx) => {
            const { r, theta } = geometry.toTree({ x: tip.x, y: tip.y });
            return { dot: tip, idx, r, theta };
          });

          // 2) Compute ANG_SHIFT (¼ of min gap, capped)
          const sortedThetas = tipInfos
            .map(info => info.theta)
            .sort((a, b) => a - b);
          const gaps = sortedThetas.map((angle, i, arr) =>
            i === 0 ? (arr[0] + TAU) - arr[arr.length - 1] : angle - arr[i - 1]
          );
          const minGap = Math.min(...gaps);
          const ANG_SHIFT = Math.min(0.15, minGap / 2);

          // 3) Determine order anticlockwise from break
          const ordered = tipInfos
            .map(info => ({
              info,
              // ✅ anticlockwise distance from the break
              anticDist: (TAU - info.theta) % TAU
            }))
            .sort((a, b) => a.anticDist - b.anticDist)
            .map(x => x.info);

          // 4) Draw, pairing ordered[i] with tipNames[i]
          ordered.forEach((info, drawIdx) => {
            const rawName = tipNames[drawIdx];
            if (typeof rawName !== "string" || rawName.trim() === "") return;
            const name = rawName.trim();

            // radial baseline
            const canvasRad = breakTheta - info.theta;
            const onRight = Math.cos(canvasRad) > 0;
            const thetaLabel = info.theta + (onRight ? -ANG_SHIFT : +ANG_SHIFT);

            // position just outside the dot
            const pos = geometry.toScreen({
              r: info.r + LABEL_RADIAL_OFFSET / scale,
              theta: thetaLabel,
            });
            const px = pos.x * scale;
            const py = pos.y * scale;

            // rotation so text is upright
            let rot = canvasRad;
            if (rot > Math.PI) rot -= 2 * Math.PI;
            if (rot < -Math.PI) rot += 2 * Math.PI;
            if (rot > Math.PI / 2 || rot < -Math.PI / 2) rot += Math.PI;

            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(rot);
            ctx.textAlign = onRight ? "left" : "right";
            ctx.textBaseline = "middle";
            ctx.fillText(name, 0, 0);
            ctx.restore();
          });
        }
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
    } catch (err: any) {
      console.error("Error drawing canvas:", err);
      // show a non-fatal banner instead of crashing
      setBanner({ text: `Drawing error: ${err.message}`, type: "error" });
    }
  }, [img, grayImg, bw, dots, edges, freeNodes, showTree, scale, selRect, tipNames, fontSize, branchThickness, asymmetricalNodes, tipLabelColor, lockedEdges]);

  // ──────────────────────────────────────────────────────────
  //  Cross-window comms
  //    • tip-editor-saved  ← editor ➜ main
  //    • tip-editor-ready  ← editor asks for data
  // ──────────────────────────────────────────────────────────
  useEffect(() => {
    let unlistenSaved: (() => void) | null = null;
    let unlistenReady: (() => void) | null = null;

    /*  editor → main : user typed in the textarea  */
    listen("tip-editor-saved", (e: any) => {
      console.log("[Main] got tip-editor-saved:", e.payload);
      const updated = String(e.payload)
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      setTipNames(updated);
    }).then((un) => (unlistenSaved = un));

    /*  editor → main : editor window has finished loading  */
    listen("tip-editor-ready", () => {
      console.log("[Main] editor asked for current names");

      const tipCount = dotsRef.current.filter(d => d.type === "tip").length;
      emitTo("tip-editor", "update-tip-editor", {
        text: tipNamesRef.current.join("\n"),   // full list
        tipCount,
      }).catch(() => {/* ignore if window closed */ });
    }).then(un => (unlistenReady = un));

    return () => {
      unlistenSaved && unlistenSaved();
      unlistenReady && unlistenReady();
    };
  }, []);   // ← no deps; we rely on the ref instead

  useEffect(() => {
    const win = getCurrentWindow();

    const handleFocus = () => {
      windowIsFocused.current = true;
      focusTimestampRef.current = Date.now();
    };

    const handleBlur = () => {
      windowIsFocused.current = false;
    };

    const unblurPromise = win.listen("tauri://blur", handleBlur);
    const unfocusPromise = win.listen("tauri://focus", handleFocus);

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    return () => {
      unblurPromise.then(u => u());
      unfocusPromise.then(u => u());
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);


  // Zoom helper
  const zoom = (factor: number, cx: number, cy: number) => {
    if (!img || !contRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();

    // Get mouse position relative to the image (image space)
    const ox = (cx - rect.left) / scale;
    const oy = (cy - rect.top) / scale;

    const desired = scale * factor;
    const ns = clampScale(desired);
    setScale(ns);

    requestAnimationFrame(() => {
      const scrollX = ox * ns - contRef.current!.clientWidth / 2;
      const scrollY = oy * ns - contRef.current!.clientHeight / 2;
      contRef.current!.scrollLeft = scrollX;
      contRef.current!.scrollTop = scrollY;
    });
  };

  // ******* Menu handlers *******

  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [helpMenuOpen, setHelpMenuOpen] = useState(false);
  const helpMenuRef = useRef<HTMLDivElement>(null);
  const drawMenuRef = useRef<HTMLDivElement>(null);

  const openShortcutsModal = () => setShowShortcutsModal(true);
  const openQuickStartModal = () => setShowQuickStartModal(true);

  const chooseImage = () => {
    setFileMenuOpen(false);
    hiddenImgInput.current?.click();
  };

  const openBlankCanvas = () => {
    setFileMenuOpen(false);
    if (dots.length > 0 || tipNames.length > 0) {
      setShowBlankCanvasModal(true);
    } else {
      confirmBlankCanvas();
    }
  };

  const confirmBlankCanvas = () => {
    const i = new Image();
    i.onload = () => {
      setImg(i);
      setGrayImg(i);  // Already grayscale
      setIsBlankCanvasMode(true);

      // Create/reset master sketch canvas
      sketchMasterCanvas = document.createElement("canvas");
      sketchMasterCanvas.width = 2000;
      sketchMasterCanvas.height = 2000;
      const ctx = sketchMasterCanvas.getContext("2d")!;
      ctx.clearRect(0, 0, 2000, 2000);
      setScale(1);
      setTimePerPixel(1);
      setDots([]);
      setTipNames([]);
      setLockedEdges([]);
      setConnectingFrom(null);
      setBaseName("blank");
      setShowTree(false);
      setEdges([]);
      setFreeNodes([]);
      setNewick("");

      emitTo("tip-editor", "update-tip-editor", {
        text: "",
        tipCount: 0,
      }).catch(() => { });
    };
    i.src = "/blank-canvas-2000x2000.png"; // Served from assets folder
  };

  const saveCSVHandler = async () => {
    setFileMenuOpen(false);
    // Warn if there are more names than tip nodes
    if (tipNames.length > tipCount) {
      const extra = tipNames.length - tipCount;
      setBanner({
        text: `Warning: ${extra} excess tip name${extra > 1 ? "s" : ""} will be ignored.`,
        type: "error"
      });
      setTimeout(() => setBanner(null), 4000);
    }
    const path = await saveCSV(dots, tipNames, baseName, setBanner);
    if (path) {
      setLastSavePath(path);
    }
  };

  const loadCSVHandler = () => {
    setFileMenuOpen(false);
    setLastSavePath(null);
    setLockedEdges([]);
    setConnectingFrom(null);
    loadCSV(setDots, setTipNames, setBanner, tipNamesRef, getImgDims(),);
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
      const names = text.split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      setTipNames(names);                 // updates state
      tipNamesRef.current = names;        // keep ref fresh

      setBanner({
        text: `Loaded ${names.length} species names.`,
        type: "success"
      });
      setTimeout(() => setBanner(null), 3000);

      /* push immediately if the editor is already open */
      emitTo("tip-editor", "update-tip-editor", {
        text: names.join("\n"),
        tipCount: dots.filter((d) => d.type === "tip").length,
      }).catch(() => {/* editor might not exist; ignore */ });


    } catch (err: any) {
      setBanner({
        text: `Error loading tip names: ${err.message}`,
        type: "error"
      });
      setTimeout(() => setBanner(null), 6000);
    }
  };

  const openTipEditor = () => {
    console.log("openTipEditor called");

    try {
      const win = new WebviewWindow("tip-editor", {
        url: "tipEditor.html",
        title: "Edit Tip Names",
        width: 400,
        height: 600,
        resizable: true,
        alwaysOnTop: true,
        devtools: true,
      });

      console.log("WebviewWindow constructed");

      win.once("tauri://created", () => {
        console.log("tip-editor window created – sending current tip names");

        // Build current tip list (sorted top to bottom)
        const allNames = tipNamesRef.current.join("\n");     // include extras
        const tipCount = dotsRef.current.filter(d => d.type === "tip").length;

        emitTo("tip-editor", "update-tip-editor", {
          text: allNames,
          tipCount,
        }).catch((err) => {
          console.error("Failed to emit to tip-editor:", err);
        });
      });

      win.once("tauri://error", (err) => {
        console.error("Window creation failed:", err);
      });

    } catch (e) {
      console.error("Failed to create window:", e);
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
      setIsBlankCanvasMode(false);
      for (let p = 0; p < imgd.data.length; p += 4) {
        const lum = .3 * imgd.data[p] + .59 * imgd.data[p + 1] + .11 * imgd.data[p + 2];
        imgd.data[p] = imgd.data[p + 1] = imgd.data[p + 2] = lum;
      }
      ctx2.putImageData(imgd, 0, 0);
      const g = new Image();
      g.onload = () => setGrayImg(g);
      g.src = off.toDataURL();

      // reset
      setScale(1);
      setToolMode("none");
      setDots([]);
      setLockedEdges([]);
      setConnectingFrom(null);
      setShowTree(false);
      setEdges([]);
      setFreeNodes([]);
      setBanner(null);
      setNewick("");
      setShowNewickModal(false);
      setTipNames([]);
      setUnitsInput("");
      setTimePerPixel(1);

      emitTo("tip-editor", "update-tip-editor", {
        text: "",
        tipCount: 0,
      }).catch(() => { /* editor may not exist yet; ignore */ });

      setBaseName(f.name.replace(/\.[^/.]+$/, ""));
    };
    i.src = URL.createObjectURL(f);
  };

  const openDiffNamesHandler = async () => {
    setFileMenuOpen(false);

    const path = await open({
      filters: [{ name: "CSV", extensions: ["csv"] }],
      multiple: false,
    });
    if (!path || Array.isArray(path)) return;

    try {
      const text = await readTextFile(path);
      await diffTipNamesFromText(
        dotsRef.current,
        tipNamesRef.current,
        text,
        setTipNames,
        tipNamesRef,
        setBanner
      );

    } catch (err) {
      setBanner({ text: "Error reading CSV file.", type: "error" });
      setTimeout(() => setBanner(null), 4000);
    }
  };

  const exportSVGHandler = async () => {
    setFileMenuOpen(false);
    if (!img || !treeReady) return;

    await exportTreeSVG({
      img,
      baseName,
      geometry,
      edges,
      dots,
      freeNodes,
      asymmetricalNodes,
      treeShape,
      branchThickness,
      tipNames,
      fontSize,
      tipLabelColor,
    });
  };

  useOutsideClick(fileMenuRef, fileMenuOpen, setFileMenuOpen);
  useOutsideClick(helpMenuRef, helpMenuOpen, setHelpMenuOpen);
  useOutsideClick(drawMenuRef, drawDropdownOpen, setDrawDropdownOpen);

  // ******* Keyboard shortcuts *******
  useKeyboardShortcuts({
    zoom,
    saveCSVHandler,
    sketchMasterCanvas,
    sketchRef,
  });

  // mouse handlers from useCanvasMouseHandlers.tsx
  const {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleClick,
  } = useMouseHandlers(
    {
      canvasRef,
      overlayRef,
      verticalLineRef: vLineRef,
      horizontalLineRef: hLineRef,
      contRef,
      cursorRef,
      sketchRef,
      panStart,
      dragFrame,
      wasDragging,
      draggingNodeIndex,
      setDraggingNodeIndex,
      hoveringNodeIndex,
      setHoveringNodeIndex,
      skipNextClick,
      windowIsFocused,
      focusTimestampRef,
      draggingForTips,
      panning,
      setPanning,
      sketchMasterCanvas,
    },
    drawOverlay,
    zoom,
  );

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Banner */}
      {banner && (
        <div
          style={{
            flexShrink: 0,
            background:
              banner.type === "success"
                ? "#e6ffe6"
                : banner.type === "error"
                  ? "#ffe6e6"
                  : "#e6f0ff",       // info → light blue
            color:
              banner.type === "success"
                ? "#006600"
                : banner.type === "error"
                  ? "#7a0000"
                  : "#004080",       // info → dark blue
            padding: "3px 3px",
            textAlign: "center",
            fontWeight: "bold",
            fontSize: "1em",
          }}
        >
          {banner.text}
        </div>
      )}
      {/* hidden image input */}
      <input
        ref={hiddenImgInput}
        type="file"
        accept="image/*"
        onChange={loadImage}
        style={{ display: "none" }}
      />

      <Toolbar
        fileMenuOpen={fileMenuOpen}
        setFileMenuOpen={setFileMenuOpen}
        fileMenuRef={fileMenuRef}
        chooseImage={chooseImage}
        saveCSVHandler={saveCSVHandler}
        loadCSVHandler={loadCSVHandler}
        addTipNamesHandler={addTipNamesHandler}
        openDiffNamesHandler={openDiffNamesHandler}
        openTipEditor={openTipEditor}
        imgLoaded={!!img}
        tipNameMismatch={tipLabelMismatch}
        dotCount={dots.length}
        isDarkMode={isDarkMode}
        toggleShowTree={toggleTree}
        showTree={showTree}
        hasRoot={hasRoot}
        treeReady={treeReady}
        openEqualizeModal={openEqualizeModal}
        openNewickModal={() => setShowNewickModal(true)}
        openAboutModal={() => setShowAboutModal(true)}
        openOptionsModal={() => setShowOptionsModal(true)}
        openBlankCanvas={openBlankCanvas}
        clearSketch={clearSketch}
        exportSVGHandler={exportSVGHandler}
        helpMenuOpen={helpMenuOpen}
        setHelpMenuOpen={setHelpMenuOpen}
        helpMenuRef={helpMenuRef}
        openShortcutsModal={openShortcutsModal}
        openQuickStartModal={openQuickStartModal}
        drawMenuRef={drawMenuRef}
      />

      {/* Canvas area */}
      <div
        ref={contRef}
        style={{ flex: 1, overflow: "auto", position: "relative" }}
        onContextMenu={e => e.preventDefault()}
        onMouseDown={(e) => {
          const now = Date.now();
          /* If the window is still flagged as unfocused,
                this click is only trying to bring it to the front — suppress it. */
          if (!windowIsFocused.current) {
            skipNextClick.current = true;
            return;        // allow the upcoming tauri focus event to flip the flag
          }
          /* If we *just* got a focus event (≤150 ms ago),
                assume this is the same “bring-to-front” click and ignore it. */
          const delta = now - focusTimestampRef.current;
          if (delta < 150) {
            skipNextClick.current = true;
            return;
          }
          /* Normal interaction */
          handleMouseDown(e);
        }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {RestorePromptOverlay}
        <canvas
          ref={canvasRef}
          onClick={handleClick}
          style={{
            display: "block",
            cursor:
              draggingNodeIndex !== null
                ? "grabbing"
                : hoveringNodeIndex !== null
                  ? "grab"
                  : (toolMode === "detectTips" || toolMode === "detectInternal")
                    ? "cell"
                    : "crosshair"
          }}
        />

        {isBlankCanvasMode && (
          <canvas
            key="sketch-layer"
            ref={(el) => {
              (sketchRef as React.MutableRefObject<HTMLCanvasElement | null>).current = el;
              if (el && !sketchMasterCanvas) {
                sketchMasterCanvas = document.createElement("canvas");
                sketchMasterCanvas.width = el.width;
                sketchMasterCanvas.height = el.height;
              }
            }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              pointerEvents: toolMode.startsWith("draw") ? "auto" : "none",
            }}
            className={
              toolMode === "drawPencil" || toolMode === "drawLine"
                ? "sketch-pencil-cursor"
                : toolMode === "drawEraser"
                  ? "sketch-eraser-cursor"
                  : undefined
            }
          />
        )}

        {/* ▶ cross-hair overlay using divs */}
        <div
          ref={vLineRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "1px",
            height: "100%",
            // Dash pattern: 6px on, 4px off (total 10px)
            backgroundImage: "linear-gradient(rgba(0,0,0,0.75) 60%, transparent 60%)",
            backgroundSize: "1px 10px",
            pointerEvents: "none",
            transform: "translateX(-9999px)",
          }}
        />
        <div
          ref={hLineRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "1px",
            // Dash pattern: 6px on, 4px off (total 10px)
            backgroundImage: "linear-gradient(to right, rgba(0,0,0,0.75) 60%, transparent 60%)",
            backgroundSize: "10px 1px",
            pointerEvents: "none",
            transform: "translateY(-9999px)",
          }}
        />
        {/* Existing overlay canvas for special modes */}
        <canvas
          ref={overlayRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: "none",
            cursor: "inherit",
          }}
        />
      </div>

      {/* Live X-coordinate overlay */}
      {((toolMode === "equalizeStart") || (toolMode === "calibrateStart" || toolMode === "calibrateEnd")) && (
        <div style={{
          position: "absolute",
          top: 8,
          left: 8,
          background: "rgba(255,255,255,0.8)",
          padding: "2px 6px",
          borderRadius: "4px",
          fontSize: "14px",
          fontWeight: "bold",
          color: "#333",
          pointerEvents: "none"
        }}>
          {treeShape === "circular" ? "r:" : "X:"} {Math.round(calCursorX)}
        </div>
      )}

      {/* Tip count overlay */}
      <div style={{
        position: "absolute",
        top: 72,
        right: 12,
        background: "rgba(255,255,255,0.9)",
        padding: "4px 8px",
        borderRadius: "4px",
        fontSize: "14px",
        fontWeight: "bold",
        color: "#333",
        textAlign: "right",
        lineHeight: "1.3"
      }}>
        <span>Tip nodes: {tipCount}</span>
        {tipLabelMismatch && (
          <div title={`Tip nodes ≠ Tip name lines (${tipNames.length})`}
            style={{
              fontSize: "13px",
              color: "#cc0000",
              fontWeight: "bold"
            }}>
            ≠ name lines ⚠️
          </div>
        )}
      </div>

      {dragOver && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(100, 100, 255, 0.2)",
          border: "4px dashed #5555ff",
          zIndex: 9999,
          pointerEvents: "none",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontSize: "1.5em",
          fontWeight: "bold",
          color: "#333",
          textShadow: "0 1px 3px rgba(255,255,255,0.8)"
        }}>
          Drop your file to load...
        </div>
      )}

      <EqualizeModal />

      <NewickModal />

      {showAboutModal && <AboutModal />}

      <OptionsModal />

      <UnitsPrompt />

      <BlankCanvasModal confirmBlankCanvas={confirmBlankCanvas} />

      <ShortcutsModal />

      <QuickStartModal />

    </div>
  );
}
