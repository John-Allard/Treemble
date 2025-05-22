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
        <h3>Treemble v1.2</h3>
        <p style={{ marginBottom: 10 }}><strong>Created by John B. Allard</strong></p>
        <p style={{ fontSize: "0.9em" }}>
          © 2025 John Allard. All rights reserved.<br /><br />
          You can use Tip Name Extractor GPT to generate a tip names text file for the species names in a tree image: https://chatgpt.com/g/g-rwiIPwboh-tip-name-extractor
        </p>
        <hr style={{ margin: "16px 0" }} />
        <h4 style={{ margin: "10px 0 4px" }}>Keyboard Shortcuts</h4>
        <table style={{ width: "100%", fontSize: "0.85em", textAlign: "left", marginTop: 6 }}>
          <tbody>
            <tr><td><strong>T</strong></td><td>Switch to Tip node mode</td></tr>
            <tr><td><strong>I</strong></td><td>Switch to Internal node mode</td></tr>
            <tr><td><strong>R</strong></td><td>Switch to Root node mode</td></tr>
            <tr><td><strong>D</strong></td><td>Toggle Tip Detection mode</td></tr>
            <tr><td><strong>S</strong></td><td>Toggle tree overlay (Show/Hide)</td></tr>
            <tr><td><strong>C</strong></td><td>Start or cancel calibration</td></tr>
            <tr><td><strong>E</strong></td><td>Equalize Tips</td></tr>
            <tr><td><strong>B</strong></td><td>Toggle B/W image mode</td></tr>
            <tr><td><strong>[ </strong>and<strong> ]</strong></td><td>Zoom out / in (the square bracket buttons)</td></tr>
            <tr><td><strong>+ </strong>and<strong> -</strong></td><td>Increase / decrease font size</td></tr>
            <tr><td><strong>P</strong></td><td>Pencil draw mode (only in blank canvas)</td></tr>
            <tr><td><strong>L</strong></td><td>Line draw mode (only in blank canvas)</td></tr>
            <tr><td><strong>Backspace</strong></td><td>Eraser (only in blank canvas)</td></tr>
            <tr><td><strong>Ctrl+S</strong></td><td>Quick save CSV</td></tr>
            <tr><td><strong>Enter</strong></td><td>Confirm modal actions</td></tr>
          </tbody>
        </table>
        <div style={{ marginTop: 12 }}>
          <button className="modal-button" onClick={() => setShowAboutModal(false)}>Close</button>
        </div>
      </div>
    </div>
  );
}
