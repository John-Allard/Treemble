// src/utils/csvHandlers.ts
import { Dot, DotType } from "./tree";
import { emitTo } from "@tauri-apps/api/event";
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeFile, readTextFile } from "@tauri-apps/plugin-fs";
import type { Dispatch, SetStateAction, MutableRefObject } from "react";

// ────────────────────────────────────────────────────────────
// Bounds-check helper – returns any nodes falling outside img
// ────────────────────────────────────────────────────────────
export function findOutOfBoundsDots(
  dots: Dot[],
  imgW: number,
  imgH: number,
): Dot[] {
  if (imgW <= 0 || imgH <= 0) return [];          // no image – skip
  return dots.filter(d => d.x < 0 || d.y < 0 || d.x >= imgW || d.y >= imgH);
}

/**
 * Build the CSV text for dots + optional tip names, but do NOT prompt or write.
 */
export function buildCSVString(
  dots: Dot[],
  tipNames: string[],
): string {
  const header = tipNames.length ? "x,y,type,name\n" : "x,y,type\n";

  // Build tipIndexes = indexes of tips sorted top to bottom
  const tipIndexes = dots
    .map((d, idx) => ({ ...d, idx }))
    .filter(d => d.type === "tip")
    .sort((a, b) => a.y - b.y)
    .map(d => d.idx);

  const rows = dots.map((d, i) => {
    const base = `${d.x},${d.y},${d.type}`;
    if (d.type === "tip" && tipNames.length) {
      const nameIdx = tipIndexes.indexOf(i);
      // only use a name if it's a non-empty string and defined
      const candidate = (nameIdx >= 0 ? tipNames[nameIdx] : "");
      const raw = typeof candidate === "string" ? candidate.trim() : "";
      const name = raw.length > 0 ? raw : "";
      return `${base},${name}`;
    }
    return base;
  }).join("\n");

  return header + rows;
}

/**
 * Save dots + optional tip names to a CSV.
 */
export async function saveCSV(
  dots: Dot[],
  tipNames: string[],
  baseName: string,
  setBanner: Dispatch<SetStateAction<{ text: string; type: "success" | "error" } | null>>,
) {
  const csv = buildCSVString(dots, tipNames);

  const path = await save({
    defaultPath: `${baseName}_node_locations.csv`,
    filters: [{ name: "CSV", extensions: ["csv"] }],
  });
  if (path) {
    await writeFile(path, new TextEncoder().encode(csv));
    setBanner({ text: `CSV saved: ${path}`, type: "success" });
    setTimeout(() => setBanner(null), 3000);
    return path;
  }
  return null;
}

/**
 * Parse CSV text and return dots and tip names.
 */
export function parseCSVText(text: string): {
  dots: Dot[];
  tipNames: string[];
  tipPairs: { dot: Dot; name: string }[];
} {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].toLowerCase().trim();
  const hasNameCol = header.startsWith("x,y,type,name");

  if (!header.startsWith("x,y,type")) {
    throw new Error("CSV header must begin with 'x,y,type'");
  }

  const dots: Dot[] = [];
  const tipPairs: { dot: Dot; name: string }[] = [];

  lines.slice(1).forEach((ln, li) => {
    const cols = ln.split(",");
    if (cols.length < 3)
      throw new Error(`Line ${li + 2}: expected ≥3 columns`);

    const [xs, ys, tpRaw, nameRaw] = cols;
    const x = +xs,
      y = +ys,
      tp = tpRaw.trim();
    if (isNaN(x) || isNaN(y))
      throw new Error(`Line ${li + 2}: bad coordinates`);
    if (!["tip", "internal", "root"].includes(tp))
      throw new Error(`Line ${li + 2}: bad node type '${tp}'`);

    const dot: Dot = { x, y, type: tp as DotType };
    dots.push(dot);

    if (tp === "tip" && hasNameCol) {
      const nm = (nameRaw || "").trim();
      if (nm) {
        tipPairs.push({ dot, name: nm });
      } else {
        console.warn(`[CSV] blank tip name at line ${li + 2}`);
      }
    }
  });

  console.log(
    `[CSV] parsed dots=${dots.length}  tips=${tipPairs.length}`
  );
  const sortedTipNames = tipPairs
  .slice()
  .sort((a, b) => a.dot.y - b.dot.y)
  .map(p => p.name);

  return { dots, tipNames: sortedTipNames, tipPairs };
}

/**
 * Apply loaded dots and tip names to state, and update tip editor if needed.
 */
export async function applyCSVData(
  dots: Dot[],
  tipNames: string[],
  setDots: Dispatch<SetStateAction<Dot[]>>,
  setTipNames: Dispatch<SetStateAction<string[]>>,
  tipNamesRef: MutableRefObject<string[]>,
  setBanner: Dispatch<SetStateAction<{ text: string; type: "success" | "error" } | null>>,
) {
  setDots(dots);

  if (tipNames.length) {
    setTipNames(tipNames);
    tipNamesRef.current = tipNames;

    emitTo("tip-editor", "update-tip-editor", {
      text: tipNames.join("\n"),
      tipCount: dots.filter((d) => d.type === "tip").length,
    }).catch(() => { /* ignore if editor isn't open */ });

    setBanner({
      text: `Loaded ${dots.length} nodes and ${tipNames.length} tip names.`,
      type: "success"
    });
  } else {
    setTipNames([]);
    tipNamesRef.current = [];

    emitTo("tip-editor", "update-tip-editor", {
      text: "",
      tipCount: dots.filter((d) => d.type === "tip").length,
    }).catch(() => { });

    setBanner({
      text: `Loaded ${dots.length} nodes.`,
      type: "success"
    });
  }

  setTimeout(() => setBanner(null), 3000);
}

/**
 * Load dots + optional tip names from a CSV file using file picker.
 */
export async function loadCSV(
  setDots: Dispatch<SetStateAction<Dot[]>>,
  setTipNames: Dispatch<SetStateAction<string[]>>,
  setBanner: Dispatch<SetStateAction<{ text: string; type: "success" | "error" } | null>>,
  tipNamesRef: MutableRefObject<string[]>,
  imgDims?: { width: number; height: number },
) {
  const path = await open({
    filters: [{ name: "CSV", extensions: ["csv"] }],
    multiple: false,
  });
  if (!path || Array.isArray(path)) return;
  try {
    const text = await readTextFile(path);
    const { dots, tipNames } = parseCSVText(text);
    // Bounds check – abort load if any nodes are outside the image
    if (imgDims) {
      const bad = findOutOfBoundsDots(dots, imgDims.width, imgDims.height);
      if (bad.length) {
        setBanner({
          text: `CSV load aborted: ${bad.length} node${bad.length > 1 ? "s are" : " is"} outside the image bounds.`,
          type: "error"
        });
        setTimeout(() => setBanner(null), 6000);
        return;   // ⛔ stop – don’t apply dots
      }
    }
    await applyCSVData(dots, tipNames, setDots, setTipNames, tipNamesRef, setBanner);
  } catch (err: any) {
    console.error("Error loading CSV:", err);
    setBanner({
      text: `Error loading CSV: ${err?.message ?? String(err)}`,
      type: "error"
    });
    setTimeout(() => setBanner(null), 6000);
  }
}

/**
 * Load CSV data from a text string (for drag & drop etc.)
 */
export async function loadCSVFromText(
  text: string,
  setDots: Dispatch<SetStateAction<Dot[]>>,
  setTipNames: Dispatch<SetStateAction<string[]>>,
  setBanner: Dispatch<SetStateAction<{ text: string; type: "success" | "error" } | null>>,
  tipNamesRef: MutableRefObject<string[]>,
  imgDims?: { width: number; height: number },
) {
  console.log("💥 loadCSVFromText called — text preview:", text.slice(0, 80));
  // 🔍 DEBUG: who is calling me, and when?
  console.groupCollapsed(
    `%c[TRACE] loadCSVFromText called – ${new Date().toLocaleTimeString()}`,
    "color:#007; font-weight:bold"
  );
  console.trace();
  console.groupEnd();

  try {
    const { dots, tipNames } = parseCSVText(text);
    if (imgDims) {
      const bad = findOutOfBoundsDots(dots, imgDims.width, imgDims.height);
      if (bad.length) {
        setBanner({
          text: `CSV load aborted: ${bad.length} node${bad.length > 1 ? "s are" : " is"} outside the image bounds.`,
          type: "error"
        });
        setTimeout(() => setBanner(null), 6000);
        return;   // ⛔ block load
      }
    }
    await applyCSVData(dots, tipNames, setDots, setTipNames, tipNamesRef, setBanner);
  } catch (err: any) {
    console.error("Error loading CSV from text:", err);
    setBanner({
      text: `Error loading CSV: ${err?.message ?? String(err)}`,
      type: "error"
    });
    setTimeout(() => setBanner(null), 6000);
  }
}

/**
 * Diff current tip names (by visual top-to-bottom order) against names in csvText.
 * Flags mismatches with ⚠️⚠️⚠️ and preserves the original array order.
 */
export async function diffTipNamesFromText(
  currentDots: Dot[],
  currentNames: string[],
  csvText: string,
  setTipNames: Dispatch<SetStateAction<string[]>>,
  tipNamesRef: MutableRefObject<string[]>,
  setBanner: Dispatch<SetStateAction<{ text: string; type: "success" | "error" } | null>>,
): Promise<{ updatedNames: string[] } | null> {
  try {
    const tipDots = currentDots.filter(d => d.type === "tip");
    const { tipPairs } = parseCSVText(csvText);

    if (tipDots.length !== tipPairs.length) {
      const msg = `Diff aborted: Tip count mismatch – ${tipDots.length} nodes vs ${tipPairs.length} in file.`;
      console.warn(`[DIFF] ${msg}`);
      setBanner({
        text: msg,
        type: "error"
      });
      setTimeout(() => setBanner(null), 6000);
      return null;
    }
    console.log("\n─────────────── DIFF START ───────────────");

    // 4) sort both lists by Y
    const sortedTipDots = tipDots.slice().sort((a, b) => a.y - b.y);
    const sortedNewNames = tipPairs
      .slice()
      .sort((a, b) => a.dot.y - b.dot.y)
      .map(p => p.name.trim());

    // 5) length check
    if (sortedTipDots.length !== sortedNewNames.length) {
      console.error(
        `[ERROR] tip count mismatch: ${sortedTipDots.length} vs ${sortedNewNames.length}`
      );
      return null;
    }

    // 6) compare row-by-row, now *using* `dot` in the log
    const updatedNames = [...currentNames];
    let flagged = 0;
    const strip = (s: string) => s.replace(/^⚠️⚠️⚠️\s*/, "").trim();

    sortedTipDots.forEach((dot, row) => {
      const oldClean = strip(currentNames[row] || "");
      const newClean = strip(sortedNewNames[row] || "");
      console.log(
        `  [COMPARE] row=${row}  y=${dot.y.toFixed(2)}  old="${oldClean}"  new="${newClean}"`
      );
      if (oldClean !== newClean) {
        updatedNames[row] = `⚠️⚠️⚠️ ${oldClean}`;
        flagged++;
      } else {
        updatedNames[row] = oldClean;
      }
    });

    console.log(`[RESULT] mismatches flagged: ${flagged}`);
    console.log("─────────────── DIFF END ───────────────\n");

    // 7) commit & emit back to the editor
    setTipNames(updatedNames);
    tipNamesRef.current = updatedNames;
    emitTo("tip-editor", "update-tip-editor", {
      text: updatedNames.join("\n"),
      tipCount: updatedNames.length,
    }).catch(() => {});
    
    const mismatchCount = updatedNames.filter(name =>
      name.startsWith("⚠️⚠️⚠️")
    ).length;
    
    setBanner({
      text: mismatchCount === 0
        ? "Diff complete: no mismatches found."
        : `Diff complete: flagged ${mismatchCount} mismatched name${mismatchCount > 1 ? "s" : ""}.`,
      type: "success"
    });
    setTimeout(() => setBanner(null), 4000);

    return { updatedNames };
  } catch (err) {
    console.error("❌ Diff failed:", err);
    return null;
  }
}


