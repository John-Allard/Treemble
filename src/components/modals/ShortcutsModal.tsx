import { useCanvasContext } from "../../context/CanvasContext";

/** Simple read-only hot-keys reference */
export default function ShortcutsModal() {
    const { showShortcutsModal, setShowShortcutsModal } = useCanvasContext();

    if (!showShortcutsModal) return null;

    return (
        <div
            className="modal-backdrop"
            onClick={() => setShowShortcutsModal(false)}
        >
            <div
                className="modal-panel"
                style={{ padding: 20, width: 360, maxWidth: "90%" }}
                onClick={e => e.stopPropagation()}
            >
                <h3>Keyboard Shortcuts</h3>
                <table style={{ width: "100%", fontSize: "0.9em", textAlign: "left" }}>
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
                        <tr><td><strong>Shift+Click</strong></td><td>Connect node to selected parent. Assigning 3 or more nodes to one parent allows polytomies to be specified.</td></tr>
                        <tr><td><strong>Enter</strong></td><td>Confirm modal actions</td></tr>
                    </tbody>
                </table>
                <div style={{ textAlign: "right", marginTop: 12 }}>
                    <button className="modal-button" onClick={() => setShowShortcutsModal(false)}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
