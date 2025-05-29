// src/components/modals/EqualizeModal.tsx
import { useCanvasContext } from "../../context/CanvasContext";

export type EqualizeModalProps = {};

export default function EqualizeModal(_: EqualizeModalProps) {
  const {
    equalizeX,
    showEqualizeXConfirmModal,
    setShowEqualizeXConfirmModal,
    dots,
    setDots,
    setBanner,
    geometry,
    treeShape,
  } = useCanvasContext();

  if (!showEqualizeXConfirmModal || equalizeX == null) return null;

  const confirmed = () => {
    const rounded = Math.round(equalizeX);
    let newDots;

    if (treeShape === "rectangular") {
      // old behavior: lock X
      newDots = dots.map(d =>
        d.type === "tip" ? { ...d, x: equalizeX } : d
      );
      setBanner({
        text: `Tips equalized at X position ${rounded}.`,
        type: "success"
      });
    } else {
      // circular: lock radial distance
      newDots = dots.map(d => {
        if (d.type !== "tip") return d;
        const t = geometry.toTree({ x: d.x, y: d.y });
        const screen = geometry.toScreen({ r: equalizeX, theta: t.theta });
        return { ...d, x: screen.x, y: screen.y };
      });
      setBanner({
        text: `Tips equalized at radial distance ${rounded}.`,
        type: "success"
      });
    }

    setDots(newDots);
    setShowEqualizeXConfirmModal(false);
    setTimeout(() => setBanner(null), 3000);
  };

  return (
    <div
      className="modal-backdrop"
      onClick={() => setShowEqualizeXConfirmModal(false)}
    >
      <div
        className="modal-panel"
        style={{ padding: 20, width: 320 }}
        onClick={e => e.stopPropagation()}
      >
        <h3>Equalize Tips</h3>
        <p>
          {treeShape === "circular"
            ? <>Equalize all tip nodes to this radial distance?</>
            : <>Set all tip nodes to an X-axis position of <strong>{Math.round(equalizeX)}</strong>?</>}
        </p>
        <div style={{ textAlign: "right" }}>
          <button
            className="modal-button"
            onClick={confirmed}
          >
            Yes
          </button>{" "}
          <button
            className="modal-button"
            onClick={() => setShowEqualizeXConfirmModal(false)}
          >
            No
          </button>
        </div>
      </div>
    </div>
  );
}
