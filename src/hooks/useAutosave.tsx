// src/hooks/useAutosave.tsx
import { useEffect, useState, useRef } from "react";
import { mkdir, writeFile, readTextFile, BaseDirectory } from "@tauri-apps/plugin-fs";
import type { Dot } from "../utils/tree";

// ───── What we actually need to save & restore ─────
export interface AutosaveConfig {
  dots: Dot[];
  tipNames: string[];
  img: HTMLImageElement | null;
  sketchMasterCanvas: HTMLCanvasElement | null;
  isBlankCanvasMode: boolean;

  setDots(value: Dot[] | ((prev: Dot[]) => Dot[])): void;
  setTipNames(value: string[] | ((prev: string[]) => string[])): void;
  setImg(image: HTMLImageElement | null): void;
  setGrayImg(image: HTMLImageElement | null): void;
  setIsBlankCanvasMode(value: boolean): void;
}

/* ───── Where we write the file ───── */
const AUTOSAVE_NAME = "treemble_autosave.json";
const ensureAppDataDir = mkdir("", {
  baseDir: BaseDirectory.AppLocalData,
  recursive: true,
}).catch(() => { /* ignore if dir exists or no permission */ });

export function useAutosave(cfg: AutosaveConfig) {
  const [pendingAutosave, setPendingAutosave] = useState<string | null>(null);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);

  /* ──────────────────────────────────────────────────────────────────
     Caching heavy encodings to avoid UI stutter
     ------------------------------------------------------------------
     We keep Base64 strings of the colour image and sketch layer in refs
     (`imgDataRef`, `sketchDataRef`).  These are regenerated ONLY when
     the underlying source actually changes (on new image load or when
     we receive a "sketch-updated" event).  Autosave can then assemble
     and write a snapshot in a few microseconds, eliminating the 5-second
     spike that previously froze the overlay every cycle.
  ────────────────────────────────────────────────────────────────── */

  const imgDataRef     = useRef<string | null>(null);
  const sketchDataRef  = useRef<string | null>(null);
  const pendingSketchRef = useRef<string | null>(null);   // for restores before canvas exists
  const prevImgRef      = useRef<HTMLImageElement | null>(null);

  // Encode the loaded image exactly once
  useEffect(() => {
    if (!cfg.img || cfg.img === prevImgRef.current) return;

    const encode = () => {
      const off = document.createElement("canvas");
      off.width  = cfg.img!.width;
      off.height = cfg.img!.height;
      const ctx = off.getContext("2d")!;
      ctx.drawImage(cfg.img!, 0, 0);
      imgDataRef.current = off.toDataURL("image/png");
      prevImgRef.current = cfg.img;
    };

    // Run when the browser is idle to avoid a jank frame
    (window as any).requestIdleCallback?.(encode, { timeout: 2000 }) || setTimeout(encode, 0);
  }, [cfg.img]);

  // Encode the master sketch bitmap whenever it changes
  useEffect(() => {
    function handle() {
      if (!cfg.sketchMasterCanvas) return;
      const encode = () => {
        sketchDataRef.current = cfg.sketchMasterCanvas!.toDataURL("image/png");
      };
      (window as any).requestIdleCallback?.(encode, { timeout: 2000 }) || setTimeout(encode, 0);
    }
    window.addEventListener("sketch-updated", handle);
    return () => window.removeEventListener("sketch-updated", handle);
  }, [cfg.sketchMasterCanvas]);

  /** Build a minimal JSON blob with dots, tipNames, imageData, sketchData */
  const buildSnapshot = (): Uint8Array => {
    const { dots, tipNames, isBlankCanvasMode } = cfg;


    const state = {
      dots,
      tipNames,
      imageData: imgDataRef.current,
      sketchData: sketchDataRef.current,
      isBlankCanvasMode,
    };

    return new TextEncoder().encode(JSON.stringify(state));
  };

  /** Apply a saved JSON string back into dots, tipNames, img, sketch canvas */
  const applySnapshot = (json: string) => {
    const saved = JSON.parse(json);
    cfg.setIsBlankCanvasMode(saved.isBlankCanvasMode);
    console.log("[Autosave] Applying snapshot…"); // single line

    // 1) restore dots & tipNames
    cfg.setDots(saved.dots);
    cfg.setTipNames(saved.tipNames)


    // 2) restore colour → setImg, then build grayscale
    if (saved.imageData) {
      const i = new Image();
      i.onload = () => {
        cfg.setImg(i);

        // build grayscale copy
        const off = document.createElement("canvas");
        off.width = i.width;
        off.height = i.height;
        const ctx = off.getContext("2d")!;
        ctx.drawImage(i, 0, 0);
        const imgd = ctx.getImageData(0, 0, off.width, off.height);
        for (let p = 0; p < imgd.data.length; p += 4) {
          const lum = 0.3 * imgd.data[p] + 0.59 * imgd.data[p + 1] + 0.11 * imgd.data[p + 2];
          imgd.data[p] = imgd.data[p + 1] = imgd.data[p + 2] = lum;
        }
        ctx.putImageData(imgd, 0, 0);
        const g = new Image();
        g.onload = () => cfg.setGrayImg(g);
        g.src = off.toDataURL();
      };
      i.src = saved.imageData;
    } else {
      cfg.setIsBlankCanvasMode(true);
    }

    // 3) restore sketch bitmap into master canvas
    if (saved.sketchData) {
      if (cfg.sketchMasterCanvas) {
        // canvas ready → restore immediately
        const master = cfg.sketchMasterCanvas;
        const tmp = new Image();
        tmp.onload = () => {
          master.width = tmp.width;
          master.height = tmp.height;
          const mctx = master.getContext("2d")!;
          mctx.clearRect(0, 0, master.width, master.height);
          mctx.drawImage(tmp, 0, 0);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("sketch-updated", {
              detail: { width: master.width, height: master.height, image: master.toDataURL() }
            }));
          }
        };
        tmp.src = saved.sketchData;
      } else {
        // hold until sketchMasterCanvas exists
        pendingSketchRef.current = saved.sketchData;
      }
    }
  };

  // ─── ① on mount, try to load any existing file ─────────────────
  useEffect(() => {
    (async () => {
      try {
        const txt = await readTextFile(AUTOSAVE_NAME, {
          baseDir: BaseDirectory.AppLocalData,
        });
        console.log("[Autosave] Found existing file.");  // keep just a short confirmation
        setPendingAutosave(txt);
        setShowRestorePrompt(true);
      } catch {
        /* no console output here—silently ignore “no file” */
      }
    })();
  }, []);

  // ─── ② every 5s, write our minimal snapshot ──────────────────
  useEffect(() => {
    // ─── If a restore snapshot is pending, pause autosave ───
    if (pendingAutosave) {
      return;
    }

    const id = setInterval(async () => {
      try {
        await ensureAppDataDir;
        await writeFile(AUTOSAVE_NAME, buildSnapshot(), {
          baseDir: BaseDirectory.AppLocalData,
        });
        console.log("[Autosave] Snapshot successfully written.");
      } catch (err) {
        console.error("[Autosave] write failed:", err);
      }
    }, 5_000);

    return () => clearInterval(id);
  }, [
    cfg.dots,
    cfg.tipNames,
    pendingAutosave,
  ]);

  // ─── Resume deferred sketch restoration when canvas becomes available ──
  useEffect(() => {
    if (!pendingSketchRef.current || !cfg.sketchMasterCanvas) return;
    const data = pendingSketchRef.current;
    pendingSketchRef.current = null;
    const master = cfg.sketchMasterCanvas;
    const img = new Image();
    img.onload = () => {
      master!.width = img.width;
      master!.height = img.height;
      const mctx = master!.getContext("2d")!;
      mctx.clearRect(0, 0, master!.width, master!.height);
      mctx.drawImage(img, 0, 0);
      window.dispatchEvent(new CustomEvent("sketch-updated", {
        detail: { width: master!.width, height: master!.height, image: master!.toDataURL() }
      }));
    };
    img.src = data;
  }, [cfg.sketchMasterCanvas]);

  // ─── ③ expose a single “Restore” handler ──────────────────────
  const handleRestorePrevious = () => {
    if (!pendingAutosave) return;
    applySnapshot(pendingAutosave);
    setPendingAutosave(null);
    setShowRestorePrompt(false);
  };
  // ─── ④ hide prompt if user loads brand-new data manually ───────
  useEffect(() => {
    if (showRestorePrompt && cfg.img) {
      // User has started a fresh session without restoring the previous snapshot.
      // Dismiss the overlay AND clear any pending snapshot so that autosave resumes.
      setShowRestorePrompt(false);
      setPendingAutosave(null);
    }
  }, [cfg.img, showRestorePrompt]);

  // ─── ⑤ small overlay JSX to render in CanvasPanel ─────────────
  const RestorePromptOverlay = !showRestorePrompt ? null : (
    <div
      style={{
        position: "absolute",
        top: 15,
        left: 15,
        zIndex: 1,
        background: "rgba(255,255,255,0.9)",
        padding: "4px",
        borderRadius: "4px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
      }}
    >
      <button
        onClick={handleRestorePrevious}
        style={{
          padding: "4px 8px",
          fontSize: "0.85em",
          lineHeight: 1,
          whiteSpace: "nowrap",
        }}
      >
        Restore Last Session?
      </button>
    </div>
  );

  return { RestorePromptOverlay };
}
