// src/utils/useDragAndDrop.tsx
import { useEffect } from "react";
import { emitTo } from "@tauri-apps/api/event";
import { convertFileSrc } from "@tauri-apps/api/core";
import { loadCSVFromText } from "../utils/csvHandlers";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { useCanvasContext } from "../context/CanvasContext";

/* ──────────────────────────────────────────────────────────────
   Singleton guard for the Replace / Diff / Cancel dialog
   ────────────────────────────────────────────────────────────── */
let activeCsvChoice:
    Promise<"replace" | "diff" | "cancel"> | null = null;

/* ———————————————————————————————————————————————
   Global guards (shared by every hook instance)
    ——————————————————————————————————————————————— */
let globalDropInProgress = false;           // replaces dropInProgressRef
let dropListenerAttached = false;           // ensure we add ONE listener

console.log(
    "[DnD] branch:",
    isTauri() ? "TAURI" : "BROWSER"
);

type Banner = React.Dispatch<
React.SetStateAction<{ text: string; type: "success" | "error" | "info" } | null>
>;

async function showCSVDropChoice(): Promise<"replace" | "diff" | "cancel"> {
    /* If a dialog is already showing, just wait for its result */
    if (activeCsvChoice) return activeCsvChoice;

    activeCsvChoice = new Promise<"replace" | "diff" | "cancel">(resolve => {
        const overlay = document.createElement("div");
        overlay.style.cssText = `
        position:fixed; inset:0;
        background:rgba(0,0,0,0.5);
        display:flex; align-items:center; justify-content:center;
        z-index:10000;
      `;

        const panel = document.createElement("div");
        panel.className = "modal-panel";
        panel.style.padding = "20px";
        panel.style.width = "360px";
        panel.innerHTML = `
        <h3>CSV file detected</h3>
        <p>You already have data loaded. What would you like to do?</p>
        <div style="text-align:right; margin-top:12px;">
          <button id="replaceCSV" class="modal-button" data-modal-primary>Replace</button>
          <button id="diffCSV"     class="modal-button">Diff</button>
          <button id="cancelCSV"   class="modal-button">Cancel</button>
        </div>
      `;

        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        const finish = (choice: "replace" | "diff" | "cancel") => {
            document.body.removeChild(overlay);
            activeCsvChoice = null;          // 🔑 allow next dialog
            resolve(choice);
        };

        panel.querySelector("#replaceCSV")!.addEventListener("click", () => finish("replace"));
        panel.querySelector("#diffCSV")!.addEventListener("click", () => finish("diff"));
        panel.querySelector("#cancelCSV")!.addEventListener("click", () => finish("cancel"));
    });

    return activeCsvChoice;
}

export function useDragAndDrop(
    setImg: React.Dispatch<React.SetStateAction<HTMLImageElement | null>>,
    setGrayImg: React.Dispatch<React.SetStateAction<HTMLImageElement | null>>,
    setDots: React.Dispatch<React.SetStateAction<any[]>>,
    setTipNames: React.Dispatch<React.SetStateAction<string[]>>,
    setBanner: Banner,
    setDragOver: React.Dispatch<React.SetStateAction<boolean>>,
    resetAppStateForNewImage: (fileName: string) => void,
    tipNamesRef: React.MutableRefObject<string[]>,
    dotsRef: React.MutableRefObject<any[]>,
    getImgDims: () => { width: number; height: number } | undefined,
) {
    const { setLastSavePath, recordSnapshot, clearHistory } = useCanvasContext();
    /* ------------------------------------------------------------------
        Drag & Drop – works in the browser *and* in a Tauri window
    ------------------------------------------------------------------ */
    useEffect(() => {
        /* ------------ shared helpers ---------------------------------- */
        const handleImage = (pathOrFile: string | File) => {
            /* start clean: show colour, drop any previous greyscale */


            const fileName =
                typeof pathOrFile === "string"
                    ? pathOrFile.split(/[\\/]/).pop()!
                    : pathOrFile.name;

            const img = new Image();
            img.onload = null; // clear any existing handler
            img.crossOrigin = "";
            console.log("[DnD] handleImage: setting img.crossOrigin=", img.crossOrigin);
            img.onload = () => {
                setImg(img);

                // greyscale copy
                const off = document.createElement("canvas");
                off.width = img.width;
                off.height = img.height;
                const ctx = off.getContext("2d")!;
                ctx.drawImage(img, 0, 0);
                const data = ctx.getImageData(0, 0, off.width, off.height);
                for (let p = 0; p < data.data.length; p += 4) {
                    const lum =
                        0.3 * data.data[p] + 0.59 * data.data[p + 1] + 0.11 * data.data[p + 2];
                    data.data[p] = data.data[p + 1] = data.data[p + 2] = lum;
                }
                ctx.putImageData(data, 0, 0);
                const g = new Image();
                g.onload = () => {
                    console.log("[DnD] greyscale loaded, g.width=", g.width, "g.height=", g.height);
                    setGrayImg(g);

                    // ⏳ Defer state reset to avoid blocking render
                    setTimeout(() => {
                        resetAppStateForNewImage(fileName);
                    }, 0);
                };
                g.src = off.toDataURL();
            };

            img.src =
                typeof pathOrFile === "string"
                    ? convertFileSrc(pathOrFile)
                    : URL.createObjectURL(pathOrFile);
        };

        const handleCSVorTXT = async (pathOrFile: string | File, ext: string) => {
            console.log("📥 handleCSVorTXT called — ext =", ext);
            if (ext === "csv") {
                const text =
                    typeof pathOrFile === "string"
                        ? await readTextFile(pathOrFile)
                        : await pathOrFile.text();

                const hasExisting = dotsRef.current.length > 0 || tipNamesRef.current.length > 0;

                if (hasExisting) {
                    const choice = await showCSVDropChoice();  // show modal before applying anything
                    console.log("[DnD] CSV drop choice is:", choice);
                    if (choice === "cancel") return;

                    if (choice === "replace") {
                        setLastSavePath(null);
                        recordSnapshot({ type: "replace", description: "Replace with CSV" });
                        await loadCSVFromText(text, setDots, setTipNames, setBanner, tipNamesRef, getImgDims(),);
                    } else if (choice === "diff") {
                        const { diffTipNamesFromText } = await import("../utils/csvHandlers");
                        await diffTipNamesFromText(
                            dotsRef.current,
                            tipNamesRef.current,
                            text,
                            setTipNames,
                            tipNamesRef,
                            setBanner
                        );
                    }
                } else {
                    console.log("[DnD] No existing data found — applying CSV immediately");
                    // No existing data: safe to apply immediately
                    setLastSavePath(null);
                    clearHistory();  // Fresh start, no undo history
                    await loadCSVFromText(text, setDots, setTipNames, setBanner, tipNamesRef, getImgDims());
                }
            } else {
                // TXT: list of names, one per line
                const text =
                    typeof pathOrFile === "string"
                        ? await readTextFile(pathOrFile)
                        : await pathOrFile.text();

                const names = text
                    .split(/\r?\n/)
                    .map((s) => s.trim())
                    .filter(Boolean);

                if (!names.length) {
                    setBanner({ text: "No species names found.", type: "error" });
                    setTimeout(() => setBanner(null), 5000);
                    return;
                }

                setTipNames(names);
                tipNamesRef.current = names;
                emitTo("tip-editor", "update-tip-editor", {
                    text: names.join("\n"),
                    tipCount: dotsRef.current.filter((d) => d.type === "tip").length,
                }).catch(() => { });
                setBanner({ text: `Loaded ${names.length} species names.`, type: "success" });
                setTimeout(() => setBanner(null), 3000);
            }
        };

        /* ------------ drop handler (works for path or File) ----------- */
        const processDrop = async (pathOrFile: string | File) => {
            console.log("🚨 processDrop() called with:", pathOrFile);
            const name =
                typeof pathOrFile === "string" ? pathOrFile : pathOrFile.name;
            const ext = name.split(".").pop()?.toLowerCase() ?? "";

            if (["png", "jpg", "jpeg", "bmp", "gif", "webp", "svg"].includes(ext)) {
                handleImage(pathOrFile);
            } else if (ext === "csv" || ext === "txt") {
                await handleCSVorTXT(pathOrFile, ext);
            } else {
                setBanner({ text: `Unsupported file type: ${ext}`, type: "error" });
                setTimeout(() => setBanner(null), 4000);
            }
        };

        /* =================================================================
        1️⃣  Inside Tauri 2.x → use `onDragDropEvent`
        ================================================================= */
        if (isTauri() && !dropListenerAttached) {
            dropListenerAttached = true;                 // 🔑 mark attached

            const win = getCurrentWindow();
            let unlisten: (() => void) | undefined;

            win.onDragDropEvent(async (event) => {
                const payload = event.payload;
                console.log("🧊 [TAURI] Drop handler triggered");

                switch (payload.type) {
                    case "enter":
                    case "over":
                        setDragOver(true);
                        break;

                    case "leave":
                        setDragOver(false);
                        break;

                    case "drop": {
                        setDragOver(false);

                        /* ── global guard: allow ONE logical drop at a time ── */
                        if (globalDropInProgress) {
                            console.log("⏭️ Duplicate 'drop' event ignored");
                            return;
                        }
                        globalDropInProgress = true;

                        try {
                            if ("paths" in payload && payload.paths.length) {
                                console.log("🎯 Handling drop of:", payload.paths[0]);
                                await processDrop(payload.paths[0]);
                            }
                        } finally {
                            globalDropInProgress = false;   // unlock for the next gesture
                        }
                        break;
                    }
                }
            }).then((u) => (unlisten = u));

            return () => {
                unlisten?.();
                dropListenerAttached = false;
            };
        }
    }, []);

}
