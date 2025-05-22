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
  } = useCanvasContext();

  if (!showEqualizeXConfirmModal || equalizeX == null) return null;

  const confirmed = () => {
    const rounded = Math.round(equalizeX);
    const newDots = dots.map(d =>
      d.type === "tip" ? { ...d, x: equalizeX } : d
    );
    setDots(newDots);
    setShowEqualizeXConfirmModal(false);
    setBanner({
      text: `Tips equalized at X position ${rounded}.`,
      type: "success"
    });
    setTimeout(() => setBanner(null), 3000);
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "flex", justifyContent: "center", alignItems: "center"
      }}
      onClick={() => setShowEqualizeXConfirmModal(false)}
    >
      <div
        className="modal-panel"
        style={{ padding: 20, width: 320 }}
        onClick={e => e.stopPropagation()}
      >
        <h3>Equalize Tips</h3>
        <p>
          Set all tip nodes to an X-axis position of{" "}
          <strong>{Math.round(equalizeX)}</strong>?
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
