import { useCanvasContext } from "../../context/CanvasContext";

export default function AboutModal() {
  const { setShowAboutModal } = useCanvasContext();

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "flex", justifyContent: "center", alignItems: "center",
        zIndex: 10000,
      }}
      onClick={() => setShowAboutModal(false)}
    >
      <div
        className="modal-panel"
        style={{
          padding: 24,
          width: 360,
          maxWidth: "90%",
          textAlign: "center",
          background: "#fff",
          borderRadius: "8px",
          boxShadow: "0 2px 10px rgba(0, 0, 0, 0.2)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Treemble icon */}
        <img
          src="/icons/icon.png"
          alt="Treemble Logo"
          style={{
            width: "60px",
            height: "60px",
            marginBottom: "12px",
            borderRadius: "8px",
          }}
        />

        <h3 style={{ margin: "0 0 10px" }}>Treemble v1.3</h3>
        <p style={{ marginBottom: 10 }}>
          <strong>Created by John B. Allard</strong>
        </p>
        <p style={{ fontSize: "0.9em", lineHeight: "1.5" }}>
          © 2025 John Allard<br />
          All rights reserved.
        </p>

        <div style={{ marginTop: 16 }}>
          <button className="modal-button" onClick={() => setShowAboutModal(false)}>Close</button>
        </div>
      </div>
    </div>
  );
}