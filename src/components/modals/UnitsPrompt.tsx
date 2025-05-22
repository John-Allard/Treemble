// src/components/modals/UnitsPrompt.tsx
import { useRef } from "react";
import { useCanvasContext } from "../../context/CanvasContext";

export default function UnitsPrompt() {
  const {
    showUnitsPrompt,
    unitsInput,
    setUnitsInput,
    calX1,
    calX2,
    setTimePerPixel,
    setShowUnitsPrompt,
    setCalibrating,
    setCalStep,
    setBanner,
  } = useCanvasContext();

  const modalPrimaryRef = useRef<HTMLButtonElement>(null);

  if (!showUnitsPrompt) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex", justifyContent: "center", alignItems: "center"
      }}
      onClick={() => { /* block outside clicks */ }}
    >
      <div
        className="modal-panel"
        style={{ padding: 20, width: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Scale Calibration</h3>
        <p style={{ margin: "6px 0 8px" }}>
          Enter the length represented by the selected interval:
        </p>
        <input
          type="number"
          value={unitsInput}
          onChange={e => setUnitsInput(e.target.value)}
          style={{
            width: "calc(100% - 12px)",
            marginBottom: 10,
            padding: "6px",
            boxSizing: "border-box",
            borderRadius: "4px",
            border: "1px solid #ccc",
            background: "#fafafa"
          }}
        />
        <div style={{ textAlign: "right" }}>
          <button
            ref={modalPrimaryRef}
            className="modal-button"
            onClick={() => {
              const u = parseFloat(unitsInput);
              if (isNaN(u) || u <= 0 || calX1 == null || calX2 == null) {
                alert("Please enter a positive number.");
                return;
              }
              const dx = Math.abs(calX2 - calX1);
              const upx = u / dx;
              setTimePerPixel(upx);
              setShowUnitsPrompt(false);
              setCalibrating(false);
              setCalStep(null);
              setBanner({
                text: `Branch lengths calibrated to ${upx.toFixed(6)} units per pixel.`,
                type: "success"
              });
              setTimeout(() => setBanner(null), 3000);
            }}
          >
            OK
          </button>{" "}
          <button
            className="modal-button"
            onClick={() => {
              setShowUnitsPrompt(false);
              setCalibrating(false);
              setCalStep(null);
              setBanner(null);
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
