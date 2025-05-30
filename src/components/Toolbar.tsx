// src/components/Toolbar.tsx
import React from "react";
import { useCanvasContext } from "../context/CanvasContext";
import { openUrl } from "@tauri-apps/plugin-opener";

type ToolbarProps = {
  fileMenuOpen: boolean;
  setFileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  fileMenuRef: React.RefObject<HTMLDivElement>;
  chooseImage: () => void;
  saveCSVHandler: () => void;
  loadCSVHandler: () => void;
  addTipNamesHandler: () => void;
  openTipEditor: () => void;
  imgLoaded: boolean;
  toggleShowTree: () => void;
  showTree: boolean;
  treeReady: boolean;
  openEqualizeModal: () => void;
  openNewickModal: () => void;
  startCalibration: () => void;
  calibrating: boolean;
  openAboutModal: () => void;
  dotCount: number;
  tipNameMismatch: boolean;
  isDarkMode: boolean;
  hasRoot: boolean;
  equalizingTips: boolean;
  openOptionsModal: () => void;
  openDiffNamesHandler: () => void;
  openBlankCanvas: () => void;
  clearSketch: () => void;
  helpMenuOpen: boolean;
  setHelpMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  helpMenuRef: React.RefObject<HTMLDivElement>;
  openShortcutsModal: () => void;
  openQuickStartModal: () => void;
  drawMenuRef: React.RefObject<HTMLDivElement>;
};

export default function Toolbar({
  fileMenuOpen,
  setFileMenuOpen,
  fileMenuRef,
  chooseImage,
  saveCSVHandler,
  loadCSVHandler,
  addTipNamesHandler,
  openTipEditor,
  imgLoaded,
  toggleShowTree,
  showTree,
  treeReady,
  openEqualizeModal,
  openNewickModal,
  startCalibration,
  calibrating,
  openAboutModal,
  dotCount,
  tipNameMismatch,
  isDarkMode,
  hasRoot,
  equalizingTips,
  openOptionsModal,
  openDiffNamesHandler,
  openBlankCanvas,
  clearSketch,
  helpMenuOpen,
  setHelpMenuOpen,
  helpMenuRef,
  openShortcutsModal,
  openQuickStartModal,
  drawMenuRef,
}: ToolbarProps) {

  /* pull the rest straight from context → no prop-drilling */
  const {
    mode,
    setMode,
    tipDetectMode,
    toggleTipDetectMode,
    drawMode,
    setDrawMode,
    isBlankCanvasMode,
    drawDropdownOpen,
    setDrawDropdownOpen,
    bw,
    toggleBW,
    treeShape,
    geometry,
    startCentreSelection,
    selectingCentre,
    selectingBreak,
    setSelectingCentre,
    setSelectingBreak,
    setBanner,
    tipNames,
  } = useCanvasContext();

  const isCanvasMode = isBlankCanvasMode;

  return (
    <div style={{
      flexShrink: 0,
      padding: 8,
      background: isDarkMode ? "#444" : "#f0f0f0",
      color: isDarkMode ? "#f6f6f6" : "#0f0f0f",
      display: "flex",
      gap: 5,
      alignItems: "center",
      flexWrap: "nowrap",
    }}>

      {/* File Menu */}
      <div style={{ position: "relative" }} ref={fileMenuRef}>
        <button
          onClick={() => setFileMenuOpen(!fileMenuOpen)}
          style={{
            padding: "3px 12px",
            cursor: "pointer",
            whiteSpace: "nowrap",
            flexShrink: 0
          }}
        >
          File ▾
        </button>

        {fileMenuOpen && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              background: isDarkMode ? "#222" : "#fff",
              border: isDarkMode ? "1px solid #555" : "1px solid #ccc",
              boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
              zIndex: 100,
              minWidth: "200px",
            }}
          >
            <div
              onClick={chooseImage}
              className="toolbar-menu-item"
              style={{
                padding: "6px 12px",
                cursor: "pointer",
                color: isDarkMode ? "#ddd" : "#000",
              }}
            >
              Choose Tree Image
            </div>
            <div
              onClick={openBlankCanvas}
              className="toolbar-menu-item"
              style={{
                padding: "6px 12px",
                cursor: "pointer",
                color: isDarkMode ? "#ddd" : "#000",
              }}
            >
              Open Blank Canvas
            </div>
            <div
              onClick={dotCount > 0 ? saveCSVHandler : undefined}
              className="toolbar-menu-item"
              style={{
                padding: "6px 12px",
                cursor: dotCount > 0 ? "pointer" : "not-allowed",
                color: dotCount > 0
                  ? isDarkMode ? "#ddd" : "#000"
                  : isDarkMode ? "#555" : "#aaa",
              }}
              title={dotCount > 0 ? "" : "No nodes to save"}
            >
              Save CSV
            </div>
            <div
              onClick={imgLoaded ? loadCSVHandler : undefined}
              className="toolbar-menu-item"
              style={{
                padding: "6px 12px",
                cursor: imgLoaded ? "pointer" : "not-allowed",
                color: imgLoaded
                  ? isDarkMode ? "#ddd" : "#000"
                  : isDarkMode ? "#555" : "#aaa",
              }}
              title={imgLoaded ? "" : "No image loaded"}
            >
              Load CSV
            </div>
            <div
              onClick={imgLoaded ? addTipNamesHandler : undefined}
              className="toolbar-menu-item"
              style={{
                padding: "6px 12px",
                cursor: imgLoaded ? "pointer" : "not-allowed",

                color: imgLoaded
                  ? isDarkMode ? "#ddd" : "#000"
                  : isDarkMode ? "#555" : "#aaa",
              }}
              title={imgLoaded ? "" : "No image loaded"}
            >
              Load Tip Names File
            </div>
            <div
              onClick={imgLoaded && tipNames.length > 0 ? openDiffNamesHandler : undefined}
              className="toolbar-menu-item"
              style={{
                padding: "6px 12px",
                cursor:
                  imgLoaded && tipNames.length > 0
                    ? "pointer"
                    : "not-allowed",
                color:
                  imgLoaded && tipNames.length > 0
                    ? (isDarkMode ? "#ddd" : "#000")
                    : (isDarkMode ? "#555" : "#aaa"),
              }}
              title={
                !imgLoaded
                  ? "No image loaded"
                  : tipNames.length === 0
                    ? "No tip names to diff against"
                    : ""
              }
            >
              Diff Tip Names CSV File
            </div>
            <div
              onClick={imgLoaded ? openTipEditor : undefined}
              className="toolbar-menu-item"
              style={{
                padding: "6px 12px",
                cursor: imgLoaded ? "pointer" : "not-allowed",
                color: imgLoaded
                  ? isDarkMode ? "#ddd" : "#000"
                  : isDarkMode ? "#555" : "#aaa",
              }}
              title={imgLoaded ? "" : "No image loaded"}
            >
              Edit Tip Names
            </div>
          </div>
        )}
      </div>

      {/* Help Menu */}
      <div style={{ position: "relative" }} ref={helpMenuRef}>
        <button
          onClick={() => setHelpMenuOpen(!helpMenuOpen)}
          style={{
            padding: "3px 12px",
            cursor: "pointer",
            whiteSpace: "nowrap",
            flexShrink: 0
          }}
        >
          Help ▾
        </button>

        {helpMenuOpen && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              background: isDarkMode ? "#222" : "#fff",
              border: isDarkMode ? "1px solid #555" : "1px solid #ccc",
              boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
              zIndex: 100,
              minWidth: "200px",
            }}
          >
            <div
              onClick={() => {
                openAboutModal();
                setHelpMenuOpen(false);
              }}
              className="toolbar-menu-item"
              style={{
                padding: "6px 12px",
                cursor: "pointer",
                color: isDarkMode ? "#ddd" : "#000",
              }}
            >
              About Treemble
            </div>
            <div
              onClick={() => {
                openQuickStartModal();
                setHelpMenuOpen(false);
              }}
              className="toolbar-menu-item"
              style={{
                padding: "6px 12px",
                cursor: "pointer",
                color: isDarkMode ? "#ddd" : "#000",
              }}
            >
              Quick Start Guide
            </div>
            <div
              onClick={() => {
                openUrl("https://chatgpt.com/g/g-rwiIPwboh-tip-name-extractor");
                setHelpMenuOpen(false);
              }}
              className="toolbar-menu-item"
              style={{
                padding: "6px 12px",
                cursor: "pointer",
                color: isDarkMode ? "#ddd" : "#000",
              }}
            >
              Name Extractor GPT
            </div>
            <div
              onClick={() => {
                openShortcutsModal();
                setHelpMenuOpen(false);
              }}
              className="toolbar-menu-item"
              style={{
                padding: "6px 12px",
                cursor: "pointer",
                color: isDarkMode ? "#ddd" : "#000",
              }}
            >
              Keyboard Shortcuts
            </div>
          </div>
        )}
      </div>

      {isCanvasMode && (
        <div style={{ position: "relative" }} ref={drawMenuRef}>
          <button
            onClick={() => setDrawDropdownOpen(prev => !prev)}
            style={{
              padding: "3px 12px",
              cursor: "pointer",
              whiteSpace: "nowrap",
              background: drawMode !== "none" ? "#ccc" : undefined,
              flexShrink: 0
            }}
          >
            {drawMode === "pencil" ? "✏️ Pencil" :
              drawMode === "eraser" ? "🧽 Erase" :
                drawMode === "line" ? "📏 Line" : "Draw ▾"}
          </button>

          {drawDropdownOpen && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                background: isDarkMode ? "#222" : "#fff",
                border: isDarkMode ? "1px solid #555" : "1px solid #ccc",
                boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                zIndex: 100,
                minWidth: "160px",
              }}
            >
              {[
                { label: "None", value: "none" },
                { label: "✏️ Pencil", value: "pencil" },
                { label: "📏 Line", value: "line" },
                { label: "🧽 Eraser", value: "eraser" },
                { label: "🗑️ Clear", value: "clear" },
              ].map(({ label, value }) => (
                <div
                  key={value}
                  onClick={() => {
                    if (value === "clear") {
                      clearSketch();          // wipe both canvases
                    } else {
                      setDrawMode(value as "none" | "pencil" | "eraser");
                    }
                    setDrawDropdownOpen(false);
                  }}
                  className="toolbar-menu-item"
                  style={{
                    padding: "6px 12px",
                    cursor: "pointer",
                    color: isDarkMode ? "#ddd" : "#000",
                    background: drawMode === value ? (isDarkMode ? "#444" : "#e0e0e0") : undefined,
                    fontWeight: drawMode === value ? "bold" : undefined,
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <span style={{ margin: "0 4px", fontWeight: 600 }}>|</span>

      {/* Dot Mode Buttons */}
      <button
        onClick={() => {
          /* ── Exit any active “special” mode before switching tools ───────── */
          if (tipDetectMode) toggleTipDetectMode();    // Detect Tips → OFF
          if (equalizingTips) openEqualizeModal();      // Equalize Tips → OFF
          if (calibrating) startCalibration();       // Calibration  → OFF
          if (selectingCentre || selectingBreak) {                // Centre/Break → OFF
            setSelectingCentre(false);
            setSelectingBreak(false);
            setBanner(null);
          }
          if (drawMode !== "none") setDrawMode("none");      // leave draw tools
          setMode("tip");                                          // finally switch
        }}
        style={{
          background:
            !tipDetectMode &&
              drawMode === "none" &&
              !equalizingTips &&
              !calibrating &&
              !selectingCentre &&
              !selectingBreak &&
              mode === "tip"
              ? "#add8e6"
              : undefined
        }}
      >
        Tip
      </button>
      <button
        onClick={() => {
          if (tipDetectMode) toggleTipDetectMode();
          if (equalizingTips) openEqualizeModal();
          if (calibrating) startCalibration();
          if (selectingCentre || selectingBreak) {
            setSelectingCentre(false);
            setSelectingBreak(false);
            setBanner(null);
          }
          if (drawMode !== "none") setDrawMode("none");
          setMode("internal");
        }}
        style={{
          background:
            !tipDetectMode &&
              drawMode === "none" &&
              !equalizingTips &&
              !calibrating &&
              !selectingCentre &&
              !selectingBreak &&
              mode === "internal"
              ? "#f08080"
              : undefined
        }}
      >
        Internal
      </button>
      <button
        onClick={() => {
          if (tipDetectMode) toggleTipDetectMode();
          if (equalizingTips) openEqualizeModal();
          if (calibrating) startCalibration();
          if (selectingCentre || selectingBreak) {
            setSelectingCentre(false);
            setSelectingBreak(false);
            setBanner(null);
          }
          if (drawMode !== "none") setDrawMode("none");
          setMode("root");
        }}
        style={{
          background:
            !tipDetectMode &&
              drawMode === "none" &&
              !equalizingTips &&
              !calibrating &&
              !selectingCentre &&
              !selectingBreak &&
              mode === "root"
              ? "#90ee90"
              : undefined
        }}
      >
        Root
      </button>

      <span style={{ margin: "0 4px", fontWeight: 600 }}>|</span>

      {/* Circular Center & Break vs Tip Detection */}
      {treeShape === "circular" ? (
        <button
          onClick={() => {
            /* toggle Centre & Break mode */
            if (selectingCentre || selectingBreak) {
              // abort: keep whatever centre/break was already configured
              setSelectingCentre(false);
              setSelectingBreak(false);
              setBanner(null);
            } else {
              startCentreSelection();
            }
          }}
          disabled={!imgLoaded || equalizingTips || calibrating}
          title={imgLoaded ? "" : "No image loaded"}
          style={{
            background: (selectingCentre || selectingBreak) ? "#d0bfff" : undefined,
            whiteSpace: "nowrap",
            flexShrink: 0
          }}
        >
          Center & Break
        </button>
      ) : (
        <button
          onClick={toggleTipDetectMode}
          disabled={!imgLoaded}
          title={
            !imgLoaded ? "No image loaded" : ""
          }
          style={{
            background: tipDetectMode ? "#ffd700" : undefined,
            fontWeight: tipDetectMode ? "bold" : undefined,
            whiteSpace: "nowrap",
            flexShrink: 0
          }}
        >
          Detect Tips
        </button>
      )}

      {/* Equalize Tips */}
      <button
        onClick={openEqualizeModal}
        disabled={
          !imgLoaded ||
          selectingCentre ||
          selectingBreak ||
          (treeShape === "circular" && !geometry.getCentre())
        }
        title={
          !imgLoaded
            ? "No image loaded"
            : selectingCentre || selectingBreak
              ? "Finish center & break first"
              : treeShape === "circular" && !geometry.getCentre()
                ? "Configure center first"
                : ""
        }
        style={{
          background: equalizingTips ? "#d0bfff" : undefined,
          fontWeight: equalizingTips ? "bold" : undefined,
          whiteSpace: "nowrap",
          flexShrink: 0
        }}
      >
        Equalize Tips
      </button>

      {/* Scale Calibration */}
      <button
        onClick={startCalibration}
        disabled={
          !imgLoaded ||
          selectingCentre ||
          selectingBreak ||
          (treeShape === "circular" && !geometry.getCentre())
        }
        title={
          !imgLoaded
            ? "No image loaded"
            : selectingCentre || selectingBreak
              ? "Finish center & break first"
              : treeShape === "circular" && !geometry.getCentre()
                ? "Configure center & break first"
                : ""
        }
        style={{
          background: calibrating ? "#d9d0ff" : undefined,
          fontWeight: calibrating ? "bold" : undefined,
          whiteSpace: "nowrap",
          flexShrink: 0
        }}
      >
        Calibrate Scale
      </button>

      <span style={{ margin: "0 4px", fontWeight: 600 }}>|</span>

      {/* Show / Hide Tree */}
      <button
        onClick={hasRoot ? toggleShowTree : undefined}
        disabled={
          !hasRoot ||
          (treeShape === "circular" && !geometry.getCentre())
        }
        title={
          !hasRoot
            ? "A root must be added"
            : treeShape === "circular" && !geometry.getCentre()
              ? "Configure center & break first"
              : ""
        }
        style={{
          whiteSpace: "nowrap",
          flexShrink: 0,
          ...(showTree && {
            background: isDarkMode ? "#888" : "#555",
            color: "#fff",
            fontWeight: "bold",
          })
        }}
      >
        {showTree ? "Hide Tree" : "Show Tree"}
      </button>

      {/* Show Newick */}
      <button
        onClick={openNewickModal}
        disabled={!showTree || !treeReady || tipNameMismatch}
        title={
          !showTree
            ? "Tree must be shown first"
            : !treeReady
              ? "Tree is not fully valid yet"
              : tipNameMismatch
                ? "Number of tip names does not match number of tip nodes"
                : ""
        }
        style={{
          whiteSpace: "nowrap",
          flexShrink: 0
        }}
      >
        Show Newick
      </button>

      {/* B/W Toggle */}
      <label
        className="bw-label"
      >
        <input type="checkbox" checked={bw} onChange={toggleBW} /> B/W
      </label>

      {/* Options */}
      <button
        onClick={() => {
          // end any active modes before opening Options
          if (tipDetectMode) toggleTipDetectMode();
          if (calibrating) startCalibration();
          if (equalizingTips) openEqualizeModal();
          openOptionsModal();
        }}
        style={{ marginLeft: 8 }}
      >
        Options
      </button>
    </div>
  );
}
