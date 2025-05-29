// src/components/modals/NewickModal.tsx
import { useRef } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { useCanvasContext } from "../../context/CanvasContext";
import { isTreeUltrametric } from "../../utils/tree";

export default function NewickModal() {
  const {
    showNewickModal,
    setShowNewickModal,
    newick,
    tipNames,
    treeType,
    timePerPixel,
    rootHeight,
    dots,
    baseName,
    geometry,
    treeShape,
  } = useCanvasContext();

  const modalPrimaryRef = useRef<HTMLButtonElement>(null);

  if (!showNewickModal) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={() => setShowNewickModal(false)}
    >
      <div
        className="modal-panel"
        style={{ padding: 20, width: 400, maxWidth: "90%" }}
        onClick={e => e.stopPropagation()}
      >
        <h3>Newick string</h3>
        <textarea
          readOnly
          value={newick}
          style={{ width: "100%", height: 120 }}
        />
        {tipNames.length === 0 && (
          <p style={{ fontSize: "0.85em", marginTop: 6 }}>
            ⚠️ Tip names have <strong>not</strong> been added. Default names (tip1, tip2…) are used.
          </p>
        )}
        {treeType === "phylo" ? (
          <>
            {timePerPixel === 1 ? (
              <p style={{ fontSize: "0.85em", marginTop: 6 }}>
                ⚠️ Lengths are expressed in raw pixel counts and have <strong>not</strong> been calibrated.
              </p>
            ) : (
              <p style={{ fontSize: "0.85em", marginTop: 6 }}>
                Lengths calibrated to {timePerPixel.toFixed(6)} units per pixel.
              </p>
            )}
            {(() => {
              // project dots if circular
              const projected = treeShape === "circular"
                ? dots.map(d => ({
                    ...d,
                    x: geometry.toTree({ x: d.x, y: d.y }).r,
                    y: geometry.toTree({ x: d.x, y: d.y }).theta
                  }))
                : dots;

              const ultra = isTreeUltrametric(projected, treeShape);
              return (
                <p style={{ fontSize: "0.85em", marginTop: 6 }}>
                  {ultra
                    ? "The tree is ultrametric."
                    : <>⚠️ The tree is <strong>not</strong> ultrametric.</>}
                </p>
              );
            })()}
            {rootHeight !== null && (
              <p style={{ fontSize: "0.85em", marginTop: 6 }}>
                The root is at a height of <strong>{rootHeight.toFixed(6)}</strong> units.
              </p>
            )}
          </>
        ) : (
          <p style={{ fontSize: "0.85em", marginTop: 6 }}>
            ⚠️ Cladogram mode is enabled, no branch lengths included.
          </p>
        )}
        <div style={{ textAlign: "right", marginTop: 8 }}>
          <button
            ref={modalPrimaryRef}
            className="modal-button"
            onClick={async () => {
              const path = await save({
                defaultPath: `${baseName}_extracted_newick.nwk`,
                filters: [{ name: "NWK", extensions: ["nwk"] }],
              });
              if (path) {
                await writeFile(path, new TextEncoder().encode(newick));
              }
            }}
          >
            Save .nwk
          </button>{" "}
          <button
            className="modal-button"
            onClick={() => setShowNewickModal(false)}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
