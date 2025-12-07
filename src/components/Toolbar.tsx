// src/components/Toolbar.tsx
import React from "react";
import type { ToolMode } from "../hooks/useCanvasState";
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
  openNewickModal: () => void;
  openAboutModal: () => void;
  dotCount: number;
  tipNameMismatch: boolean;
  isDarkMode: boolean;
  hasRoot: boolean;
  openEqualizeModal: () => void;
  openOptionsModal: () => void;
  openDiffNamesHandler: () => void;
  openBlankCanvas: () => void;
  clearSketch: () => void;
  exportSVGHandler: () => void;
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
  openNewickModal,
  openAboutModal,
  dotCount,
  tipNameMismatch,
  isDarkMode,
  hasRoot,
  openOptionsModal,
  openDiffNamesHandler,
  openBlankCanvas,
  clearSketch,
  exportSVGHandler,
  helpMenuOpen,
  setHelpMenuOpen,
  helpMenuRef,
  openShortcutsModal,
  openQuickStartModal,
  drawMenuRef,
}: ToolbarProps) {

  const {
    toolMode,
    setToolMode,
    calibrating,
    startCalibration,
    isBlankCanvasMode,
    drawDropdownOpen,
    setDrawDropdownOpen,
    bw,
    toggleBW,
    treeShape,
    geometry,
    tipNames,
    openEqualizeModal,
    toggleTipDetectMode,
    toggleInternalDetectMode,
  } = useCanvasContext();

  // Helper: click once → activate, click again → deactivate
  const toggleTool = (mode: ToolMode) =>
    setToolMode(prev => (prev === mode ? "none" : mode));

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
            <div
              onClick={treeReady ? exportSVGHandler : undefined}
              className="toolbar-menu-item"
              style={{
                padding: "6px 12px",
                cursor: treeReady ? "pointer" : "not-allowed",
                color: treeReady
                  ? isDarkMode ? "#ddd" : "#000"
                  : isDarkMode ? "#555" : "#aaa",
              }}
              title={treeReady ? "" : "Tree is not valid"}
            >
              Export Tree SVG
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
                openUrl("https://www.treemble.org");
                setHelpMenuOpen(false);
              }}
              className="toolbar-menu-item"
              style={{
                padding: "6px 12px",
                cursor: "pointer",
                color: isDarkMode ? "#ddd" : "#000",
              }}
            >
              Treemble Website ↗
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
              Name Extractor GPT ↗
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
              background: toolMode.startsWith("draw") ? "#ccc" : undefined,
              flexShrink: 0,
              overflow: "hidden",
            }}
          >
            {toolMode === "drawPencil" ? "✏️ Pencil" :
              toolMode === "drawEraser" ? "🧽 Erase" :
                toolMode === "drawLine" ? "📏 Line" : "Draw ▾"}
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
                      if (value === "none") {
                        setToolMode("none");
                      } else {
                        setToolMode(("draw" + value.charAt(0).toUpperCase() + value.slice(1)) as ToolMode);
                      }
                    }
                    setDrawDropdownOpen(false);
                  }}
                  className="toolbar-menu-item"
                  style={{
                    padding: "6px 12px",
                    cursor: "pointer",
                    color: isDarkMode ? "#ddd" : "#000",
                    background:
                      toolMode === (value === "none" ? "none" : "draw" + value.charAt(0).toUpperCase() + value.slice(1))
                        ? (isDarkMode ? "#444" : "#e0e0e0")
                        : undefined,
                    fontWeight:
                      toolMode === (value === "none" ? "none" : "draw" + value.charAt(0).toUpperCase() + value.slice(1))
                        ? "bold"
                        : undefined,
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
        onClick={() => toggleTool("tip")}
        style={{
          background:
            toolMode === "tip"
              ? "#add8e6"
              : undefined
        }}
      >
        Tip
      </button>
      <button
        onClick={() => toggleTool("internal")}
        style={{
          background:
            toolMode === "internal"
              ? "#f08080"
              : undefined
        }}
      >
        Internal
      </button>
      <button
        onClick={() => toggleTool("root")}
        style={{
          background:
            toolMode === "root"
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
            toggleTool(
              toolMode === "centreSelect" || toolMode === "breakSelect"
                ? "centreSelect"  // toggling will turn it off if already active
                : "centreSelect"
            );
          }}
          disabled={!imgLoaded}
          title={!imgLoaded ? "No image loaded" : ""}
          style={{
            background: (toolMode === "centreSelect" || toolMode === "breakSelect") ? "#d0bfff" : undefined,
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
          title={!imgLoaded ? "No image loaded" : ""}
          style={{
            background: toolMode === "detectTips" ? "#ffd700" : undefined,
            fontWeight: toolMode === "detectTips" ? "bold" : undefined,
            whiteSpace: "nowrap",
            flexShrink: 0
          }}
        >
          Detect Tips
        </button>
      )}

      <button
        onClick={toggleInternalDetectMode}
        disabled={!imgLoaded || treeShape !== "rectangular"}
        title={
          !imgLoaded
            ? "No image loaded"
            : treeShape !== "rectangular"
              ? "Internal detection works in rectangular mode only"
              : ""
        }
        style={{
          background: toolMode === "detectInternal" ? "#ffd700" : undefined,
          fontWeight: toolMode === "detectInternal" ? "bold" : undefined,
          whiteSpace: "nowrap",
          flexShrink: 0,
          opacity: !imgLoaded || treeShape !== "rectangular" ? 0.6 : 1,
        }}
      >
        Detect Internal
      </button>

      {/* Equalize Tips */}
      <button
        onClick={openEqualizeModal}
        disabled={
          !imgLoaded ||
          treeShape === "freeform" ||
          (treeShape === "circular" && !geometry.getCentre())
        }
        title={
          !imgLoaded
            ? "No image loaded"
            : treeShape === "freeform"
              ? "Disabled in Freeform mode"
              : treeShape === "circular" && !geometry.getCentre()
                ? "Configure center first"
                : ""
        }
        style={{
          background: toolMode === "equalizeStart" ? "#d0bfff" : undefined,
          fontWeight: toolMode === "equalizeStart" ? "bold" : undefined,
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
          (treeShape === "circular" && !geometry.getCentre())
        }
        title={
          !imgLoaded
            ? "No image loaded"
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
          setToolMode("none");
          openOptionsModal();
        }}
        style={{ marginLeft: 8 }}
      >
        Options
      </button>
    </div>
  );
}
