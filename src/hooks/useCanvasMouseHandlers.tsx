// src/hooks/useMouseHandlers.ts
import { useCanvasContext } from "../context/CanvasContext";
import { Dot } from "../utils/tree";

const DOT_R = 8;

type Refs = {
    canvasRef: React.RefObject<HTMLCanvasElement>;
    overlayRef: React.RefObject<HTMLCanvasElement>;
    verticalLineRef: React.RefObject<HTMLDivElement>;
    horizontalLineRef: React.RefObject<HTMLDivElement>;
    contRef: React.RefObject<HTMLDivElement>;
    cursorRef: React.MutableRefObject<{ x: number; y: number } | null>;
    sketchRef: React.RefObject<HTMLCanvasElement>;
    panStart: React.MutableRefObject<{ sl: number; st: number; x: number; y: number } | undefined>;
    dragFrame: React.MutableRefObject<number | null>;
    wasDragging: React.MutableRefObject<boolean>;
    draggingNodeIndex: number | null;
    setDraggingNodeIndex: React.Dispatch<React.SetStateAction<number | null>>;
    hoveringNodeIndex: number | null;
    setHoveringNodeIndex: React.Dispatch<React.SetStateAction<number | null>>;
    skipNextClick: React.MutableRefObject<boolean>;
    windowIsFocused: React.MutableRefObject<boolean>;
    focusTimestampRef: React.MutableRefObject<number>;
    draggingForTips: React.MutableRefObject<boolean>;
    panning: boolean;
    setPanning: React.Dispatch<React.SetStateAction<boolean>>;
    sketchMasterCanvas: HTMLCanvasElement | null;
};

export function useMouseHandlers(
    {
        canvasRef,
        contRef,
        overlayRef,
        verticalLineRef,
        horizontalLineRef,
        cursorRef,
        panStart,
        dragFrame,
        wasDragging,
        draggingNodeIndex,
        setDraggingNodeIndex,
        setHoveringNodeIndex,
        skipNextClick,
        draggingForTips,
        panning,
        setPanning,
        sketchMasterCanvas,
    }: Refs,
    drawOverlay: () => void,
    zoom: (factor: number, cx: number, cy: number) => void,
) {
    /* All tree-state, tool-mode, banner etc. come straight from context. */
    const ctx = useCanvasContext();
    const {
        toolMode, setToolMode,
        scale,
        geometry,
        calibrating,
        setCalCursorX,
        selStart, setSelStart,
        selRect, setSelRect,
        setCalX1, setCalX2,
        setCalP1, setCalP2,
        setShowUnitsPrompt,
        setEqualizeX,
        setShowEqualizeXConfirmModal,
        dots, setDots,
        setEdges, setFreeNodes,
        setNewick,
        isBlankCanvasMode,
        showTree,
        treeShape,
        setBanner,
        setBreakPointScreen,
        img,
    } = ctx;

    // Mouse & dot handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (
            toolMode.startsWith("draw") &&  // drawing/erasing active
            e.button === 0 &&               // plain left-click only
            !e.ctrlKey &&                   // allow Ctrl-click zoom
            !target.closest(".toolbar-menu-item") &&
            !target.closest("button")
        ) return;
        // ───── Calibration disables normal mousedown ─────
        if (calibrating && e.button !== 2 && !e.ctrlKey) {
            return;
        }
        if (toolMode === "equalizeStart" && e.button !== 2 && !e.ctrlKey) {
            return;
        }

        /* ───── TIP-DETECT & NODE-DRAG: combined ───── */
        if (toolMode === "detectTips" && e.button === 0 && !e.ctrlKey) {
            const rect = canvasRef.current!.getBoundingClientRect();
            const x = (e.clientX - rect.left) / scale;
            const y = (e.clientY - rect.top) / scale;

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

        /* ───── Ctrl+click zoom helpers ───── */
        if (e.ctrlKey) {
            if (e.button === 0) zoom(1.25, e.clientX, e.clientY);
            else if (e.button === 2) zoom(0.8, e.clientX, e.clientY);
            e.preventDefault();
            return;
        }

        /* ───── Start panning  ─────
        • Right-button drag  → always pans
        • Left-button drag   → pans only when toolMode === "none"
        and the click was NOT on a node   */
        const shouldStartPan =
            // Right mouse button
            (e.button === 2) ||
            // Left mouse button in “none” mode, not over a node
            (e.button === 0 && toolMode === "none" && (() => {
                const rect = canvasRef.current!.getBoundingClientRect();
                const imgX = (e.clientX - rect.left) / scale;
                const imgY = (e.clientY - rect.top) / scale;
                return !dots.some(d => Math.hypot(d.x - imgX, d.y - imgY) < DOT_R / scale);
            })());

        if (shouldStartPan) {
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

        const needOverlay = toolMode === "drawEraser" || (treeShape === "circular" && geometry.getCentre());
        const showCrosshair = !(treeShape === "circular" && geometry.getCentre());
        const insideCanvas = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
        if (verticalLineRef.current && horizontalLineRef.current) {
            if (showCrosshair && insideCanvas) {
                const pxX = x * scale;
                const pxY = y * scale;
                // Ensure lines span full canvas size (after zoom)
                if (canvasRef.current) {
                    const rectSize = canvasRef.current.getBoundingClientRect();
                    verticalLineRef.current.style.height = `${rectSize.height}px`;
                    horizontalLineRef.current.style.width = `${rectSize.width}px`;
                }
                verticalLineRef.current.style.transform = `translateX(${pxX}px)`;
                horizontalLineRef.current.style.transform = `translateY(${pxY}px)`;
                verticalLineRef.current.style.display = "block";
                horizontalLineRef.current.style.display = "block";
            } else {
                verticalLineRef.current.style.display = "none";
                horizontalLineRef.current.style.display = "none";
            }
        }

        if (!needOverlay) {
            // Hide overlay canvas to avoid clearRect on every move
            if (overlayRef.current && overlayRef.current.style.display !== "none") {
                const ctx = overlayRef.current.getContext("2d");
                if (ctx) ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
                overlayRef.current.style.display = "none";
            }
        } else {
            if (overlayRef.current && overlayRef.current.style.display === "none") {
                overlayRef.current.style.display = "block";
            }
            drawOverlay();
        }

        // 💡 Live overlay during calibration / equalise
        if (toolMode === "calibrateStart" || toolMode === "calibrateEnd" || toolMode === "equalizeStart") {
            const liveVal = treeShape === "circular"
                ? geometry.toTree({ x, y }).r
                : x;
            setCalCursorX(liveVal);
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
        if (toolMode === "detectTips" && selStart) {
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
            toolMode.startsWith("draw") &&  // drawing/erasing active
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
        if (toolMode === "detectTips" && selStart && selRect && img) {
            import("../utils/detectTips").then(({ detectTipsInRect }) => {

                /* ① build a composite at the image’s native resolution ------------ */
                const merged = document.createElement("canvas");
                merged.width = img.width;
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
                        width: Math.round(selRect.w),
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
        if (verticalLineRef.current && horizontalLineRef.current) {
            verticalLineRef.current.style.display = "none";
            horizontalLineRef.current.style.display = "none";
        }
    };

    const handleClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (
            toolMode.startsWith("draw") &&  // drawing/erasing active
            e.button === 0 &&               // plain left-click only
            !e.ctrlKey &&                   // allow Ctrl-click zoom
            !target.closest(".toolbar-menu-item") &&
            !target.closest("button")
        ) return;
        if (skipNextClick.current) {
            skipNextClick.current = false;
            return;
        }

        // ── Circular Center selection ──
        if (toolMode === "centreSelect" && !e.ctrlKey) {
            if (!canvasRef.current) return;
            const rect = canvasRef.current.getBoundingClientRect();
            const x = (e.clientX - rect.left) / scale;
            const y = (e.clientY - rect.top) / scale;
            geometry.setCentre({ x, y });
            console.log(`Center point set at: (${x.toFixed(2)}, ${y.toFixed(2)})`);
            setToolMode("breakSelect")
            setBanner({ text: "Center set — now click a point to set the break point angle (the gap in the circle).", type: "info" });
            return;
        }
        // ── Circular Break selection ──
        if (toolMode === "breakSelect" && !e.ctrlKey) {
            if (!canvasRef.current) return;
            const rect = canvasRef.current.getBoundingClientRect();
            const x = (e.clientX - rect.left) / scale;
            const y = (e.clientY - rect.top) / scale;
            geometry.setBreakPoint({ x, y });
            setBreakPointScreen({ x, y });
            setToolMode("none")
            setBanner({ text: "Circle center & break point have been configured", type: "success" });
            setTimeout(() => setBanner(null), 3000);
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
            const imgX = (e.clientX - rect.left) / scale;
            const imgY = (e.clientY - rect.top) / scale;

            if (toolMode === "calibrateStart") {
                /* store for both tree shapes */
                /* store X or radial distance depending on tree shape */
                if (treeShape === "circular") {
                    const r = geometry.toTree({ x: imgX, y: imgY }).r;
                    setCalX1(r);
                } else {
                    setCalX1(imgX);
                }
                setCalP1({ x: imgX, y: imgY });
                setToolMode("calibrateEnd");
                setBanner({
                    text: treeShape === "circular"
                        ? "Initial point recorded. Click the final point."
                        : `Initial point recorded at X = ${Math.round(imgX)}. Click the final point.`,
                    type: "info"
                });
            } else if (toolMode === "calibrateEnd") {
                if (treeShape === "circular") {
                    const r = geometry.toTree({ x: imgX, y: imgY }).r;
                    setCalX2(r);
                } else {
                    setCalX2(imgX);
                }
                setCalP2({ x: imgX, y: imgY });
                setToolMode("unitsEntry");
                setBanner({
                    text: treeShape === "circular"
                        ? "Final point recorded. Enter units."
                        : `Final point recorded at X = ${Math.round(imgX)}. Enter units.`,
                    type: "info"
                });
                setShowUnitsPrompt(true);
            }
            return; // stop normal dot behaviour
        }

        if (toolMode === "equalizeStart" && !e.ctrlKey) {
            if (!canvasRef.current) return;
            const rect = canvasRef.current.getBoundingClientRect();
            const x = (e.clientX - rect.left) / scale;
            const y = (e.clientY - rect.top) / scale;

            // Compute either X or radial based on geometry
            const target = geometry.equalizeTarget({ x, y });
            setEqualizeX(target);

            setToolMode("none");
            setShowEqualizeXConfirmModal(true);
            setBanner(null);
            return;
        }

        // ── TIP-DETECT mode: allow node removal, block others ──
        if (toolMode === "detectTips") {
            const rect = canvasRef.current!.getBoundingClientRect();
            const x = (e.clientX - rect.left) / scale;
            const y = (e.clientY - rect.top) / scale;

            // If clicking over a node, remove it
            const nodeIndex = dots.findIndex(d => Math.hypot(d.x - x, d.y - y) < DOT_R / scale);
            if (nodeIndex !== -1) {
                setDots(prev => prev.filter((_, i) => i !== nodeIndex));

                /* reset derived tree state so no stale indexes survive this render */
                setEdges([]);
                setFreeNodes([]);
                setNewick("");

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

        let newDots: Dot[];

        // ── Always check for “click on existing node → remove it” first ──
        const idx = dots.findIndex(
            d => Math.hypot(d.x - x, d.y - y) < DOT_R / scale
        );
        if (idx !== -1) {
            setDots(prev => prev.filter((_, i) => i !== idx));

            /* same cleanup as above – clear stale edge indexes immediately */
            setEdges([]);
            setFreeNodes([]);
            setNewick("");

            return;
        }

        if (toolMode === "root") {
            // Only one root at a time – replace any existing root
            newDots = [
                ...dots.filter(d => d.type !== "root"),
                { x, y, type: "root" },
            ];
        } else if (toolMode === "tip" || toolMode === "internal") {
            // Add a new tip/internal node (removal is handled above)
            newDots = [...dots, { x, y, type: toolMode }];
        } else {
            // Not a node-adding tool – ignore the click
            return;
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

    /* Finally, expose them */
    return {
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleMouseLeave,
        handleClick,
    };
}
