import { useCanvasContext } from "../../context/CanvasContext";

export default function QuickStartModal() {
    const {
        showQuickStartModal,
        setShowQuickStartModal,
    } = useCanvasContext();

    if (!showQuickStartModal) return null;

    return (
        <div
            style={{
                position: "fixed",
                top: 0, left: 0, right: 0, bottom: 0,
                background: "rgba(0,0,0,0.6)",
                display: "flex", justifyContent: "center", alignItems: "flex-start",
                paddingTop: "2vh", zIndex: 10000,
            }}
            onClick={() => setShowQuickStartModal(false)}
        >
            <div
                className="modal-panel"
                style={{
                    width: "80vw",
                    maxWidth: "800px",
                    height: "90vh",
                    overflowY: "auto",
                    padding: "24px",
                }}
                onClick={e => e.stopPropagation()}
            >
                <h2>Treemble Quick Start Guide</h2>
                <nav style={{ marginBottom: "16px" }}>
                    <strong>Table of Contents</strong>
                    <ul>
                        <li><a href="#step1">1. Load or Create a Canvas</a></li>
                        <li><a href="#step2">2. Add Nodes</a></li>
                        <li><a href="#step3">3. Detect Tips</a></li>
                        <li><a href="#step4">4. Calibrate Scale</a></li>
                        <li><a href="#step5">5. Equalize Tips</a></li>
                        <li><a href="#step6">6. Show & Export Tree</a></li>
                    </ul>
                </nav>

                <section id="step1" style={{ marginBottom: "24px" }}>
                    <h3>Step 1: Load or Create a Canvas</h3>
                    <p>
                        You can either open an existing image file of your tree, or start a new blank canvas:
                    </p>
                    <ol>
                        <li>Click <strong>File ▾ → Choose Tree Image</strong> to pick an image.</li>
                        <li>Or click <strong>File ▾ → Open Blank Canvas</strong> to begin fresh.</li>
                    </ol>
                    <p style={{ fontStyle: "italic" }}>
                        (A blank canvas is useful if you want to draw your own branches or test tips detection.)
                    </p>
                    <img
                        src="/quickstart/step1.png"
                        alt="Screenshot of loading a tree image"
                        style={{
                            width: '100%',
                            maxWidth: '250px',
                            margin: '1rem 0',
                            borderRadius: '4px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                        }}
                    />
                </section>

                <section id="step2" style={{ marginBottom: "24px" }}>
                    <h3>Step 2: Add Nodes</h3>
                    <p>
                        To mark nodes manually:
                    </p>
                    <ul>
                        <li>Select the <strong>Tip</strong>, <strong>Internal</strong>, or <strong>Root</strong> button.</li>
                        <li>Use the crosshairs to line up your cursor with the nodes in your tree.</li>
                        <li>Click the left mouse button to add a node.</li>
                        <li>Click again with the left button on top of a node to remove it.</li>
                    </ul>
                    <img
                        src="/quickstart/step2.png"
                        alt="Screenshot of inserting an internal node"
                        style={{
                            width: '100%',
                            maxWidth: '250px',
                            margin: '1rem 0',
                            borderRadius: '4px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                        }}
                    />
                </section>

                <section id="step3" style={{ marginBottom: "24px" }}>
                    <h3>Step 3: Detect Tips Automatically</h3>
                    <p>
                        If your tree tips are clear, you can let the app find them:
                    </p>
                    <ol>
                        <li>Click the <strong>Detect Tips</strong> button.</li>
                        <li>Drag a box around the area containing tips.</li>
                        <li>The app will place tip nodes for you automatically.</li>
                    </ol>
                    <img
                        src="/quickstart/step3.png"
                        alt="Screenshot of detecting tips"
                        style={{
                            width: '100%',
                            maxWidth: '350px',
                            margin: '1rem 0',
                            borderRadius: '4px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                        }}
                    />
                </section>

                <section id="step4" style={{ marginBottom: "24px" }}>
                    <h3>Step 4: Calibrate Scale</h3>
                    <p>
                        To convert pixel lengths into real units:
                    </p>
                    <ol>
                        <li>Click <strong>Calibrate Scale</strong>.</li>
                        <li>Treemble will prompt you to click two points on your scale bar (or a known distance apart). </li>
                        <li>Enter that distance as a number in the entry prompt that pops up (don't include units like "mya").</li>
                    </ol>
                    <img
                        src="/quickstart/step4.png"
                        alt="Screenshot of calibration"
                        style={{
                            width: '100%',
                            maxWidth: '600px',
                            margin: '1rem 0',
                            borderRadius: '4px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                        }}
                    />
                </section>

                <section id="step5" style={{ marginBottom: "24px" }}>
                    <h3>Step 5: Equalize Tips</h3>
                    <p>
                        To align all tip nodes to the same radius or X-position:
                    </p>
                    <ol>
                        <li>Click <strong>Equalize Tips</strong>.</li>
                        <li>Click on the canvas at the desired X-axis position.</li>
                        <li>Confirm in the popup.</li>
                        <li>All tip nodes are set to that horizontal position, making your tree ultrametric.</li>
                    </ol>
                    <img
                        src="/quickstart/step5.png"
                        alt="Screenshot of equalizing tips"
                        style={{
                            width: '100%',
                            maxWidth: '600px',
                            margin: '1rem 0',
                            borderRadius: '4px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                        }}
                    />
                </section>

                <section id="step6" style={{ marginBottom: "24px" }}>
                    <h3>Step 6: Show & Export Tree</h3>
                    <p>
                        Once your nodes look correct:
                    </p>
                    <ol>
                        <li>Click <strong>Show Tree</strong> to render branches.</li>
                        <li>Click <strong>Show Newick</strong> to view or save the Newick string.</li>
                        <li>You can also save a CSV of node coordinates with <strong>File ▾ → Save CSV</strong>.</li>
                    </ol>
                    <img
                        src="/quickstart/step6.png"
                        alt="Screenshot of showing the tree"
                        style={{
                            width: '100%',
                            maxWidth: '350px',
                            margin: '1rem 1.5rem 1rem 0',
                            borderRadius: '4px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                        }}
                    />
                    <img
                        src="/quickstart/step6b.png"
                        alt="Screenshot of showing the newick"
                        style={{
                            width: '100%',
                            maxWidth: '350px',
                            margin: '1rem 0',
                            borderRadius: '4px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                        }}
                    />
                </section>

                <div style={{ textAlign: "right", marginTop: "16px" }}>
                    <button
                        className="modal-button"
                        onClick={() => setShowQuickStartModal(false)}
                    >
                        Close Guide
                    </button>
                </div>
            </div>
        </div>
    );
}
