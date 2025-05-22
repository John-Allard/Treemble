import "./App.css";
import CanvasPanel from "./components/CanvasPanel";
import { CanvasProvider } from "./context/CanvasContext";

export default function App() {
  return (
    <CanvasProvider>
      <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
        <CanvasPanel />
      </div>
    </CanvasProvider>
  );
}