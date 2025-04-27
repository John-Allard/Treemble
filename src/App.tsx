import "./App.css";
import CanvasPanel from "./components/CanvasPanel";

export default function App() {
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <CanvasPanel />
    </div>
  );
}