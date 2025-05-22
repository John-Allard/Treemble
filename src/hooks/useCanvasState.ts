// src/hooks/useCanvasState.ts
import { useState, useMemo, useCallback } from "react";
import { Dot, DotType, Edge, isTreeUltrametric, findAsymmetricalNodes } from "../utils/tree";

export function useCanvasState() {
    // ─── Raw state ─────────────────────────────────────────────────────────
    const [showAboutModal, setShowAboutModal] = useState(false);
    const [showOptionsModal, setShowOptionsModal] = useState(false);
    const [showNewickModal, setShowNewickModal] = useState(false);
    const [showBlankCanvasModal, setShowBlankCanvasModal] = useState(false);

    const [img, setImg] = useState<HTMLImageElement | null>(null);
    const [grayImg, setGrayImg] = useState<HTMLImageElement | null>(null);
    const [baseName, setBaseName] = useState("tree");

    const [dots, setDots] = useState<Dot[]>([]);
    const [mode, setMode] = useState<DotType>("tip");
    const [scale, setScale] = useState(1);
    const [fontSize, setFontSize] = useState(12);
    const [bw, setBW] = useState(false);
    const toggleBW = useCallback(() => {
        setBW(prev => !prev);
    }, [setBW]);

    const [showTree, setShowTree] = useState(false);
    const [treeReady, setTreeReady] = useState(false);

    const [tipDetectMode, setTipDetectMode] = useState(false);
    const [selStart, setSelStart] = useState<{ x: number, y: number } | null>(null);
    const [selRect, setSelRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);

    const [calibrating, setCalibrating] = useState(false);
    const [calStep, setCalStep] = useState<"pick1" | "pick2" | "units" | null>(null);
    const [calX1, setCalX1] = useState<number | null>(null);
    const [calX2, setCalX2] = useState<number | null>(null);
    const [showUnitsPrompt, setShowUnitsPrompt] = useState(false);
    const [unitsInput, setUnitsInput] = useState("");
    const [calCursorX, setCalCursorX] = useState(0);

    const [equalizingTips, setEqualizingTips] = useState(false);
    const [equalizeX, setEqualizeX] = useState<number | null>(null);
    const [showEqualizeXConfirmModal, setShowEqualizeXConfirmModal] = useState(false);

    const [edges, setEdges] = useState<Edge[]>([]);
    const [freeNodes, setFreeNodes] = useState<number[]>([]);
    const [banner, setBanner] = useState<{ text: string; type: "success" | "error" } | null>(null);
    const [newick, setNewick] = useState("");
    const [dragOver, setDragOver] = useState(false);

    const [drawMode, setDrawMode] = useState<"none" | "pencil" | "eraser" | "line">("none");
    const [drawDropdownOpen, setDrawDropdownOpen] = useState(false);
    const [isBlankCanvasMode, setIsBlankCanvasMode] = useState(false);

    const [branchThickness, setBranchThickness] = useState(4);
    const [asymmetryThreshold, setAsymmetryThreshold] = useState(2);
    const [tipLabelColor, setTipLabelColor] = useState("#00ff00");

    const [treeType, setTreeType] = useState<"phylo" | "clado">("phylo");
    const [lastSavePath, setLastSavePath] = useState<string | null>(null);
    const [timePerPixel, setTimePerPixel] = useState(1);

    const [isDarkMode, setIsDarkMode] = useState<boolean>(
        window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false
    );

    const [tipNames, setTipNames] = useState<string[]>([]);

    // ── Actions ────────────────────────────────────────────────

    // Toggle Tip-Detection mode.  
    const toggleTipDetectMode = useCallback(() => {
        // always quit the draw tool first
        setDrawMode("none");

        // flip the flag and do clean-up when turning OFF
        setTipDetectMode(prev => {
        const next = !prev;
        if (!next) {
            setSelStart(null);
            setSelRect(null);
        }
        return next;
        });
    }, [setDrawMode, setTipDetectMode, setSelStart, setSelRect]);

    // Toggle Tip-Equalization mode.
    const openEqualizeModal = useCallback(() => {
        // always quit the draw tool first
        setDrawMode("none");

        setEqualizingTips(prev => {
            const next = !prev;
            if (next) {
                setBanner({
                    text: "Click a point on the image to set all tip nodes to that X-axis position.",
                    type: "success",
                });
            } else {
                setBanner(null);
            }
            return next;
        });
    }, [setDrawMode, setEqualizingTips, setBanner]);

    // Start or cancel scale calibration.
    const startCalibration = useCallback(() => {
        setDrawMode("none");
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
    }, [
        setDrawMode,
        calibrating,
        setCalibrating,
        setCalStep,
        setCalX1,
        setCalX2,
        setShowUnitsPrompt,
        setBanner
    ]);

    // ─── Derived values ────────────────────────────────────────────────────
    const tipCount = useMemo(() => dots.filter(d => d.type === "tip").length, [dots]);
    const hasRoot = useMemo(() => dots.some(d => d.type === "root"), [dots]);

    const tipLabelMismatch = useMemo(
        () => tipNames.length > 0 && tipNames.length !== tipCount,
        [tipNames, tipCount]
    );

    const rootHeight = useMemo(() => {
        const root = dots.find(d => d.type === "root");
        const tipXs = dots.filter(d => d.type === "tip").map(d => d.x);
        if (root && tipXs.length && timePerPixel !== 1 && isTreeUltrametric(dots)) {
            return Math.abs(tipXs[0] - root.x) * timePerPixel;
        }
        return null;
    }, [dots, timePerPixel]);

    /** Whether to display a root-height label (only when calibrated & ultrametric) */
    const showRootHeight = useMemo(() => {
        return rootHeight !== null && timePerPixel !== 1 && isTreeUltrametric(dots);
    }, [rootHeight, timePerPixel, dots]);

    const asymmetricalNodes = useMemo(() => {
        if (!showTree || freeNodes.length === 0) return [];
        return findAsymmetricalNodes(edges, dots, asymmetryThreshold);
    }, [edges, dots, showTree, freeNodes, asymmetryThreshold]);

    // For functions that need it
    const getImgDims = useCallback(() => img ? { width: img.width, height: img.height } : undefined, [img]);

    return {
        // raw state
        showAboutModal, setShowAboutModal,
        showOptionsModal, setShowOptionsModal,
        showNewickModal, setShowNewickModal,
        showBlankCanvasModal, setShowBlankCanvasModal,

        img, setImg,
        grayImg, setGrayImg,
        baseName, setBaseName,

        dots, setDots,
        mode, setMode,
        scale, setScale,
        fontSize, setFontSize,
        bw, setBW,
        toggleBW,

        showTree, setShowTree,
        treeReady, setTreeReady,

        tipDetectMode, setTipDetectMode,
        selStart, setSelStart,
        selRect, setSelRect,

        calibrating, setCalibrating,
        calStep, setCalStep,
        calX1, setCalX1,
        calX2, setCalX2,
        showUnitsPrompt, setShowUnitsPrompt,
        unitsInput, setUnitsInput,
        calCursorX, setCalCursorX,

        equalizingTips, setEqualizingTips,
        equalizeX, setEqualizeX,
        showEqualizeXConfirmModal, setShowEqualizeXConfirmModal,
        openEqualizeModal,

        edges, setEdges,
        freeNodes, setFreeNodes,
        banner, setBanner,
        newick, setNewick,
        dragOver, setDragOver,

        drawMode, setDrawMode,
        drawDropdownOpen, setDrawDropdownOpen,
        isBlankCanvasMode, setIsBlankCanvasMode,

        branchThickness, setBranchThickness,
        asymmetryThreshold, setAsymmetryThreshold,
        tipLabelColor, setTipLabelColor,

        treeType, setTreeType,
        lastSavePath, setLastSavePath,
        timePerPixel, setTimePerPixel,

        isDarkMode, setIsDarkMode,

        tipNames, setTipNames,

        // derived
        tipCount,
        hasRoot,
        tipLabelMismatch,
        rootHeight,
        showRootHeight,
        asymmetricalNodes,
        toggleTipDetectMode,
        startCalibration,
        getImgDims,
    };
}
