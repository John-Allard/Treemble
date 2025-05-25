import { useCanvasContext } from "../../context/CanvasContext";

export default function AboutModal() {
  const { setShowAboutModal } = useCanvasContext();

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "flex", justifyContent: "center", alignItems: "center",
      }}
      onClick={() => setShowAboutModal(false)}
    >
      <div
        className="modal-panel"
        style={{ padding: 20, width: 360, maxWidth: "90%", textAlign: "center" }}
        onClick={e => e.stopPropagation()}
      >
        <h3>Treemble v1.3</h3>
        <p style={{ marginBottom: 10 }}><strong>Created by John B. Allard</strong></p>
        <p style={{ fontSize: "0.9em" }}>
          © 2025 John Allard. All rights reserved.<br /><br />
        </p>
        <div style={{ marginTop: 12 }}>
          <button className="modal-button" onClick={() => setShowAboutModal(false)}>Close</button>
        </div>
      </div>
    </div>
  );
}
