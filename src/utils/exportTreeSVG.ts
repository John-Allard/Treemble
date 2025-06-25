import type { TreeGeometry } from "./TreeGeometry";
import type { Dot } from "./tree";

export interface ExportTreeSVGOptions {
  img: HTMLImageElement;
  baseName: string;
  geometry: TreeGeometry;
  edges: [number, number][];
  dots: Dot[];
  /** @deprecated rings are never included in exported SVG – kept optional for backward-compat */
  freeNodes?: number[];
  /** @deprecated rings are never included in exported SVG – kept optional for backward-compat */
  asymmetricalNodes?: number[];
  treeShape: "rectangular" | "circular";
  branchThickness: number;
  tipNames: string[];
  fontSize: number;
  tipLabelColor: string;
}

import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

const DOT_R = 8;
const LABEL_RADIAL_OFFSET = DOT_R + 2; // pixels outward from tip
// Branches should be black in the exported SVG
const EDGE_COLOUR = "#000000";


export async function exportTreeSVG(opts: ExportTreeSVGOptions) {
  const {
    img,
    baseName,
    geometry,
    edges,
    dots,
  
  
    treeShape,
    branchThickness,
    tipNames,
    fontSize,
    tipLabelColor,
  } = opts;

  const buildSVG = () => {
    const width = img.width;
    const height = img.height;
    const centre = geometry.getCentre();

    const edgePaths = edges
      .map(([pi, ci]) => {
        const parentDot = dots[pi];
        const childDot = dots[ci];
        if (!parentDot || !childDot) return "";
        const parentTree = geometry.toTree({ x: parentDot.x, y: parentDot.y });
        const childTree = geometry.toTree({ x: childDot.x, y: childDot.y });

        if (treeShape === "rectangular") {
          const start = geometry.toScreen(childTree);
          const mid = geometry.toScreen({ r: parentTree.r, theta: childTree.theta });
          const end = geometry.toScreen(parentTree);
          const d = `M ${start.x} ${start.y} L ${mid.x} ${mid.y} L ${end.x} ${end.y}`;
          return `<path d="${d}" fill="none" stroke="${EDGE_COLOUR}" stroke-width="${branchThickness}" />`;
        } else {
          const start = geometry.toScreen(childTree);
          const mid = geometry.toScreen({ r: parentTree.r, theta: childTree.theta });
          const end = geometry.toScreen(parentTree);
          const startAngle = geometry.getBreakTheta() - childTree.theta;
          const endAngle = geometry.getBreakTheta() - parentTree.theta;
          const cwDelta = (endAngle - startAngle + 2 * Math.PI) % (2 * Math.PI);
          const anticw = cwDelta > Math.PI;
          const largeArc = cwDelta > Math.PI ? 1 : 0;
          const sweep = anticw ? 0 : 1;
          const radius = parentTree.r;
          const d = `M ${start.x} ${start.y} L ${mid.x} ${mid.y} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${end.x} ${end.y}`;
          return `<path d="${d}" fill="none" stroke="${EDGE_COLOUR}" stroke-width="${branchThickness}" />`;
        }
      })
      .filter(Boolean)
      .join("");

    

    

    

    let labelTexts = "";
    if (tipNames.length) {
      const tips = dots
        .map((d, i) => ({ ...d, index: i }))
        .filter(d => d.type === "tip");
      if (treeShape === "rectangular") {
        tips.sort((a, b) => a.y - b.y).forEach((tip, i) => {
          const name = tipNames[i];
          if (!name) return;
          const x = tip.x + DOT_R + 2; // keep horizontal offset so text does not overlap branch end
          const y = tip.y; // align label vertically exactly with tip
          labelTexts += `<text x="${x}" y="${y}" font-size="${fontSize}" fill="${tipLabelColor}" text-anchor="start" dominant-baseline="middle">${name}</text>`;
        });
      } else if (centre) {
        const breakTheta = geometry.getBreakTheta();
        const TAU = 2 * Math.PI;
        const tipInfos = tips.map((tip, idx) => {
          const { r, theta } = geometry.toTree({ x: tip.x, y: tip.y });
          return { tip, idx, r, theta };
        });
        const sortedThetas = tipInfos.map(info => info.theta).sort((a, b) => a - b);
        const gaps = sortedThetas.map((angle, i, arr) =>
          i === 0 ? angle + TAU - arr[arr.length - 1] : angle - arr[i - 1]
        );
        const minGap = Math.min(...gaps);
        const ANG_SHIFT = Math.min(0.15, minGap / 2);
        const ordered = tipInfos
          .map(info => ({ info, anticDist: (TAU - info.theta) % TAU }))
          .sort((a, b) => a.anticDist - b.anticDist)
          .map(x => x.info);
        ordered.forEach((info, drawIdx) => {
          const raw = tipNames[drawIdx];
          if (!raw || !raw.trim()) return;
          const name = raw.trim();
          const canvasRad = breakTheta - info.theta;
          const onRight = Math.cos(canvasRad) > 0;
          const thetaLabel = info.theta + (onRight ? -ANG_SHIFT : ANG_SHIFT);
          const pos = geometry.toScreen({ r: info.r + LABEL_RADIAL_OFFSET, theta: thetaLabel });
          let rot = canvasRad;
          if (rot > Math.PI) rot -= 2 * Math.PI;
          if (rot < -Math.PI) rot += 2 * Math.PI;
          if (rot > Math.PI / 2 || rot < -Math.PI / 2) rot += Math.PI;
          const anchor = onRight ? "start" : "end";
          labelTexts += `<text x="${pos.x}" y="${pos.y}" font-size="${fontSize}" fill="${tipLabelColor}" text-anchor="${anchor}" dominant-baseline="middle" transform="rotate(${(rot * 180) / Math.PI} ${pos.x} ${pos.y})">${name}</text>`;
        });
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      edgePaths +
      labelTexts +
      `</svg>`;
  };

  const svgContent = buildSVG();
  const path = await save({
    defaultPath: `${baseName}_tree.svg`,
    filters: [{ name: "SVG", extensions: ["svg"] }],
  });
  if (path) {
    await writeFile(path, new TextEncoder().encode(svgContent));
  }
}
