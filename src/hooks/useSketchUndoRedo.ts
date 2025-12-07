// src/hooks/useSketchUndoRedo.ts
// Undo/Redo for sketch/drawing layer using ImageData snapshots.

const MAX_SKETCH_UNDO_STACK = 50;

/** Stores ImageData snapshots for the sketch canvas */
interface SketchUndoState {
    undoStack: ImageData[];
    redoStack: ImageData[];
}

// Module-level state (matches how sketchMasterCanvas is handled)
const sketchUndoState: SketchUndoState = {
    undoStack: [],
    redoStack: [],
};

/**
 * Record the current sketch canvas state before making a change.
 * Call this BEFORE drawing a stroke.
 */
export function recordSketchSnapshot(masterCanvas: HTMLCanvasElement | null): void {
    if (!masterCanvas) return;
    
    const ctx = masterCanvas.getContext("2d");
    if (!ctx) return;
    
    const imageData = ctx.getImageData(0, 0, masterCanvas.width, masterCanvas.height);
    sketchUndoState.undoStack.push(imageData);
    
    // Trim stack if too large
    if (sketchUndoState.undoStack.length > MAX_SKETCH_UNDO_STACK) {
        sketchUndoState.undoStack.shift();
    }
    
    // Clear redo stack on new action
    sketchUndoState.redoStack = [];
}

/**
 * Undo the last sketch action.
 * Returns true if undo was performed.
 */
export function undoSketch(
    masterCanvas: HTMLCanvasElement | null,
    sketchRef: React.RefObject<HTMLCanvasElement>
): boolean {
    if (!masterCanvas || sketchUndoState.undoStack.length === 0) return false;
    
    const ctx = masterCanvas.getContext("2d");
    if (!ctx) return false;
    
    // Save current state to redo stack
    const currentImageData = ctx.getImageData(0, 0, masterCanvas.width, masterCanvas.height);
    sketchUndoState.redoStack.push(currentImageData);
    
    // Pop and restore from undo stack
    const snapshot = sketchUndoState.undoStack.pop()!;
    ctx.putImageData(snapshot, 0, 0);
    
    // Sync to on-screen sketch layer
    if (sketchRef.current) {
        const sctx = sketchRef.current.getContext("2d");
        if (sctx) {
            sctx.clearRect(0, 0, sketchRef.current.width, sketchRef.current.height);
            sctx.drawImage(masterCanvas, 0, 0, sketchRef.current.width, sketchRef.current.height);
        }
    }
    
    return true;
}

/**
 * Redo the last undone sketch action.
 * Returns true if redo was performed.
 */
export function redoSketch(
    masterCanvas: HTMLCanvasElement | null,
    sketchRef: React.RefObject<HTMLCanvasElement>
): boolean {
    if (!masterCanvas || sketchUndoState.redoStack.length === 0) return false;
    
    const ctx = masterCanvas.getContext("2d");
    if (!ctx) return false;
    
    // Save current state to undo stack
    const currentImageData = ctx.getImageData(0, 0, masterCanvas.width, masterCanvas.height);
    sketchUndoState.undoStack.push(currentImageData);
    
    // Pop and restore from redo stack
    const snapshot = sketchUndoState.redoStack.pop()!;
    ctx.putImageData(snapshot, 0, 0);
    
    // Sync to on-screen sketch layer
    if (sketchRef.current) {
        const sctx = sketchRef.current.getContext("2d");
        if (sctx) {
            sctx.clearRect(0, 0, sketchRef.current.width, sketchRef.current.height);
            sctx.drawImage(masterCanvas, 0, 0, sketchRef.current.width, sketchRef.current.height);
        }
    }
    
    return true;
}

/**
 * Clear all sketch undo/redo history.
 */
export function clearSketchHistory(): void {
    sketchUndoState.undoStack = [];
    sketchUndoState.redoStack = [];
}

/**
 * Check if sketch undo is available.
 */
export function canUndoSketch(): boolean {
    return sketchUndoState.undoStack.length > 0;
}

/**
 * Check if sketch redo is available.
 */
export function canRedoSketch(): boolean {
    return sketchUndoState.redoStack.length > 0;
}
