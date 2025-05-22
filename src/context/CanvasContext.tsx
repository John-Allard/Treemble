// src/context/CanvasContext.tsx
import React, { createContext, useContext } from "react";
import { useCanvasState } from "../hooks/useCanvasState";

type CanvasState = ReturnType<typeof useCanvasState>;

const CanvasContext = createContext<CanvasState | null>(null);

// Provider that wraps your App
export function CanvasProvider({ children }: { children: React.ReactNode }) {
  const state = useCanvasState();
  return (
    <CanvasContext.Provider value={state}>
      {children}
    </CanvasContext.Provider>
  );
}

// Hook for consuming the context
export function useCanvasContext(): CanvasState {
  const ctx = useContext(CanvasContext);
  if (!ctx) {
    throw new Error("useCanvasContext must be used within CanvasProvider");
  }
  return ctx;
}
