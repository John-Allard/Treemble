import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

type Dot = {
  x: number;
  y: number;
  type: "tip" | "internal" | "root";
};

export async function saveCSV(dots: Dot[]) {
  const header = "x,y,type\n";
  const rows = dots.map(dot => `${dot.x},${dot.y},${dot.type}`).join("\n");
  const csvContent = header + rows;

  const savePath = await save({
    filters: [{ name: "CSV File", extensions: ["csv"] }],
    defaultPath: "nodes.csv"
  });

  if (savePath) {
    const encoded = new TextEncoder().encode(csvContent);
    await writeFile(savePath, encoded);
    console.log("✅ CSV saved to:", savePath);
  } else {
    console.log("⚠️ Save cancelled.");
  }
}