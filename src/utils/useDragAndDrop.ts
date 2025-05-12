// src/utils/useDragAndDrop.tsx
import { useEffect } from "react";
import { emitTo } from "@tauri-apps/api/event";
import { convertFileSrc } from "@tauri-apps/api/core";
import { loadCSVFromText } from "./csvHandlers";
import { isTauri } from "@tauri-apps/api/core";           // ← NEW
import { getCurrentWindow } from "@tauri-apps/api/window"; // ← NEW
import { readTextFile } from "@tauri-apps/plugin-fs";

console.log(
    "[DnD] branch:",
    isTauri() ? "TAURI" : "BROWSER"
);

type Banner = React.Dispatch<
    React.SetStateAction<{ text: string; type: "success" | "error" } | null>
>;

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
) {
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
            const text =
                typeof pathOrFile === "string"
                    ? await readTextFile(pathOrFile)
                    : await pathOrFile.text();

            if (ext === "csv") {
                /* CSV */
                loadCSVFromText(text, setDots, setTipNames, setBanner, tipNamesRef);
            } else {
                /* TXT – species names, one per line */
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
            console.log("[DnD] processDrop called with", pathOrFile);
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
        if (isTauri()) {
            const win = getCurrentWindow();
            let unlisten: (() => void) | undefined;

            win.onDragDropEvent(async (event) => {
                const payload = event.payload;

                switch (payload.type) {
                    case "enter":
                    case "over":
                        setDragOver(true);
                        break;

                    case "leave":
                        setDragOver(false);
                        break;

                    case "drop":
                        setDragOver(false);
                        // Only the `enter` and `drop` variants carry `paths`
                        if ("paths" in payload && payload.paths.length) {
                            await processDrop(payload.paths[0]);
                        }
                        break;
                }
            }).then((un) => { unlisten = un; });

            return () => { unlisten?.(); };
        }

        /* =================================================================
           2️⃣  Pure browser (or running with `vite dev`) → keep DOM events
        ================================================================== */
        const onDragOver = (e: DragEvent) => {
            e.preventDefault();
            setDragOver(true);
        };

        const onDragLeave = (e: DragEvent) => {
            e.preventDefault();
            setDragOver(false);
        };

        const onDrop = async (e: DragEvent) => {
            e.preventDefault();
            setDragOver(false);
            console.log("[DnD] drop event (DOM)");

            const files = e.dataTransfer?.files;
            if (!files || files.length === 0) return;
            await processDrop(files[0]);
        };

        document.addEventListener("dragover", onDragOver);
        document.addEventListener("dragleave", onDragLeave);
        document.addEventListener("drop", onDrop);

        return () => {
            document.removeEventListener("dragover", onDragOver);
            document.removeEventListener("dragleave", onDragLeave);
            document.removeEventListener("drop", onDrop);
        };
    }, []); // ← run once

}
