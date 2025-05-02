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
  tipCount: number;
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
}: ToolbarProps) {
  return (
    <div style={{ flexShrink: 0, padding: 8, background: "#f0f0f0", display: "flex", gap: 8, alignItems: "center" }}>
      
      {/* File Menu */}
      <div style={{ position: "relative" }} ref={fileMenuRef}>
        <button
          onClick={() => setFileMenuOpen(!fileMenuOpen)}
          style={{ padding: "3px 12px", cursor: "pointer" }}
        >
          File ▾
        </button>

        {fileMenuOpen && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              background: "#fff",
              border: "1px solid #ccc",
              boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
              zIndex: 100,
              minWidth: "200px",
            }}
          >
            <div
              onClick={chooseImage}
              className="toolbar-menu-item"
              style={{ padding: "6px 12px", cursor: "pointer" }}
            >
              Choose Tree Image
            </div>
            <div
              onClick={saveCSVHandler}
              className="toolbar-menu-item"
              style={{ padding: "6px 12px", cursor: "pointer" }}
            >
              Save CSV
            </div>
            <div
              onClick={loadCSVHandler}
              className="toolbar-menu-item"
              style={{ padding: "6px 12px", cursor: "pointer" }}
            >
              Load CSV
            </div>
            <div
              onClick={addTipNamesHandler}
              className="toolbar-menu-item"
              style={{ padding: "6px 12px", cursor: "pointer" }}
            >
              Load Tip Names File
            </div>
            <div
              onClick={openTipEditor}
              className="toolbar-menu-item"
              style={{ padding: "6px 12px", cursor: "pointer" }}
            >
              Edit Tip Names
            </div>
          </div>
        )}
      </div>

      {/* Dot Mode Buttons */}
      <button onClick={() => setMode("tip")}     style={{ background: mode === "tip"      ? "#add8e6" : undefined }}>Tip</button>
      <button onClick={() => setMode("internal")}style={{ background: mode === "internal" ? "#f08080" : undefined }}>Internal</button>
      <button onClick={() => setMode("root")}    style={{ background: mode === "root"     ? "#90ee90" : undefined }}>Root</button>

      {/* Tip Detection */}
      <button
        onClick={toggleTipDetectMode}
        style={{
          background: tipDetectMode ? "#ffd700" : undefined,
          fontWeight: tipDetectMode ? "bold" : undefined,
        }}
        disabled={!imgLoaded}
      >
        Detect Tips
      </button>

      {/* Equalize Tips */}
      <button onClick={openEqualizeModal} disabled={!imgLoaded}>Equalize Tips</button>

      {/* Show / Hide Tree */}
      <button
        onClick={toggleShowTree}
        style={{
          background: showTree ? "#555555" : "#ffffff",
          color:      showTree ? "#ffffff" : "#000000",
        }}
      >
        {showTree ? "Hide Tree" : "Show Tree"}
      </button>

      {/* Show Newick */}
      <button onClick={openNewickModal} disabled={!showTree || !treeReady}>Show Newick</button>

      {/* Scale Calibration */}
      <button
        onClick={startCalibration}
        disabled={!imgLoaded}
        style={{
          background: calibrating ? "#d9d0ff" : undefined,
          fontWeight: calibrating ? "bold" : undefined,
        }}
      >
        Calibrate Scale
      </button>

      {/* B/W Toggle */}
      <label style={{ marginLeft: "auto" }}>
        <input type="checkbox" checked={bw} onChange={toggleBW} /> B/W
      </label>

      {/* About */}
      <button onClick={openAboutModal} style={{ marginLeft: 8 }}>About</button>
    </div>
  );
}
