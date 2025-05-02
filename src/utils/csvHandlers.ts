// src/utils/csvHandlers.ts
import { Dot, DotType } from "./tree";
import { emitTo } from "@tauri-apps/api/event";
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeFile, readTextFile } from "@tauri-apps/plugin-fs";
import type { Dispatch, SetStateAction, MutableRefObject } from "react";

/**
 * Save dots + optional tip names to a CSV.
 */
export async function saveCSV(
    dots: Dot[],
    tipNames: string[],
    baseName: string,
    setBanner: Dispatch<SetStateAction<{ text: string; type: "success" | "error" } | null>>,
  ) {
    const header = tipNames.length ? "x,y,type,name\n" : "x,y,type\n";
  
    // 1️ Build tipIndexes = indexes of tips sorted top to bottom
    const tipIndexes = dots
      .map((d, idx) => ({ ...d, idx }))
      .filter(d => d.type === "tip")
      .sort((a, b) => a.y - b.y)
      .map(d => d.idx);
  
    // 2️ Map each dot to a row; for tips, find its position in tipIndexes to look up its name
    const rows = dots.map((d, i) => {
      const base = `${d.x},${d.y},${d.type}`;
      if (d.type === "tip" && tipNames.length) {
        const tipOrder = tipIndexes.indexOf(i);
        const name = tipOrder >= 0 ? tipNames[tipOrder] : "";
        return `${base},${name}`;
      }
      return base;
    }).join("\n");
  
    const csv = header + rows;
    const path = await save({
      defaultPath: `${baseName}_node_locations.csv`,
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
    if (path) {
      await writeFile(path, new TextEncoder().encode(csv));
      setBanner({ text: `CSV saved: ${path}`, type: "success" });
      setTimeout(() => setBanner(null), 3000);
    }
  }
  
  

/**
 * Load dots + optional tip names from a CSV.
 */
export async function loadCSV(
    setDots: Dispatch<SetStateAction<Dot[]>>,
    setTipNames: Dispatch<SetStateAction<string[]>>,
    setBanner: Dispatch<SetStateAction<{ text: string; type: "success" | "error" } | null>>,
    tipNamesRef: MutableRefObject<string[]>,
  ) {
    const path = await open({
      filters: [{ name: "CSV", extensions: ["csv"] }],
      multiple: false,
    });
    if (!path || Array.isArray(path)) return;
    try {
      const text = await readTextFile(path);
      const lines = text.trim().split(/\r?\n/);
      const header = lines[0].toLowerCase().trim();
      const hasName = header.startsWith("x,y,type,name");
  
      if (!header.startsWith("x,y,type")) {
        throw new Error("Missing or malformed CSV header");
      }
  
      const newDots: Dot[] = [];
      const tipDots: { dot: Dot; name: string }[] = [];
  
      lines.slice(1).forEach((ln, i) => {
        const cols = ln.split(",");
        if (cols.length < 3) throw new Error(`Line ${i + 2} malformed`);
        const [xs, ys, tp] = cols;
        const name = hasName && cols[3] ? cols[3].trim() : "";
        const x = Number(xs), y = Number(ys);
        if (isNaN(x) || isNaN(y)) throw new Error(`Bad coords at line ${i + 2}`);
        if (!["tip", "internal", "root"].includes(tp))
          throw new Error(`Bad type '${tp}' at line ${i + 2}`);
  
        const dot: Dot = { x, y, type: tp as DotType };
        newDots.push(dot);
  
        if (tp === "tip") {
          tipDots.push({ dot, name });
        }
      });
  
      // Sort tipDots top to bottom and extract names in that order
      const sortedTipNames = tipDots
        .sort((a, b) => a.dot.y - b.dot.y)
        .map(t => t.name)
        .filter(Boolean);  // Remove empty strings
  
      setDots(newDots);
  
      if (sortedTipNames.length) {
        setTipNames(sortedTipNames);
        tipNamesRef.current = sortedTipNames;
  
        // push immediately if the editor is open
        emitTo("tip-editor", "update-tip-editor", {
          text: sortedTipNames.join("\n"),
          tipCount: newDots.filter((d) => d.type === "tip").length,
        }).catch(() => { /* ignore if editor isn't open */ });
  
        setBanner({
          text: `Loaded ${newDots.length} nodes and ${sortedTipNames.length} tip names.`,
          type: "success"
        });
      } else {
        setTipNames([]);
        tipNamesRef.current = [];
        emitTo("tip-editor", "update-tip-editor", {
          text: "",
          tipCount: newDots.filter((d) => d.type === "tip").length,
        }).catch(() => {});
  
        setBanner({
          text: `Loaded ${newDots.length} nodes.`,
          type: "success"
        });
      }
  
      setTimeout(() => setBanner(null), 3000);
    } catch (err: any) {
      console.error("Error loading CSV:", err);
      setBanner({
        text: `Error loading CSV: ${err?.message ?? String(err)}`,
        type: "error"
      });
      setTimeout(() => setBanner(null), 6000);
    }
  }
  
  
