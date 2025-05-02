// src/tipEditor.tsx
import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { listen, emitTo } from "@tauri-apps/api/event";
import "./tipEditor.css";

function TipEditor() {
    // live line count
    const [lines, setLines] = useState(0);

    // direct handle to the textarea element
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // ── Receive updates from main window ─────────────────────
    useEffect(() => {
        const unlistenPromise = listen("update-tip-editor", (ev: any) => {
            console.log("[Editor] got update-tip-editor payload:", ev.payload);
            const txt = typeof ev.payload?.text === "string" ? ev.payload.text : "";
            if (textareaRef.current) {
                textareaRef.current.value = txt;
                setLines(txt.split("\n").filter(Boolean).length);
            }
        });

        return () => {
            unlistenPromise.then((un) => un()).catch(() => { });
        };
    }, []);

    // ── Tell main window we’re ready ─────────────────────────
    useEffect(() => {
        emitTo("main", "tip-editor-ready").catch(console.error);
    }, []);

    // ── Handle typing and emit back to main ─────────────────
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setLines(val.split("\n").filter(Boolean).length);
        emitTo("main", "tip-editor-saved", val).catch(console.error);
    };

    // ── Intercept Ctrl+Z / Ctrl+Y for native undo/redo ───────
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const mod = e.ctrlKey || e.metaKey;
            if (!mod) return;

            // Undo: Ctrl+Z or ⌘Z
            if (!e.shiftKey && e.key.toLowerCase() === "z") {
                e.preventDefault();
                document.execCommand("undo");
            }
            // Redo: Ctrl+Y or Ctrl+Shift+Z or ⌘Shift+Z
            else if (
                e.key.toLowerCase() === "y" ||
                (e.shiftKey && e.key.toLowerCase() === "z")
            ) {
                e.preventDefault();
                document.execCommand("redo");
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    return (
        <div style={{ padding: 12, minWidth: 360 }}>
            <h3 style={{ margin: "0 0 6px" }}>Edit Tip Names</h3>
            <p style={{ fontSize: 13, margin: "4px 0 8px" }}>Lines: {lines}</p>

            <textarea
                ref={textareaRef}
                defaultValue=""
                onChange={handleChange}
                style={{
                    width: "100%",
                    height: "calc(100vh - 96px)",
                    fontFamily: "monospace",
                    fontSize: 14,
                    boxSizing: "border-box",
                }}
                placeholder="One name per line…"
            />
        </div>
    );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<TipEditor />);
