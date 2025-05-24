// src/components/Toolbar.tsx
import React from "react";
import { useCanvasContext } from "../context/CanvasContext";

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
  clearSketch
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
              onClick={imgLoaded ? openDiffNamesHandler : undefined}
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

      {/* Dot Mode Buttons */}
      <button
        onClick={() => setMode("tip")}
        style={{
          background: !tipDetectMode && drawMode === "none" && mode === "tip"
            ? "#add8e6" : undefined
        }}
      >
        Tip
      </button>
      <button
        onClick={() => setMode("internal")}
        style={{
          background: !tipDetectMode && drawMode === "none" && mode === "internal"
            ? "#f08080" : undefined
        }}
      >
        Internal
      </button>
      <button
        onClick={() => setMode("root")}
        style={{
          background: !tipDetectMode && drawMode === "none" && mode === "root"
            ? "#90ee90" : undefined
        }}
      >
        Root
      </button>

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
          disabled={!imgLoaded || calibrating || equalizingTips}
          title={
            !imgLoaded ? "No image loaded" :
              calibrating ? "Finish calibration first" :
                equalizingTips ? "Finish tip equalization first" :
                  ""
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
          calibrating ||
          selectingCentre ||
          selectingBreak ||
          tipDetectMode ||
          (treeShape === "circular" && !geometry.getCentre())
        }
        title={
          !imgLoaded
            ? "No image loaded"
            : calibrating
              ? "Finish calibration first"
              : selectingCentre || selectingBreak
                ? "Finish center & break first"
                : tipDetectMode
                  ? "Finish tip detection first"
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

      {/* Scale Calibration */}
      <button
        onClick={startCalibration}
        disabled={
          !imgLoaded ||
          equalizingTips ||
          selectingCentre ||
          selectingBreak ||
          tipDetectMode ||
          (treeShape === "circular" && !geometry.getCentre())
        }
        title={
          !imgLoaded
            ? "No image loaded"
            : equalizingTips
              ? "Finish tip equalization first"
              : selectingCentre || selectingBreak
                ? "Finish center & break first"
                : tipDetectMode
                  ? "Exit tip detection mode first"
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

      {isCanvasMode && (
        <div style={{ position: "relative" }}>
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

      {/* About */}
      <button onClick={openAboutModal} style={{ marginLeft: 2 }}>About</button>
    </div>
  );
}
