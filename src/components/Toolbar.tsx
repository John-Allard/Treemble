type ToolbarProps = {
    dotType: "tip" | "internal";
    setDotType: (type: "tip" | "internal") => void;
  };
  
  export default function Toolbar({ dotType, setDotType }: ToolbarProps) {
    return (
      <div style={{ padding: "10px", background: "#f0f0f0", display: "flex", gap: "10px" }}>
        <button onClick={() => setDotType("tip")} style={{ backgroundColor: dotType === "tip" ? "#add8e6" : "white" }}>
          Tip Mode (Blue)
        </button>
        <button onClick={() => setDotType("internal")} style={{ backgroundColor: dotType === "internal" ? "#f08080" : "white" }}>
          Internal Mode (Red)
        </button>
      </div>
    );
  }
  