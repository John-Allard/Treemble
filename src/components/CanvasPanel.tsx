// src/components/CanvasPanel.tsx
import React, { useRef, useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { writeFile, readTextFile } from "@tauri-apps/plugin-fs";
import Toolbar from "./Toolbar";
import { computePartialTree, Dot, DotType } from "../utils/tree";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { emitTo } from "@tauri-apps/api/event";
import { listen } from "@tauri-apps/api/event";
import { saveCSV, loadCSV } from "../utils/csvHandlers";
import { useDragAndDrop } from "../hooks/useDragAndDrop";
import { buildCSVString } from "../utils/csvHandlers";
import { diffTipNamesFromText } from "../utils/csvHandlers";
import { findAsymmetricalNodes } from "../utils/tree";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useSketchLayer } from "../hooks/useSketchLayer";
import { useCanvasContext } from "../context/CanvasContext";

import AboutModal from "./modals/AboutModal";
import OptionsModal from "./modals/OptionsModal";
import UnitsPrompt from "./modals/UnitsPrompt";
import NewickModal from "./modals/NewickModal";
import BlankCanvasModal from "./modals/BlankCanvasModal";
import EqualizeModal from "./modals/EqualizeModal";

// Off-screen master canvas storing sketch strokes in full image coords
let sketchMasterCanvas: HTMLCanvasElement | null = null;

const DOT_R = 8;
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
  const contRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<{ x: number; y: number } | null>(null);
  const hiddenImgInput = useRef<HTMLInputElement>(null);
  const fileMenuRef = useRef<HTMLDivElement>(null);
  const draggingForTips = useRef(false);

  // ─── Canvas state from hook ───────────────────────────────────────────
  const {
    showAboutModal,        setShowAboutModal,
    setShowNewickModal,
    setShowBlankCanvasModal,
    setShowOptionsModal,

    img,         setImg,
    grayImg,     setGrayImg,
    baseName,    setBaseName,

    dots,        setDots,
    tipCount,
    mode,        setMode,
    hasRoot,

    scale,       setScale,
    fontSize,    setFontSize,
    bw,          setBW,

    showTree,    setShowTree,
    treeReady,   setTreeReady,

    tipDetectMode,           setTipDetectMode,
    selStart,                setSelStart,
    selRect,                 setSelRect,

    calibrating,             setCalibrating,
    calStep,                 setCalStep,
    setCalX1,
    setCalX2,
    setShowUnitsPrompt,
    setUnitsInput,
    calCursorX,              setCalCursorX,

    equalizingTips,          setEqualizingTips,
    setEqualizeX,
    setShowEqualizeXConfirmModal,
    openEqualizeModal,

    edges,      setEdges,
    freeNodes,  setFreeNodes,
    banner,     setBanner,
    setNewick,
    dragOver,   setDragOver,

    drawMode,   setDrawMode,
    isBlankCanvasMode, setIsBlankCanvasMode,

    branchThickness,
    asymmetryThreshold,
    tipLabelColor,

    treeType,
    lastSavePath,setLastSavePath,
    timePerPixel,setTimePerPixel,

    isDarkMode, setIsDarkMode,

    tipNames,   setTipNames,

    tipLabelMismatch,
    asymmetricalNodes,
    toggleTipDetectMode,
    startCalibration,
    getImgDims,
  } = useCanvasContext();


  const [panning, setPanning] = useState(false);
  const panStart = useRef<{ sl: number, st: number, x: number, y: number }>();

  // Node dragging
  const [draggingNodeIndex, setDraggingNodeIndex] = useState<number | null>(null);
  const wasDragging = useRef(false);
  const [hoveringNodeIndex, setHoveringNodeIndex] = useState<number | null>(null);
  const dragFrame = useRef<number | null>(null);

  // Misc
  const modalPrimaryRef = useRef<HTMLButtonElement>(null);
  const skipNextClick = useRef(false);
  const windowIsFocused = useRef(true);
  const focusTimestampRef = useRef<number>(Date.now());

  // blank canvas and draw mode
  const sketchRef = useRef<HTMLCanvasElement>(null);
  useSketchLayer(sketchRef, drawMode, scale, sketchMasterCanvas);

  // always holds the current array so listeners see fresh data
  const tipNamesRef = useRef<string[]>([]);
  const dotsRef = useRef<Dot[]>([]);
  dotsRef.current = dots;          // update every render
  tipNamesRef.current = tipNames;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  // When the user enters a draw/erase tool, end any mutually-exclusive modes
  useEffect(() => {
    if (drawMode !== "none") {
      setTipDetectMode(false);
      setEqualizingTips(false);
      setCalibrating(false);
      setBanner(null);
    }
  }, [drawMode]);

  // ─── Clear-sketch handler ───────────────────────────────
  const clearSketch = () => {
    const prevDrawMode = drawMode;
    setDrawMode("none");
  
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
  
    // broadcast change so downstream listeners refresh
    if (sketchRef.current && typeof window !== "undefined") {
      const evt = new CustomEvent("sketch-updated", {
        detail: {
          width:  sketchRef.current.width,
          height: sketchRef.current.height,
          image:  sketchRef.current.toDataURL(),
        },
      });
      window.dispatchEvent(evt);
    }
  
    // restore previous draw mode after clearing finishes
    setTimeout(() => {
      setDrawMode(prevDrawMode);
    }, 0);
  };

  function drawOverlay() {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;          // overlay bitmap already scaled
    const h = canvas.height;

    // Clear overlay
    ctx.clearRect(0, 0, w, h);

    const cur = cursorRef.current;
    if (!cur) return;

    ctx.setLineDash([4, 2]);
    ctx.strokeStyle = "rgba(0,0,0,0.75)";
    ctx.lineWidth = 1;               // always 1 screen pixel
    ctx.beginPath();
    ctx.moveTo(cur.x * scale, 0);
    ctx.lineTo(cur.x * scale, h);
    ctx.moveTo(0, cur.y * scale);
    ctx.lineTo(w, cur.y * scale);
    ctx.stroke();
    ctx.setLineDash([]);
    /* —— Eraser preview circle —— */
    if (drawMode === "eraser") {
      const radiusPx = ERASER_RADIUS;  // independent of zoom
      ctx.strokeStyle = "rgba(0,0,0,0.8)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(
        cur.x * scale,
        cur.y * scale,
        radiusPx,
        0,
        Math.PI * 2
      );
      ctx.stroke();
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

  const resetAppStateForNewImage = (fileName: string) => {
    setScale(1);
    setDrawMode("none");
    setIsBlankCanvasMode(false);
    setDots([]);
    setShowTree(false);
    setEdges([]);
    setFreeNodes([]);
    setBanner(null);
    setNewick("");
    setShowNewickModal(false);
    setTipNames([]);
    setTimePerPixel(1);
    setUnitsInput("");

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


  // Recompute whenever dots or tipNames change while tree is visible
  useEffect(() => {
    if (!showTree) return;

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

      const { edges, free, newick } = computePartialTree(
        dots,
        timePerPixel,
        tipNames.length ? tipNames : undefined
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
      const hasAsymmetry = findAsymmetricalNodes(edges, dots, asymmetryThreshold).length > 0;

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
  }, [dots, showTree, tipNames, timePerPixel, asymmetryThreshold, treeType]);

  // ── One-time sizing when a new image is loaded ─────────────────────────
  useEffect(() => {
    if (!img) return;

    // Make overlay & sketch bitmaps exactly the image size (1×, not scaled)
    if (overlayRef.current) {
      overlayRef.current.width  = img.width;
      overlayRef.current.height = img.height;
    }
    if (sketchRef.current) {
      sketchRef.current.width  = img.width;
      sketchRef.current.height = img.height;
    }

    // Create master the first time we have a real image
    if (!sketchMasterCanvas) {
      sketchMasterCanvas = document.createElement("canvas");
      sketchMasterCanvas.width  = img.width;
      sketchMasterCanvas.height = img.height;
    }
  }, [img]);

  // ── Visual zoom: keep layout boxes in step with zoom (no transforms) ──
  useEffect(() => {
    if (!img || !sketchRef.current || !overlayRef.current) return;

    /*  A.  SKETCH  (drawn strokes)  */
    // bitmap never changes → DON’T touch .width /.height here
    sketchRef.current.style.width  = `${img.width  * scale}px`;
    sketchRef.current.style.height = `${img.height * scale}px`;
    // ✖️ no transform – we scale only by enlarging the element’s box

    /*  B.  OVERLAY  (cross-hairs etc.)  */
    overlayRef.current.width  = img.width  * scale;  // bitmap matches zoom
    overlayRef.current.height = img.height * scale;
    overlayRef.current.style.width  = `${img.width  * scale}px`;  // layout box
    overlayRef.current.style.height = `${img.height * scale}px`;
  }, [scale, img]);

  useEffect(() => {
    const handler = (e: any) => {
      if (!e.detail?.image) return;
      const img = new Image();
      img.onload = () => {
        if (!sketchMasterCanvas) {
          sketchMasterCanvas = document.createElement("canvas");
        }
        sketchMasterCanvas.width = e.detail.width;
        sketchMasterCanvas.height = e.detail.height;
        const ctx = sketchMasterCanvas.getContext("2d")!;
        ctx.clearRect(0, 0, sketchMasterCanvas.width, sketchMasterCanvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = e.detail.image;
    };
  
    window.addEventListener("sketch-updated", handler);
    return () => window.removeEventListener("sketch-updated", handler);
  }, []);

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
      ctx.lineWidth = branchThickness;
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
        .filter(d => d.type === "tip")
        .sort((a, b) => a.y - b.y);  // top to bottom order

      ctx.font = `${fontSize * scale}px sans-serif`;
      ctx.fillStyle = tipLabelColor;
      ctx.textBaseline = "top";

      tips.forEach((tip, i) => {
        const name = tipNames[i];
        if (name) {
          const x = tip.x * scale + DOT_R + 2;
          const y = tip.y * scale + DOT_R / 2;
          ctx.fillText(name, x, y);
        }
      });
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
  }, [img, grayImg, bw, dots, edges, freeNodes, showTree, scale, selRect, tipNames, fontSize, branchThickness, asymmetricalNodes, tipLabelColor]);

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

      const tips = dotsRef.current
        .map((d, i) => ({ ...d, index: i }))
        .filter(d => d.type === "tip")
        .sort((a, b) => a.y - b.y);          // top → bottom

      const names = tips.map((_, i) => tipNamesRef.current[i] || "");

      console.log("[Main] sending %d tip names → tip-editor", names.filter(Boolean).length);
      emitTo("tip-editor", "update-tip-editor", {
        text: names.join("\n"),
        tipCount: tips.length,
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!img) return;
      const key = e.key.toLowerCase();
      // Zoom
      if (key === "]") {
        zoom(1.25, window.innerWidth / 2, window.innerHeight / 2);
        e.preventDefault();
      } else if (key === "[") {
        zoom(0.8, window.innerWidth / 2, window.innerHeight / 2);
        e.preventDefault();

        // Toggle tree overlay
      } else if (key === "s" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        toggleTree();
        e.preventDefault();

        // Font size
      } else if ((key === "+" || key === "=") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setFontSize(prev => prev + 1);
        e.preventDefault();
      } else if (key === "-" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setFontSize(prev => Math.max(1, prev - 1));
        e.preventDefault();

        // B/W mode
      } else if (key === "b" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setBW(prev => !prev);
        e.preventDefault();

        // Canvas modes
      } else if (key === "t" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setDrawMode("none");          // ← leave draw tools
        setTipDetectMode(false);
        setMode("tip");
        e.preventDefault();
      } else if (key === "i" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setDrawMode("none");          // ← leave draw tools
        setTipDetectMode(false);
        setMode("internal");
        e.preventDefault();
      } else if (key === "r" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setDrawMode("none");          // ← leave draw tools
        setTipDetectMode(false);
        setMode("root");
        e.preventDefault();

        // Tip-detect toggle
      } else if (key === "d" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        toggleTipDetectMode();
        e.preventDefault();

        // Calibration
      } else if (key === "c" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        startCalibration();
        e.preventDefault();

      } else if (key === "e" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setDrawMode("none");  // ⬅ exit draw mode
        setEqualizingTips(prev => {
          const next = !prev;
          if (next) {
            setBanner({ text: "Click a point on the image to set all tip nodes to that X-axis position.", type: "success" });
          } else {
            setBanner(null);
          }
          return next;
        });
        e.preventDefault();

        // Control+S to quicksave
      } else if (key === "s" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        console.log("Ctrl+S quicksave…");

        if (lastSavePath) {
          const csv = buildCSVString(dotsRef.current, tipNamesRef.current);
          const blob = new TextEncoder().encode(csv);

          writeFile(lastSavePath, blob)
            .then(() => {
              setBanner({ text: `CSV saved to ${lastSavePath}`, type: "success" });
              setTimeout(() => setBanner(null), 3000);
            })
            .catch((err) => {
              console.error("Failed to quick-save CSV:", err);
              setBanner({ text: "Error saving CSV.", type: "error" });
              setTimeout(() => setBanner(null), 6000);
            });
        } else {
          saveCSVHandler();  // prompts if no prior save
        }
      }

      /* ── Draw-menu hot-keys (work only when dropdown is open) ── */
      if (isBlankCanvasMode && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (key === "p") {                 // ✏️  Pencil
          setDrawMode("pencil");
          e.preventDefault();
          return;
        } else if (key === "l") {          // 📏  Line
          setDrawMode("line");
          e.preventDefault();
          return;
        } else if (e.key === "Backspace") { // 🧽  Eraser
          setDrawMode("eraser");
          e.preventDefault();
          return;
        }
      }

    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [img, scale, toggleTree, startCalibration, toggleTipDetectMode]);

  // Zoom helper
  const zoom = (factor: number, cx: number, cy: number) => {
    if (!img || !contRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();

    // Get mouse position relative to the image (image space)
    const ox = (cx - rect.left) / scale;
    const oy = (cy - rect.top) / scale;

    const ns = Math.min(Math.max(scale * factor, 0.2), 10);
    setScale(ns);

    requestAnimationFrame(() => {
      const scrollX = ox * ns - contRef.current!.clientWidth / 2;
      const scrollY = oy * ns - contRef.current!.clientHeight / 2;
      contRef.current!.scrollLeft = scrollX;
      contRef.current!.scrollTop = scrollY;
    });
  };

  /** File-menu handlers **/
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
      sketchMasterCanvas.width  = 2000;
      sketchMasterCanvas.height = 2000;
      const ctx = sketchMasterCanvas.getContext("2d")!;
      ctx.clearRect(0, 0, 2000, 2000);
      setScale(1);
      setDots([]);
      setTipNames([]);
      setBaseName("blank");
      setShowTree(false);
      setEdges([]);
      setFreeNodes([]);
      setNewick("");
      setBanner({ text: "Blank canvas created.", type: "success" });
      setTimeout(() => setBanner(null), 3000);

      emitTo("tip-editor", "update-tip-editor", {
        text: "",
        tipCount: 0,
      }).catch(() => { });
    };
    i.src = "/blank-canvas-2000x2000.png"; // Served from assets folder
  };

  const saveCSVHandler = async () => {
    setFileMenuOpen(false);
    const path = await saveCSV(dots, tipNames, baseName, setBanner);
    if (path) {
      setLastSavePath(path);
    }
  };

  const loadCSVHandler = () => {
    setFileMenuOpen(false);
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
        const tips = dotsRef.current
          .map((d, i) => ({ ...d, index: i }))
          .filter((d) => d.type === "tip")
          .sort((a, b) => a.y - b.y);

        const names = tips.map((_, i) => tipNamesRef.current[i] || "");

        emitTo("tip-editor", "update-tip-editor", {
          text: names.join("\n"),
          tipCount: tips.length,
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
      setDrawMode("none");
      setDots([]);
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

  // Mouse & dot handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      drawMode !== "none" &&          // drawing/erasing active
      e.button === 0 &&               // plain left-click only
      !e.ctrlKey &&                   // allow Ctrl-click zoom
      !target.closest(".toolbar-menu-item") &&
      !target.closest("button")
    ) return;
    // ───── Calibration disables normal mousedown ─────
    if (calibrating && e.button !== 2 && !e.ctrlKey) {
      return;
    }
    if (equalizingTips && e.button !== 2 && !e.ctrlKey) {
      return;
    }

    /* ───── TIP-DETECT & NODE-DRAG: combined ───── */
    if (tipDetectMode && e.button === 0 && !e.ctrlKey) {
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;

      // live banner during first-point pick
      if (calibrating && calStep === "pick1") {
        setBanner({
          text: `Calibration: click the initial point (live X = ${Math.round(x)})`,
          type: "success"
        });
      }

      // 1) If over an existing node → start node drag
      let nodeIndex: number | null = null;
      for (let i = dots.length - 1; i >= 0; i--) {
        const d = dots[i];
        const dist = Math.hypot(d.x - x, d.y - y);
        if (dist < DOT_R / scale) {
          nodeIndex = i;
          break;
        }
      }
      if (nodeIndex !== null) {
        setDraggingNodeIndex(nodeIndex);
        e.preventDefault();
        return;
      }

      // 2) Otherwise → start detection rectangle
      setSelStart({ x, y });
      setSelRect({ x, y, w: 0, h: 0 });
      draggingForTips.current = true;
      e.preventDefault();
      return;
    }

    /* ───── Ctrl+wheel zoom helpers (unchanged) ───── */
    if (e.ctrlKey) {
      if (e.button === 0) zoom(1.25, e.clientX, e.clientY);
      else if (e.button === 2) zoom(0.8, e.clientX, e.clientY);
      e.preventDefault();
      return;
    }

    /* ───── right-button panning (unchanged) ───── */
    if (e.button === 2) {
      setPanning(true);
      panStart.current = {
        sl: contRef.current!.scrollLeft,
        st: contRef.current!.scrollTop,
        x: e.clientX,
        y: e.clientY,
      };
    }

    // If left-click on a node: prepare to drag
    if (e.button === 0) {
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;

      for (let i = dots.length - 1; i >= 0; i--) {
        const d = dots[i];
        const dist = Math.hypot(d.x - x, d.y - y);
        if (dist < DOT_R / scale) {
          setDraggingNodeIndex(i);
          e.preventDefault();
          return;
        }
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current || !img) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    cursorRef.current = { x, y };
    drawOverlay();

    // 💡 Update calibration live-X if in calibration mode
    if ((calibrating && (calStep === "pick1" || calStep === "pick2")) || equalizingTips) {
      setCalCursorX(x);
    }

    // Only check hover if not dragging
    if (draggingNodeIndex === null) {
      let foundIndex: number | null = null;
      for (let i = dots.length - 1; i >= 0; i--) {
        const d = dots[i];
        const dist = Math.hypot(d.x - x, d.y - y);
        if (dist < DOT_R / scale) {
          foundIndex = i;
          break;
        }
      }
      setHoveringNodeIndex(foundIndex);
    } else {
      setHoveringNodeIndex(null);  // Don't show hover while dragging
    }

    // If dragging a node, update its position
    if (draggingNodeIndex !== null) {
      wasDragging.current = true;

      const draggedIndex = draggingNodeIndex;
      const draggedX = x;
      const draggedY = y;

      if (dragFrame.current === null) {
        dragFrame.current = requestAnimationFrame(() => {
          setDots(prev => {
            const next = [...prev];
            next[draggedIndex] = { ...next[draggedIndex], x: draggedX, y: draggedY };
            return next;
          });
          dragFrame.current = null;
        });
      }

      return;  // skip drawOverlay here — it’ll update on next frame
    }

    // Tip-detect: update rectangle
    if (tipDetectMode && selStart) {
      setSelRect({
        x: Math.min(selStart.x, x),
        y: Math.min(selStart.y, y),
        w: Math.abs(x - selStart.x),
        h: Math.abs(y - selStart.y),
      });
      e.preventDefault();
      return;
    }

    // Normal panning
    if (panning && panStart.current) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      contRef.current!.scrollLeft = panStart.current.sl - dx;
      contRef.current!.scrollTop = panStart.current.st - dy;
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      drawMode !== "none" &&          // drawing/erasing active
      e.button === 0 &&               // plain left-click only
      !e.ctrlKey &&                   // allow Ctrl-click zoom
      !target.closest(".toolbar-menu-item") &&
      !target.closest("button")
    ) return;
    // Stop dragging
    if (draggingNodeIndex !== null) {
      setDraggingNodeIndex(null);
    }

    /* ───── finish tip detection ───── */
    if (tipDetectMode && selStart && selRect && img) {
      import("../utils/detectTips").then(({ detectTipsInRect }) => {

        /* ① build a composite at the image’s native resolution ------------ */
        const merged = document.createElement("canvas");
        merged.width  = img.width;
        merged.height = img.height;
        const ctx = merged.getContext("2d")!;

        // a) background layer
        if (isBlankCanvasMode) {
          // user is working on an empty white canvas
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, merged.width, merged.height);
        } else {
          // external figure → draw the pristine source image
          ctx.drawImage(img, 0, 0);
        }

        // b) overlay any sketch strokes the user has drawn
        if (sketchMasterCanvas) {
          ctx.drawImage(sketchMasterCanvas, 0, 0);
        }

        /* ② run the detector on the merged image -------------------------- */
        const mergedImg = new Image();
        mergedImg.onload = () => {
          const tips = detectTipsInRect(mergedImg, {
            x: Math.round(selRect.x),
            y: Math.round(selRect.y),
            width:  Math.round(selRect.w),
            height: Math.round(selRect.h),
          });

          const newDots = [...dots];
          tips.forEach(t => {
            if (!newDots.some(d => Math.hypot(d.x - t.x, d.y - t.y) < DOT_R))
              newDots.push({ ...t, type: "tip" });
          });
          setDots(newDots);
        };
        mergedImg.src = merged.toDataURL();

      });

      /* reset */
      setSelStart(null);
      setSelRect(null);
      return;
    }

    /* ───── ordinary panning end ───── */
    setPanning(false);
  };

  const handleMouseLeave = () => {
    setDraggingNodeIndex(null); // Stop dragging if mouse leaves canvas
    draggingForTips.current = false;   // clear any stale drag
  };

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      drawMode !== "none" &&          // drawing/erasing active
      e.button === 0 &&               // plain left-click only
      !e.ctrlKey &&                   // allow Ctrl-click zoom
      !target.closest(".toolbar-menu-item") &&
      !target.closest("button")
    ) return;
    if (skipNextClick.current) {
      skipNextClick.current = false;
      return;
    }

    if (wasDragging.current) {
      // This click is from a drag, ignore it
      wasDragging.current = false;
      return;
    }

    // ── Calibration click handling ────────────────────────────
    if (calibrating && !e.ctrlKey) {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const xPos = (e.clientX - rect.left) / scale;

      if (calStep === "pick1") {
        setCalX1(xPos);
        setCalStep("pick2");
        setBanner({
          text: `Initial point recorded at X = ${Math.round(xPos)}. Click the final point.`,
          type: "success"
        });
      } else if (calStep === "pick2") {
        setCalX2(xPos);
        setCalStep("units");
        setBanner({
          text: `Final point recorded at X = ${Math.round(xPos)}. Enter units.`,
          type: "success"
        });
        setShowUnitsPrompt(true);
      }
      return; // block normal dot behaviour
    }

    if (equalizingTips && !e.ctrlKey) {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / scale;

      setEqualizeX(x);
      setEqualizingTips(false);
      setShowEqualizeXConfirmModal(true);
      setBanner(null);
      return;
    }

    // ── TIP-DETECT mode: allow node removal, block others ──
    if (tipDetectMode) {
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;

      // If clicking over a node, remove it
      const nodeIndex = dots.findIndex(d => Math.hypot(d.x - x, d.y - y) < DOT_R / scale);
      if (nodeIndex !== -1) {
        setDots(prev => prev.filter((_, i) => i !== nodeIndex));
        e.preventDefault();
        return;
      }

      // If it was just a detection drag release, skip click
      if (draggingForTips.current) {
        draggingForTips.current = false;
        e.preventDefault();
        return;
      }

      // Otherwise do nothing in detect mode
      e.preventDefault();
      return;
    }

    /* existing shortcuts */
    if (e.ctrlKey) return;
    if (!canvasRef.current || !img) return;

    /* coordinates in image space */
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

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

    /* commit + keep original error handling & tree refresh */
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
      setBanner({
        text: `Error updating node: ${err.message ?? String(err)}`,
        type: "error"
      });
      setTimeout(() => setBanner(null), 6000);
    }
  };

  useEffect(() => {
    const handleEnter = (e: KeyboardEvent) => {
      if (e.key === "Enter" && modalPrimaryRef.current) {
        modalPrimaryRef.current.click();
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", handleEnter);
    return () => window.removeEventListener("keydown", handleEnter);
  }, []);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Banner */}
      {banner && (
        <div
          style={{
            flexShrink: 0,
            background: banner.type === "success" ? "#e6ffe6" : "#ffe6e6",
            color: banner.type === "success" ? "#006600" : "#7a0000",
            padding: "3px 3px",           // thinner
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
        equalizingTips={equalizingTips}
        openEqualizeModal={openEqualizeModal}
        openNewickModal={() => setShowNewickModal(true)}
        startCalibration={startCalibration}
        calibrating={calibrating}
        openAboutModal={() => setShowAboutModal(true)}
        openOptionsModal={() => setShowOptionsModal(true)}
        openBlankCanvas={openBlankCanvas}
        clearSketch={clearSketch}
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
                  : tipDetectMode
                    ? "cell"
                    : "crosshair"
          }}
        />

        <canvas
          ref={(el) => {
            (sketchRef as React.MutableRefObject<HTMLCanvasElement | null>).current = el;
            if (el && !sketchMasterCanvas) {
              sketchMasterCanvas = document.createElement("canvas");
              sketchMasterCanvas.width  = el.width;
              sketchMasterCanvas.height = el.height;
            }
          }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: drawMode === "none" ? "none" : "auto",
          }}
          className={
            drawMode === "pencil" || drawMode === "line"
              ? "sketch-pencil-cursor"
              : drawMode === "eraser"
                ? "sketch-eraser-cursor"
                : undefined
          }
        />

        {/* ▶ cross-hair overlay (click-through) */}
        <canvas
          ref={overlayRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Live X-coordinate overlay */}
      {(equalizingTips || (calibrating && (calStep === "pick1" || calStep === "pick2"))) && (
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
          X: {Math.round(calCursorX)}
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

    </div>
  );
}
