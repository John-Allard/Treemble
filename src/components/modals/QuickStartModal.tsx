import { useCanvasContext } from "../../context/CanvasContext";

export default function QuickStartModal() {
    const { showQuickStartModal, setShowQuickStartModal } = useCanvasContext();
    if (!showQuickStartModal) return null;

    return (
        <div
            className="modal-backdrop"
            style={{
                background: "rgba(0,0,0,0.6)",
                alignItems: "flex-start",
                paddingTop: "2vh",
                zIndex: 10000,
            }}
            onClick={() => setShowQuickStartModal(false)}
        >
            <div
                className="modal-panel"
                style={{
                    width: "80vw",
                    maxWidth: "800px",
                    height: "90vh",
                    borderRadius: "8px",
                    overflowY: "auto",
                    padding: "24px",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header with icon */}
                <header style={{ display: "flex", alignItems: "center", marginBottom: "16px" }}>
                    <img
                        src="/icons/icon.png"
                        alt="Treemble Logo"
                        style={{ width: "60px", height: "60px", marginRight: "12px" }}
                    />
                    <h2 style={{ margin: 0, fontSize: "1.75rem" }}>Treemble Quick Start Guide</h2>
                </header>

                {/* Table of Contents */}
                <nav style={{ marginBottom: "24px" }}>
                    <h3 style={{ marginBottom: "8px" }}>Table of Contents</h3>
                    <ul style={{ paddingLeft: "20px", lineHeight: "1.8" }}>
                        <li><a href="#step1">1. Load or Create a Canvas</a></li>
                        <li><a href="#step2">2. Add Nodes</a></li>
                        <li><a href="#step3">3. Detect Tips Automatically</a></li>
                        <li><a href="#step4">4. Calibrate Scale</a></li>
                        <li><a href="#step5">5. Equalize Tips</a></li>
                        <li><a href="#step6">6. Show Tree</a></li>
                        <li><a href="#step7">7. Add Tip Names</a></li>
                        <li><a href="#step8">8. Save Newick</a></li>
                    </ul>
                </nav>
                <hr style={{ borderColor: "#e2e8f0", margin: "24px 0" }} />

                {/* Step 1 */}
                <section id="step1" style={{ marginBottom: "24px" }}>
                    <h3>Step 1: Load or Create a Canvas</h3>
                    <p>You can either open an existing tree image or start with a blank canvas:</p>
                    <ol>
                        <li><strong>File ▾ → Choose Tree Image</strong> to pick an image.</li>
                        <li><strong>File ▾ → Open Blank Canvas</strong> to begin fresh.</li>
                    </ol>
                    <p style={{ fontStyle: "italic" }}>
                        Blank canvas mode includes drawing tools for sketching your tree from scratch.
                    </p>
                    <img
                        src="/quickstart/step1.png"
                        alt="Load or create canvas"
                        style={{
                            width: "100%",
                            maxWidth: "250px",
                            margin: "1rem 0",
                            borderRadius: "4px",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
                        }}
                    />
                </section>
                <hr style={{ borderColor: "#e2e8f0", margin: "24px 0" }} />

                {/* Step 2 */}
                <section id="step2" style={{ marginBottom: "24px" }}>
                    <h3>Step 2: Add Nodes</h3>
                    <p>Manually mark nodes by:</p>
                    <ul>
                        <li>Selecting the <strong>Tip</strong>, <strong>Internal</strong>, or <strong>Root</strong> tool.</li>
                        <li>Aligning the crosshair over your node, then clicking to add.</li>
                        <li>Clicking again on a node to remove it.</li>
                    </ul>
                    <img
                        src="/quickstart/step2.png"
                        alt="Add nodes manually"
                        style={{
                            width: "100%",
                            maxWidth: "250px",
                            margin: "1rem 0",
                            borderRadius: "4px",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
                        }}
                    />
                </section>
                <hr style={{ borderColor: "#e2e8f0", margin: "24px 0" }} />

                {/* Step 3 */}
                <section id="step3" style={{ marginBottom: "24px" }}>
                    <h3>Step 3: Detect Tips Automatically</h3>
                    <p>Let Treemble find clear tips for you:</p>
                    <ol>
                        <li>Click the <strong>Detect Tips</strong> button.</li>
                        <li>Click the left mouse button and drag to draw a rectangle around all tips, then release the button.</li>
                        <li>Treemble places the tip nodes automatically.</li>
                    </ol>
                    <img
                        src="/quickstart/step3.png"
                        alt="Detect tips automatically"
                        style={{
                            width: "100%",
                            maxWidth: "350px",
                            margin: "1rem 0",
                            borderRadius: "4px",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
                        }}
                    />
                </section>
                <hr style={{ borderColor: "#e2e8f0", margin: "24px 0" }} />

                {/* Step 4 */}
                <section id="step4" style={{ marginBottom: "24px" }}>
                    <h3>Step 4: Calibrate Scale</h3>
                    <p>Convert pixel distances into scaled distances or times:</p>
                    <ol>
                        <li>Click <strong>Calibrate Scale</strong>.</li>
                        <li>Click two known points (e.g., scale bar ends).</li>
                        <li>Enter the numeric distance (no units) when prompted.</li>
                    </ol>
                    <img
                        src="/quickstart/step4.png"
                        alt="Calibrate scale"
                        style={{
                            width: "100%",
                            maxWidth: "600px",
                            margin: "1rem 0",
                            borderRadius: "4px",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
                        }}
                    />
                </section>
                <hr style={{ borderColor: "#e2e8f0", margin: "24px 0" }} />

                {/* Step 5 */}
                <section id="step5" style={{ marginBottom: "24px" }}>
                    <h3>Step 5: Equalize Tips</h3>
                    <p>Align all tip nodes to the same horizontal position:</p>
                    <ol>
                        <li>Click <strong>Equalize Tips</strong>.</li>
                        <li>Click once at the desired X-axis coordinate.</li>
                        <li>Confirm in the popup.</li>
                    </ol>
                    <img
                        src="/quickstart/step5.png"
                        alt="Equalize tips"
                        style={{
                            width: "100%",
                            maxWidth: "600px",
                            margin: "1rem 0",
                            borderRadius: "4px",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
                        }}
                    />
                </section>
                <hr style={{ borderColor: "#e2e8f0", margin: "24px 0" }} />

                {/* Step 6 */}
                <section id="step6" style={{ marginBottom: "24px" }}>
                    <h3>Step 6: Show Tree</h3>
                    <p>Render your tree branches:</p>
                    <ol>
                        <li>Click <strong>Show Tree</strong>.</li>
                        <li>The green branches plotted by Treemble should perfectly overlap the branches in your image.</li>
                    </ol>
                    <img
                        src="/quickstart/step6.png"
                        alt="Show tree with branches"
                        style={{
                            width: "100%",
                            maxWidth: "350px",
                            margin: "1rem 0",
                            borderRadius: "4px",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                        }}
                    />
                </section>
                <hr style={{ borderColor: "#e2e8f0", margin: "24px 0" }} />

                {/* Step 7 */}
                <section id="step7" style={{ marginBottom: "24px" }}>
                    <h3>Step 7: Add Tip Names</h3>
                    <p>Annotate your tips with custom names:</p>
                    <ol>
                        <li>You can edit the names within Treemble using <strong>File ▾ → Edit Tip Names</strong>.</li>
                        <li>Or, you can get a list of names from the image with <strong>Help ▾ → Name Extractor GPT…</strong>.</li>
                        <li>Click <strong>File ▾ → Load Tip Names…</strong>.</li>
                        <li>Select your TXT file containing one name on each line in the order the tips appear in the tree.</li>
                    </ol>
                    <img
                        src="/quickstart/step7.png"
                        alt="Load tip names file"
                        style={{
                            width: "100%",
                            maxWidth: "550px",
                            margin: "1rem 0",
                            borderRadius: "4px",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                        }}
                    />
                </section>
                <hr style={{ borderColor: "#e2e8f0", margin: "24px 0" }} />

                {/* Step 8 */}
                <section id="step8" style={{ marginBottom: "24px" }}>
                    <h3>Step 8: Save Newick</h3>
                    <p>Export your tree as a Newick string:</p>
                    <ol>
                        <li>Click <strong>Show Newick</strong> to view the string.</li>
                        <li>Copy it or click the <strong>Save .nwk</strong> button to save a newick file.</li>
                    </ol>
                    <img
                        src="/quickstart/step8.png"
                        alt="Save Newick string"
                        style={{
                            width: "100%",
                            maxWidth: "350px",
                            margin: "1rem 0",
                            borderRadius: "4px",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                        }}
                    />
                </section>

                {/* Close button */}
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
