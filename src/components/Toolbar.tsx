// src/components/Toolbar.tsx
import React from "react";

type ToolbarProps = {
  mode: "tip" | "internal" | "root";
  setMode: (mode: "tip" | "internal" | "root") => void;
  fileMenuOpen: boolean;
  setFileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  fileMenuRef: React.RefObject<HTMLDivElement>;
  chooseImage: () => void;
  loadImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
  saveCSVHandler: () => void;
  loadCSVHandler: () => void;
  addTipNamesHandler: () => void;
  openTipEditor: () => void;
  tipDetectMode: boolean;
  toggleTipDetectMode: () => void;
  imgLoaded: boolean;
  toggleShowTree: () => void;
  showTree: boolean;
  treeReady: boolean;
  openEqualizeModal: () => void;
  openNewickModal: () => void;
  startCalibration: () => void;
  calibrating: boolean;
  bw: boolean;
  toggleBW: () => void;
  openAboutModal: () => void;
  dotCount: number;
  tipNameMismatch: boolean;
  isDarkMode: boolean;
  hasRoot: boolean;
  equalizingTips: boolean;
  openOptionsModal: () => void;
  openDiffNamesHandler: () => void;
};

export default function Toolbar({
  mode,
  setMode,
  fileMenuOpen,
  setFileMenuOpen,
  fileMenuRef,
  chooseImage,
  saveCSVHandler,
  loadCSVHandler,
  addTipNamesHandler,
  openTipEditor,
  tipDetectMode,
  toggleTipDetectMode,
  imgLoaded,
  toggleShowTree,
  showTree,
  treeReady,
  openEqualizeModal,
  openNewickModal,
  startCalibration,
  calibrating,
  bw,
  toggleBW,
  openAboutModal,
  dotCount,
  isDarkMode,
  hasRoot,
  equalizingTips,
  openOptionsModal,
  openDiffNamesHandler,
  tipNameMismatch,
}: ToolbarProps) {
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
        style={{ background: !tipDetectMode && mode === "tip" ? "#add8e6" : undefined }}
      >
        Tip
      </button>
      <button
        onClick={() => setMode("internal")}
        style={{ background: !tipDetectMode && mode === "internal" ? "#f08080" : undefined }}
      >
        Internal
      </button>
      <button
        onClick={() => setMode("root")}
        style={{ background: !tipDetectMode && mode === "root" ? "#90ee90" : undefined }}
      >
        Root
      </button>

      {/* Tip Detection */}
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

      {/* Equalize Tips */}
      <button
        onClick={openEqualizeModal}
        disabled={!imgLoaded || calibrating || tipDetectMode}
        title={
          !imgLoaded ? "No image loaded" :
          calibrating ? "Finish calibration first" :
          tipDetectMode ? "Exit tip detection mode first" :
          ""
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
        disabled={!hasRoot}
        title={hasRoot ? "" : "A root must be added"}
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
        disabled={!imgLoaded || equalizingTips || tipDetectMode}
        title={
          !imgLoaded ? "No image loaded" :
          equalizingTips ? "Finish tip equalization first" :
          tipDetectMode ? "Exit tip detection mode first" :
          ""
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

      {/* B/W Toggle */}
      <label
        className="bw-label"
      >
        <input type="checkbox" checked={bw} onChange={toggleBW} /> B/W
      </label>

      {/* Options */}
      <button onClick={openOptionsModal} style={{ marginLeft: 8 }}>Options</button>

      {/* About */}
      <button onClick={openAboutModal} style={{ marginLeft: 2 }}>About</button>
    </div>
  );
}
