// src/components/modals/BlankCanvasModal.tsx
import { useCanvasContext } from "../../context/CanvasContext";

export type BlankCanvasModalProps = {
  confirmBlankCanvas: () => void;
};

export default function BlankCanvasModal({
  confirmBlankCanvas
}: BlankCanvasModalProps) {
  const { showBlankCanvasModal, setShowBlankCanvasModal } = useCanvasContext();

  if (!showBlankCanvasModal) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={() => setShowBlankCanvasModal(false)}
    >
      <div
        className="modal-panel"
        style={{ padding: 20, width: 360 }}
        onClick={e => e.stopPropagation()}
      >
        <h3>Start New Blank Canvas?</h3>
        <p>This will remove all current nodes and tip names.</p>
        <div style={{ textAlign: "right" }}>
          <button
            className="modal-button"
            onClick={() => {
              setShowBlankCanvasModal(false);
              confirmBlankCanvas();
            }}
          >
            Yes, start new
          </button>{" "}
          <button
            className="modal-button"
            onClick={() => setShowBlankCanvasModal(false)}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
