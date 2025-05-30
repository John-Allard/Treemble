// src/hooks/useCanvasState.ts
import { useState, useMemo, useCallback, useEffect } from "react";
import { Dot, DotType, Edge, isTreeUltrametric, findAsymmetricalNodes } from "../utils/tree";
import { TreeGeometry, RectangularGeometry, CircularGeometry } from "../utils/TreeGeometry";

export function useCanvasState() {
    // ─── Raw state ─────────────────────────────────────────────────────────
    const [showAboutModal, setShowAboutModal] = useState(false);
    const [showShortcutsModal, setShowShortcutsModal] = useState(false);
    const [showOptionsModal, setShowOptionsModal] = useState(false);
    const [showNewickModal, setShowNewickModal] = useState(false);
    const [showBlankCanvasModal, setShowBlankCanvasModal] = useState(false);
    const [showQuickStartModal, setShowQuickStartModal] = useState(false);

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
    const [calP1, setCalP1] = useState<{ x: number; y: number } | null>(null);
    const [calP2, setCalP2] = useState<{ x: number; y: number } | null>(null);
    const [showUnitsPrompt, setShowUnitsPrompt] = useState(false);
    const [unitsInput, setUnitsInput] = useState("");
    const [calCursorX, setCalCursorX] = useState(0);

    const [equalizingTips, setEqualizingTips] = useState(false);
    const [equalizeX, setEqualizeX] = useState<number | null>(null);
    const [showEqualizeXConfirmModal, setShowEqualizeXConfirmModal] = useState(false);

    const [edges, setEdges] = useState<Edge[]>([]);
    const [freeNodes, setFreeNodes] = useState<number[]>([]);
    type BannerType = "success" | "error" | "info";
    const [banner, setBanner] = useState<{ text: string; type: BannerType } | null>(null);
    const [newick, setNewick] = useState("");
    const [dragOver, setDragOver] = useState(false);

    const [drawMode, setDrawMode] = useState<"none" | "pencil" | "eraser" | "line">("none");
    const [drawDropdownOpen, setDrawDropdownOpen] = useState(false);
    const [isBlankCanvasMode, setIsBlankCanvasMode] = useState(false);

    const [branchThickness, setBranchThickness] = useState(4);
    const [asymmetryThreshold, setAsymmetryThreshold] = useState(2);
    const [tipLabelColor, setTipLabelColor] = useState("#00ff00");

    const [treeType, setTreeType] = useState<"phylo" | "clado">("phylo");
    const [treeShape, setTreeShape] = useState<"rectangular" | "circular">("rectangular");
    const geometry = useMemo<TreeGeometry>(() =>
        treeShape === "circular"
            ? new CircularGeometry()
            : new RectangularGeometry(),
        [treeShape]);

    // Clear detection/calibration/equalize modes when switching to circular
    useEffect(() => {
        if (treeShape === "circular") {
            setTipDetectMode(false);
            setCalibrating(false);
            setCalStep(null);
            setCalP1(null);
            setCalP2(null);
            setShowUnitsPrompt(false);
            setEqualizingTips(false);
            setSelectingCentre(false);
            setSelectingBreak(false);
            setShowTree(false);
        } else {
            // switched back to rectangular: clear that “configure center” error
            setBanner(null);
        }
    }, [treeShape]);

    // ── Circular “Center & Break” selection modes ──
    const [selectingCentre, setSelectingCentre] = useState(false);
    const [selectingBreak, setSelectingBreak] = useState(false);
    const [breakPointScreen, setBreakPointScreen] = useState<{ x: number; y: number } | null>(null);

    const startCentreSelection = useCallback(() => {
        setSelectingCentre(true);
        setSelectingBreak(false);
        setBanner({ text: "Click the exact center of the circular tree", type: "info" });
    }, [setSelectingCentre, setSelectingBreak, setBanner]);


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

        // If turning ON, first cancel any other active modes
        if (!tipDetectMode) {
            if (equalizingTips) openEqualizeModal();
            if (calibrating) startCalibration();
        }

        // flip the flag and do clean-up when turning OFF
        setTipDetectMode(prev => {
            const next = !prev;
            if (!next) {
                setSelStart(null);
                setSelRect(null);
            }
            return next;
        });
    }, [
        setDrawMode,
        tipDetectMode,
        equalizingTips,
        calibrating,
        openEqualizeModal,
        startCalibration,
        setTipDetectMode,
        setSelStart,
        setSelRect,
    ]);

    // Toggle Tip-Equalization mode.
    const openEqualizeModal = useCallback(() => {
        // always quit the draw tool first
        setDrawMode("none");

        // If turning ON, cancel any other active modes first
        if (!equalizingTips) {
            if (tipDetectMode) toggleTipDetectMode();
            if (calibrating) startCalibration();
        }

        setEqualizingTips(prev => {
            const next = !prev;
            if (next) {
                const msg =
                    treeShape === "circular"
                        ? "Click a point to set all tip nodes to that radial distance."
                        : "Click a point on the image to set all tip nodes to that X-axis position.";
                setBanner({ text: msg, type: "info" });
            } else {
                setBanner(null);
            }
            return next;
        });
    }, [
        setDrawMode,
        equalizingTips,
        tipDetectMode,
        calibrating,
        toggleTipDetectMode,
        startCalibration,
        setEqualizingTips,
        setBanner,
        treeShape,
    ]);

    // Start or cancel scale calibration.
    const startCalibration = useCallback(() => {
        setDrawMode("none");
        if (calibrating) {
            // cancel calibration
            setCalibrating(false);
            setCalStep(null);
            setCalX1(null);
            setCalX2(null);
            setCalP1(null);
            setCalP2(null);
            setShowUnitsPrompt(false);
            setBanner(null);
        } else {
            // start calibration → cancel other modes first
            if (tipDetectMode) toggleTipDetectMode();
            if (equalizingTips) openEqualizeModal();

            setCalibrating(true);
            setCalStep("pick1");
            setCalX1(null);
            setCalX2(null);
            setCalP1(null);
            setCalP2(null);
            setBanner({
                text: "Calibration: click the initial point.",
                type: "info"
            });
        }
    }, [
        setDrawMode,
        calibrating,
        tipDetectMode,
        equalizingTips,
        toggleTipDetectMode,
        openEqualizeModal,
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
        const tips = dots.filter(d => d.type === "tip");
        if (!root || !tips.length || timePerPixel === 1) return null;
    
        /* ── Project to tree-space when circular so  x = radius  ── */
        const projected = treeShape === "circular"
          ? dots.map(d => {
              const t = geometry.toTree({ x: d.x, y: d.y });
              return { ...d, x: t.r, y: t.theta } as Dot;
            })
          : dots;
    
        if (!isTreeUltrametric(projected, treeShape)) return null;
    
        const projRoot  = projected.find(d => d.type === "root")!;
        const firstTip  = projected.find(d => d.type === "tip")!;
        const delta     = Math.abs(firstTip.x - projRoot.x);   // x = radius or X
        return delta * timePerPixel;
      }, [dots, timePerPixel, treeShape, geometry]);

    /** Whether to display a root-height label (only when calibrated & ultrametric) */
    const showRootHeight = useMemo(() => {
        if (rootHeight === null || timePerPixel === 1) return false;
        const projected = treeShape === "circular"
            ? dots.map(d => ({
                ...d,
                x: geometry.toTree({ x: d.x, y: d.y }).r,   // x→radius
                y: geometry.toTree({ x: d.x, y: d.y }).theta // store θ just for input completeness
            }))
            : dots;
        return isTreeUltrametric(projected, treeShape);
    }, [rootHeight, timePerPixel, dots, treeShape, geometry]);

    const asymmetricalNodes = useMemo(() => {
        if (!showTree || freeNodes.length === 0) return [];
        if (treeShape === "circular" && !geometry.getCentre()) return [];

        // Project into tree-space: (x→radius, y→angle) for circular, else identity
        const coords = treeShape === "circular"
            ? dots.map(d => {
                const t = geometry.toTree({ x: d.x, y: d.y });
                return { x: t.r, y: t.theta, type: d.type } as Dot;
            })
            : dots;

        // Now run the standard "Y-difference" test on those projected coords
        return findAsymmetricalNodes(edges, coords, asymmetryThreshold);
    }, [
        edges, dots, showTree, freeNodes,
        asymmetryThreshold, treeShape, geometry
    ]);

    // For functions that need it
    const getImgDims = useCallback(() => img ? { width: img.width, height: img.height } : undefined, [img]);

    return {
        // raw state
        showAboutModal, setShowAboutModal,
        showShortcutsModal, setShowShortcutsModal,
        showOptionsModal, setShowOptionsModal,
        showNewickModal, setShowNewickModal,
        showBlankCanvasModal, setShowBlankCanvasModal,
        showQuickStartModal, setShowQuickStartModal,

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
        calP1, setCalP1,
        calP2, setCalP2,
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
        treeShape, setTreeShape,
        geometry,
        selectingCentre, selectingBreak,
        startCentreSelection,
        setSelectingCentre, setSelectingBreak,
        breakPointScreen, setBreakPointScreen,

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
