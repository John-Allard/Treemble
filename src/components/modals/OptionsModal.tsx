import { useRef } from "react";
import { useCanvasContext } from "../../context/CanvasContext";

export default function OptionsModal() {
  const {
    showOptionsModal,
    setShowOptionsModal,
    treeType,
    setTreeType,
    branchThickness,
    setBranchThickness,
    asymmetryThreshold,
    setAsymmetryThreshold,
    fontSize,
    setFontSize,
    tipLabelColor,
    setTipLabelColor,
  } = useCanvasContext();

  const modalPrimaryRef = useRef<HTMLButtonElement>(null);

  if (!showOptionsModal) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
      onClick={() => setShowOptionsModal(false)}
    >
      <div
        className="modal-panel"
        style={{ padding: 20, width: 360 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Options</h3>

        <div style={{ marginBottom: 14 }}>
          <label>Tree type:</label>
          <br />
          <label>
            <input
              type="radio"
              name="treeType"
              value="phylo"
              checked={treeType === "phylo"}
              onChange={() => setTreeType("phylo")}
            />{" "}
            Phylogram&nbsp;(includes branch lengths)
          </label>
          <br />
          <label>
            <input
              type="radio"
              name="treeType"
              value="clado"
              checked={treeType === "clado"}
              onChange={() => setTreeType("clado")}
            />{" "}
            Cladogram&nbsp;(no branch lengths)
          </label>
        </div>

        <div style={{ marginBottom: 10 }}>
          <label>Branch line thickness: </label>
          <input
            type="number"
            value={branchThickness}
            onChange={(e) => setBranchThickness(Number(e.target.value))}
            style={{ width: 60 }}
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label>Asymmetry ratio threshold: </label>
          <input
            type="number"
            value={asymmetryThreshold}
            onChange={(e) => setAsymmetryThreshold(Number(e.target.value))}
            style={{ width: 60 }}
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label>Tip Name Font Size: </label>
          <input
            type="number"
            min={6}
            max={72}
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            style={{ width: 60 }}
          />
        </div>

        <div
          style={{
            marginBottom: 10,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <label>Tip Name Color: </label>
          <select
            value={tipLabelColor}
            onChange={(e) => setTipLabelColor(e.target.value)}
            style={{ flexGrow: 1 }}
          >
            <option value="#00ff00">Lime Green</option>
            <option value="#66cc66">Soft Green</option>
            <option value="#ff0000">Red</option>
            <option value="#0000ff">Blue</option>
            <option value="#ff00ff">Magenta</option>
            <option value="#ffa500">Orange</option>
            <option value="#000000">Black</option>
            <option value="#ffffff">White</option>
          </select>
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              border: "1px solid #ccc",
              backgroundColor: tipLabelColor,
            }}
            title={`Current: ${tipLabelColor}`}
          />
        </div>

        <div style={{ textAlign: "right" }}>
          <button
            ref={modalPrimaryRef}
            className="modal-button"
            onClick={() => setShowOptionsModal(false)}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
