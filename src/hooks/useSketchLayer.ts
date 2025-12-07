// src/hooks/useSketchLayer.ts
import { useRef, useEffect } from "react";
import { recordSketchSnapshot } from "./useSketchUndoRedo";

const ERASER_RADIUS = 20;

type DrawMode = "none" | "pencil" | "eraser" | "line";

export function useSketchLayer(
    canvasRef: React.RefObject<HTMLCanvasElement>,
    toolMode: string,
    scale: number,
    masterCanvas: HTMLCanvasElement | null
) {
    const drawMode: DrawMode = toolMode.startsWith("draw")
        ? (toolMode.replace("draw", "").toLowerCase() as DrawMode)
        : "none";

    const isDrawingRef = useRef(false);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);

    const lineStartRef = useRef<{ x: number; y: number } | null>(null);

    const shiftDownRef = useRef(false);
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Shift") shiftDownRef.current = true;
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === "Shift") shiftDownRef.current = false;
        };
        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
        };
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const handleMouseDown = (e: MouseEvent) => {
            // start drawing **only** on an un-modified left-click
            if (drawMode === "none" || e.ctrlKey || e.button !== 0) return;
            
            // Record snapshot before starting to draw (for undo)
            recordSketchSnapshot(masterCanvas);
            
            isDrawingRef.current = true;
            const pt = getMousePos(e, canvas);
            lastPointRef.current = pt;
            lineStartRef.current  = pt;

            /* If we’re starting a Shift-line, paint the current master
            onto the screen canvas so we can draw a live preview on top */
            if (shiftDownRef.current && masterCanvas) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(masterCanvas, 0, 0, canvas.width, canvas.height);
            }
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (!isDrawingRef.current || drawMode === "none") return;
            const newPoint = getMousePos(e, canvas);
            const ctx = canvas.getContext("2d");
            if (!ctx || !lastPointRef.current || !newPoint) return;

            ctx.lineCap = "round";
            ctx.lineJoin = "round";

            if (drawMode === "pencil" || drawMode === "line") {
                /* -------- live PREVIEW -------- */
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                if (masterCanvas) {
                  ctx.drawImage(masterCanvas, 0, 0, canvas.width, canvas.height);
                }
              
                ctx.strokeStyle = "#000";
                ctx.lineWidth   = 2;
                ctx.lineCap     = "round";
                ctx.lineJoin    = "round";
              
                ctx.beginPath();
                const straight = drawMode === "line" || shiftDownRef.current;
              
                /* straight-line preview (line-mode OR Shift in pencil-mode) */
                if (straight && lineStartRef.current) {
                    ctx.moveTo(lineStartRef.current.x, lineStartRef.current.y);
                    ctx.lineTo(newPoint.x, newPoint.y);
                }
                /* freehand segment, committed immediately */
                else if (!straight && lastPointRef.current) {
                  ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
                  ctx.lineTo(newPoint.x,             newPoint.y);
              
                  /* — commit to the master bitmap — */
                  if (masterCanvas) {
                    const mctx = masterCanvas.getContext("2d")!;
                    mctx.strokeStyle = "#000";
                    mctx.lineWidth   = 2 / scale;
                    mctx.lineCap     = "round";
                    mctx.lineJoin    = "round";
                    mctx.beginPath();
                    mctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
                    mctx.lineTo(newPoint.x,             newPoint.y);
                    mctx.stroke();
                  }
                }
              
                ctx.stroke();
                lastPointRef.current = newPoint;            // always track cursor
              } else if (drawMode === "eraser") {
                // ‼️ Keep erase radius equal to the 32 px screen-radius preview
                const radius = ERASER_RADIUS / scale;

                /* on-screen (sketch layer) */
                ctx.save();
                ctx.globalCompositeOperation = "destination-out";
                ctx.beginPath();
                ctx.arc(newPoint.x, newPoint.y, radius, 0, 2 * Math.PI);
                ctx.fill();
                ctx.restore();

                /* master copy (unscaled) */
                if (masterCanvas) {
                    const mctx = masterCanvas.getContext("2d")!;
                    mctx.save();
                    mctx.globalCompositeOperation = "destination-out";
                    mctx.beginPath();
                    mctx.arc(
                        newPoint.x / scale,
                        newPoint.y / scale,
                        radius,                      // ← no second  “/ scale”
                        0,
                        2 * Math.PI
                    );
                    mctx.fill();
                    mctx.restore();
                }
            }
            lastPointRef.current = newPoint;
        };

        const handleMouseUp = () => {
            isDrawingRef.current = false;
            if (canvasRef.current) {
                const targetCanvas = canvasRef.current;
                const targetCtx = targetCanvas.getContext("2d");
                if (targetCtx && typeof window !== "undefined") {
                    const evt = new CustomEvent("sketch-updated", {
                        detail: {
                            width: targetCanvas.width,
                            height: targetCanvas.height,
                            image: targetCanvas.toDataURL(),
                        },
                    });
                    window.dispatchEvent(evt);
                }
            }

            // ── Commit one straight Shift-line on mouse-up ──
            {
                const start  = lineStartRef.current;
                const end    = lastPointRef.current;
                const screen = canvasRef.current;
            
                if (
                ((drawMode === "pencil" && shiftDownRef.current) || drawMode === "line") &&
                start !== null &&
                end   !== null &&
                masterCanvas &&
                screen                       // non-null here
                ) {
                /* 1️⃣  stamp the line onto the master bitmap (image-space) */
                const mctx = masterCanvas.getContext("2d")!;
                mctx.strokeStyle = "#000";
                mctx.lineWidth   = 2 / scale;
                mctx.lineCap     = "round";
                mctx.lineJoin    = "round";
                mctx.beginPath();
                mctx.moveTo(start.x, start.y);
                mctx.lineTo(end.x,   end.y);
                mctx.stroke();
            
                /* 2️⃣  refresh the on-screen sketch layer */
                const sctx = screen.getContext("2d")!;
                sctx.clearRect(0, 0, screen.width, screen.height);
                sctx.drawImage(masterCanvas, 0, 0, screen.width, screen.height);
                }
            }
            
            /* finally reset refs */
            lastPointRef.current = null;
            lineStartRef.current = null;
        };

        canvas.addEventListener("mousedown", handleMouseDown);
        canvas.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);

        return () => {
            canvas.removeEventListener("mousedown", handleMouseDown);
            canvas.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [toolMode, scale, masterCanvas]);

    const getMousePos = (e: MouseEvent, canvas: HTMLCanvasElement) => {
        const rect = canvas.getBoundingClientRect();
        return {
            // divide by scale so we always return image-space pixels
            x: (e.clientX - rect.left) / scale,
            y: (e.clientY - rect.top) / scale,
        };
    };
}
