// src/hooks/useKeyboardShortcuts.ts
import { useEffect, useRef } from "react";
import { writeFile } from "@tauri-apps/plugin-fs";
import { buildCSVString } from "../utils/csvHandlers";
import { useCanvasContext } from "../context/CanvasContext";
import { Dot } from "../utils/tree";

export interface KeyboardShortcutOptions {
  zoom: (factor: number, cx: number, cy: number) => void;
  saveCSVHandler: () => void;
}

export function useKeyboardShortcuts({ zoom, saveCSVHandler }: KeyboardShortcutOptions) {
  const {
    img,
    treeShape,
    geometry,
    setFontSize,
    setBW,
    setMode,
    setTipDetectMode,
    toggleTipDetectMode,
    selectingCentre,
    selectingBreak,
    startCalibration,
    setBanner,
    lastSavePath,
    dots,
    tipNames,
    isBlankCanvasMode,
    showUnitsPrompt,
    setShowTree,
    setToolMode,
    openEqualizeModal,
  } = useCanvasContext();

  const dotsRef = useRef<Dot[]>(dots);
  const tipNamesRef = useRef<string[]>(tipNames);
  useEffect(() => { dotsRef.current = dots; }, [dots]);
  useEffect(() => { tipNamesRef.current = tipNames; }, [tipNames]);

  const toggleTree = () => {
    setShowTree(prev => {
      if (prev) setBanner(null);
      return !prev;
    });
  };
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
        if (treeShape === "circular" && !geometry.getCentre()) {
          setBanner({ text: "The center and break point must be selected before a circular tree can be shown.", type: "error" });
        } else {
          toggleTree();
        }
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
        setTipDetectMode(false);
        setMode("tip");
        e.preventDefault();
      } else if (key === "i" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setTipDetectMode(false);
        setMode("internal");
        e.preventDefault();
      } else if (key === "r" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setTipDetectMode(false);
        setMode("root");
        e.preventDefault();

        // Tip-detect toggle
      } else if (key === "d" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        toggleTipDetectMode();
        e.preventDefault();

        // Calibration
      } else if (key === "c" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (selectingCentre || selectingBreak) {
          setBanner({ text: "Finish Center & Break first", type: "error" });
        } else if (treeShape === "circular" && !geometry.getCentre()) {
          setBanner({ text: "Configure center & break point first", type: "error" });
        } else {
          startCalibration();
        }
        e.preventDefault();

        // Equalize tips
      } else if (key === "e" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        openEqualizeModal();
        e.preventDefault();

        // Control+S to quicksave
      } else if (key === "s" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
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
          setToolMode("drawPencil");
          e.preventDefault();
          return;
        } else if (key === "l") {          // 📏  Line
          setToolMode("drawLine");
          e.preventDefault();
          return;
        } else if (e.key === "Backspace") { // 🧽  Eraser
          if (showUnitsPrompt) return;
          setToolMode("drawEraser");
          e.preventDefault();
          return;
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [img, zoom, startCalibration, toggleTipDetectMode]);
}
