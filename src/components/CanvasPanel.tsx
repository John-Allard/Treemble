// src/components/CanvasPanel.tsx
import React, { useRef, useState, useEffect } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { writeFile, readTextFile } from "@tauri-apps/plugin-fs";
import Toolbar from "./Toolbar";
import { computePartialTree, Dot, DotType, Edge } from "../utils/tree";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { emitTo } from "@tauri-apps/api/event";
import { listen } from "@tauri-apps/api/event";
import { saveCSV, loadCSV } from "../utils/csvHandlers";
import { useDragAndDrop } from "../utils/useDragAndDrop";
import { buildCSVString } from "../utils/csvHandlers";

const DOT_R = 8;
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

  // about
  const [showAboutModal, setShowAboutModal] = useState(false);

  // confirm equalize
  const [showConfirmEqualizeModal, setShowConfirmEqualizeModal] = useState(false);

  // Image state
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [grayImg, setGrayImg] = useState<HTMLImageElement | null>(null);
  const [baseName, setBaseName] = useState("tree");

  // Dot state
  const [dots, setDots] = useState<Dot[]>([]);
  const tipCount = dots.filter(d => d.type === "tip").length;
  const [mode, setMode] = useState<DotType>("tip");
  const hasRoot = dots.some(d => d.type === "root");

  // Zoom & pan
  const [scale, setScale] = useState(1);
  const [fontSize, setFontSize] = useState(12);
  const [panning, setPanning] = useState(false);
  const panStart = useRef<{ sl: number, st: number, x: number, y: number }>();

  // Node dragging
  const [draggingNodeIndex, setDraggingNodeIndex] = useState<number | null>(null);
  const wasDragging = useRef(false);
  const [hoveringNodeIndex, setHoveringNodeIndex] = useState<number | null>(null);
  const dragFrame = useRef<number | null>(null);

  // ─── Scale-bar calibration ────────────────────────────────
  const [calibrating, setCalibrating] = useState(false);
  const [calStep, setCalStep] = useState<"pick1" | "pick2" | "units" | null>(null);
  const [calX1, setCalX1] = useState<number | null>(null);
  const [calX2, setCalX2] = useState<number | null>(null);
  const [showUnitsPrompt, setShowUnitsPrompt] = useState(false);
  const [unitsInput, setUnitsInput] = useState("");
  const [calCursorX, setCalCursorX] = useState<number>(0);

  // BW toggle
  const [bw, setBW] = useState(false);

  // Tree overlay
  const [showTree, setShowTree] = useState(false);
  const [treeReady, setTreeReady] = useState(false);

  // tip-detect UI state
  const [tipDetectMode, setTipDetectMode] = useState(false);
  const [selStart, setSelStart] = useState<{ x: number; y: number } | null>(null);
  const [selRect, setSelRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Misc
  const [edges, setEdges] = useState<Edge[]>([]);
  const [freeNodes, setFreeNodes] = useState<number[]>([]);
  const [banner, setBanner] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [newick, setNewick] = useState("");
  const [showNewickModal, setShowNewickModal] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const modalPrimaryRef = useRef<HTMLButtonElement>(null);
  
  // Last save path
  const [lastSavePath, setLastSavePath] = useState<string | null>(null);

  // Branch-length scale (units per pixel). 1 = raw pixels.
  const [timePerPixel, setTimePerPixel] = useState(1);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  // Custom tip names
  const [tipNames, setTipNames] = useState<string[]>([]);
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

  function drawOverlay() {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Clear overlay
    ctx.clearRect(0, 0, w, h);

    const cur = cursorRef.current;
    if (!cur) return;

    ctx.setLineDash([4, 2]);
    ctx.strokeStyle = "rgba(0,0,0,0.75)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cur.x * scale, 0);
    ctx.lineTo(cur.x * scale, h);
    ctx.moveTo(0, cur.y * scale);
    ctx.lineTo(w, cur.y * scale);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Toggle tree overlay
  const toggleTree = () => {
    setFileMenuOpen(false);
    setShowTree(prev => {
      if (prev) setBanner(null);   // ← clear the banner if hiding
      return !prev;
    });
  };

  // ─── Scale calibration helpers ────────────────────────────
  const startCalibration = () => {
    if (calibrating) {
      // cancel calibration
      setCalibrating(false);
      setCalStep(null);
      setCalX1(null);
      setCalX2(null);
      setShowUnitsPrompt(false);
      setBanner(null);
    } else {
      // start calibration
      setCalibrating(true);
      setCalStep("pick1");
      setCalX1(null);
      setCalX2(null);
      setBanner({
        text: "Calibration: click the initial point.",
        type: "success"
      });
    }
  };

  useDragAndDrop(
    setImg,
    setGrayImg,
    setDots,
    setTipNames,
    setBanner,
    setBaseName,
    setScale,
    setShowTree,
    setEdges,
    setFreeNodes,
    setNewick,
    setShowNewickModal,
    tipNamesRef,
    dotsRef,
    setDragOver,
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

      const tipDots = dots.filter(d => d.type === "tip");
      if (tipNames.length && tipNames.length !== tipDots.length) {
        setBanner({
          text: `Warning: Tip names (${tipNames.length}) ≠ tip dots (${tipDots.length}).`,
          type: "error"
        });
        setFreeNodes([]);
        setNewick("");
        setTreeReady(false);
        return;
      }

      const { edges, free, newick } = computePartialTree(dots, timePerPixel, tipNames.length ? tipNames : undefined);
      if (Array.isArray(edges) && Array.isArray(free) && typeof newick === "string") {
        setEdges(edges);
        setFreeNodes(free);
        setNewick(newick);
        setTreeReady(free.length === 0);
      }

      if (free.length === 1) {
        setBanner({
          text: "One node is not fully connected.",
          type: "error"
        });
      } else if (free.length > 1) {
        setBanner({
          text: `There are ${free.length} nodes not fully connected.`,
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
  }, [dots, showTree, tipNames, timePerPixel]);

  // ── Resize overlay canvas only when the image or zoom changes ──
  useEffect(() => {
    if (!img || !overlayRef.current) return;
    const w = img.width * scale;
    const h = img.height * scale;
    const overlay = overlayRef.current;
    // only resize (and thus clear) if dimensions actually changed
    if (overlay.width !== w || overlay.height !== h) {
      overlay.width = w;
      overlay.height = h;
    }
  }, [img, scale]);

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

    // Tip labels (if tree is shown and names exist)
    if (showTree && tipNames && tipNames.length) {
      const tips = dots
        .map((d, i) => ({ ...d, index: i }))
        .filter(d => d.type === "tip")
        .sort((a, b) => a.y - b.y);  // top to bottom order

      ctx.font = `${fontSize * scale}px sans-serif`;
      ctx.fillStyle = "#00ff00";  // lime green
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
  }, [img, grayImg, bw, dots, edges, freeNodes, showTree, scale, selRect, tipNames, fontSize]);

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

  // Keyboard shortcuts
  useEffect(() => {
    console.log("[useEffect] mounting keydown listener, img=", img);
    const handleKeyDown = (e: KeyboardEvent) => {
      console.log("[handleKeyDown] fired for key:", e.key, "ctrl:", e.ctrlKey, "meta:", e.metaKey);
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
        setMode("tip");
        e.preventDefault();
      } else if (key === "i" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setMode("internal");
        e.preventDefault();
      } else if (key === "r" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setMode("root");
        e.preventDefault();
  
      // Tip-detect toggle
      } else if (key === "d" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setTipDetectMode(prev => !prev);
        e.preventDefault();
  
      // Calibration
      } else if (key === "c" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        startCalibration();
        e.preventDefault();
      
      } else if (key === "e" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setShowConfirmEqualizeModal(true);
        // defer clicking the modal "Yes" button until it mounts
        
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

    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [img, scale, toggleTree, startCalibration]);

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

  const saveCSVHandler = async () => {
    setFileMenuOpen(false);
    const path = await saveCSV(dots, tipNames, baseName, setBanner);
    if (path) {
      setLastSavePath(path);
    }
  };

  const loadCSVHandler = () => {
    setFileMenuOpen(false);
    loadCSV(setDots, setTipNames, setBanner, tipNamesRef);
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
      setDots([]);
      setShowTree(false);
      setEdges([]);
      setFreeNodes([]);
      setBanner(null);
      setNewick("");
      setShowNewickModal(false);
      setTipNames([]);

      emitTo("tip-editor", "update-tip-editor", {
        text: "",
        tipCount: 0,
      }).catch(() => { /* editor may not exist yet; ignore */ });

      setBaseName(f.name.replace(/\.[^/.]+$/, ""));
    };
    i.src = URL.createObjectURL(f);
  };

  // Mouse & dot handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // ───── Calibration disables normal mousedown ─────
    if (calibrating && e.button !== 2) {
      return;
    }

    /* ───── TIP-DETECT: start rectangle ───── */
    if (tipDetectMode && e.button === 0) {
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

      setSelStart({ x, y });
      setSelRect({ x, y, w: 0, h: 0 });   // zero-size rect so it draws right away
      draggingForTips.current = true;
      e.preventDefault();                 // stop text-selection & scrolling
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
    if (calibrating && (calStep === "pick1" || calStep === "pick2")) {
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

      // ── throttle to 1 update per animation frame ──
      if (dragFrame.current === null) {
        dragFrame.current = requestAnimationFrame(() => {
          setDots(prev => {
            const next = [...prev];
            next[draggingNodeIndex] = { ...next[draggingNodeIndex], x, y };
            return next;
          });
          dragFrame.current = null;
        });
      }
      drawOverlay();          // lightweight – keep live cross‑hairs responsive
      return;
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

  const handleMouseUp = () => {
    // Stop dragging
    if (draggingNodeIndex !== null) {
      setDraggingNodeIndex(null);
    }

    /* ───── finish tip detection ───── */
    if (tipDetectMode && selStart && selRect && img) {
      import("../utils/detectTips").then(({ detectTipsInRect }) => {
        const tips = detectTipsInRect(img, {
          x: Math.round(selRect.x),
          y: Math.round(selRect.y),
          width: Math.round(selRect.w),
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
    if (wasDragging.current) {
      // This click is from a drag, ignore it
      wasDragging.current = false;
      return;
    }

    // ── Calibration click handling ────────────────────────────
    if (calibrating) {
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
        mode={mode}
        loadImage={loadImage}
        setMode={setMode}
        fileMenuOpen={fileMenuOpen}
        setFileMenuOpen={setFileMenuOpen}
        fileMenuRef={fileMenuRef}
        chooseImage={chooseImage}
        saveCSVHandler={saveCSVHandler}
        loadCSVHandler={loadCSVHandler}
        addTipNamesHandler={addTipNamesHandler}
        tipDetectMode={tipDetectMode}
        openTipEditor={openTipEditor}
        toggleTipDetectMode={() => {
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
        imgLoaded={!!img}
        tipCount={tipCount}
        dotCount={dots.length}
        isDarkMode={isDarkMode}
        toggleShowTree={toggleTree}
        showTree={showTree}
        hasRoot={hasRoot}
        treeReady={treeReady}
        openEqualizeModal={() => setShowConfirmEqualizeModal(true)}
        openNewickModal={() => setShowNewickModal(true)}
        startCalibration={startCalibration}
        calibrating={calibrating}
        bw={bw}
        toggleBW={() => setBW(prev => !prev)}
        openAboutModal={() => setShowAboutModal(true)}
      />

      {/* Canvas area */}
      <div
        ref={contRef}
        style={{ flex: 1, overflow: "auto", position: "relative" }}
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
          ref={overlayRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: "none",  // allows mouse events to pass through
          }}
        />
      </div>

      {/* Live X-coordinate overlay */}
      {calibrating && (calStep === "pick1" || calStep === "pick2") && (
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

      {showConfirmEqualizeModal && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", justifyContent: "center", alignItems: "center"
          }}
          onClick={() => setShowConfirmEqualizeModal(false)}
        >
          <div
            className="modal-panel"
            style={{
              padding: 20,
              width: 300,
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3>Equalize Tips</h3>
            <p style={{ margin: "10px 0 20px" }}>
              Set all tips to their average X value?
            </p>
            <div style={{ textAlign: "right" }}>
              <button ref={modalPrimaryRef}
                className="modal-button"
                onClick={() => {
                  const tips = dots.filter(d => d.type === "tip");
                  const avgX = tips.reduce((sum, d) => sum + d.x, 0) / tips.length;
                  const newDots = dots.map(d =>
                    d.type === "tip" ? { ...d, x: avgX } : d
                  );
                  setDots(newDots);
                  setBanner({ text: "Tips equalized!", type: "success" });
                  setTimeout(() => setBanner(null), 3000);
                  setShowConfirmEqualizeModal(false);
                }}
              >
                Yes
              </button>{" "}
              <button
                className="modal-button"
                onClick={() => setShowConfirmEqualizeModal(false)}
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

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
            className="modal-panel"
            style={{
              padding: 20,
              width: 400,
              maxWidth: "90%"
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3>Newick string</h3>
            <textarea
              readOnly
              value={newick}
              style={{ width: "100%", height: 120 }}
            />
            {timePerPixel === 1 ? (
              <p style={{ fontSize: "0.85em", marginTop: 6 }}>
                Lengths are expressed in raw pixel counts and have not been calibrated.
              </p>
            ) : (
              <p style={{ fontSize: "0.85em", marginTop: 6 }}>
                Lengths calibrated to {timePerPixel.toFixed(6)} units per pixel.
              </p>
            )}
            <div style={{ textAlign: "right", marginTop: 8 }}>
              <button ref={modalPrimaryRef}
                className="modal-button"
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
              <button className="modal-button" onClick={() => setShowNewickModal(false)}>Close</button>
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
            className="modal-panel"
            style={{ padding: 20, width: 360, maxWidth: "90%", textAlign: "center" }}
            onClick={e => e.stopPropagation()}
          >
            <h3>Treemble v1.1</h3>
            <p style={{ marginBottom: 10 }}>Created by John B. Allard</p>
            <p style={{ fontSize: "0.9em" }}>
              © 2025 John Allard. All rights reserved.<br /><br />
              You can use Tip Name Extractor GPT to generate a tip names text file for the species names in a tree image: https://chatgpt.com/g/g-rwiIPwboh-tip-name-extractor
            </p>
            <div style={{ marginTop: 12 }}>
              <button ref={modalPrimaryRef} className="modal-button" onClick={() => setShowAboutModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Units prompt */}
      {showUnitsPrompt && (
        <div
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex", justifyContent: "center", alignItems: "center"
          }}
          onClick={() => {/* block outside clicks */ }}
        >
          <div className="modal-panel" style={{ padding: 20, width: 300 }} onClick={e => e.stopPropagation()}>
            <h3>Scale Calibration</h3>
            <p style={{ margin: "6px 0 8px" }}>
              Enter the length represented by the selected interval:
            </p>
            <input
              type="number"
              value={unitsInput}
              onChange={e => setUnitsInput(e.target.value)}
              style={{
                width: "calc(100% - 12px)",
                marginBottom: 10,
                padding: "6px",
                boxSizing: "border-box",
                borderRadius: "4px",
                border: "1px solid #ccc",
                background: "#fafafa"
              }}
            />
            <div style={{ textAlign: "right" }}>
              <button ref={modalPrimaryRef}
                className="modal-button"
                onClick={() => {
                  const u = parseFloat(unitsInput);
                  if (isNaN(u) || u <= 0 || calX1 == null || calX2 == null) {
                    alert("Please enter a positive number."); return;
                  }
                  const dx = Math.abs(calX2 - calX1);
                  const upx = u / dx;
                  setTimePerPixel(upx);
                  setShowUnitsPrompt(false);
                  setCalibrating(false);
                  setCalStep(null);
                  setBanner({
                    text: `Branch lengths calibrated to ${upx.toFixed(6)} units per pixel.`,
                    type: "success"
                  });
                  setTimeout(() => setBanner(null), 3000);
                }}
              >OK</button>{" "}
              <button
                className="modal-button"
                onClick={() => {
                  setShowUnitsPrompt(false);
                  setCalibrating(false);
                  setCalStep(null);
                  setBanner(null);
                }}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Tip count overlay */}
      <div style={{
        position: "absolute",
        top: 65,
        right: 12,
        background: "rgba(255,255,255,0.9)",
        padding: "4px 8px",
        borderRadius: "4px",
        fontSize: "13px",
        fontWeight: "bold",
        color: "#333"
      }}>
        Tip nodes: {dots.filter(d => d.type === "tip").length}
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

    </div>
  );
}
