// src/hooks/useUndoRedo.ts
// Undo/Redo stack for node additions, deletions, and moves.
// Tracks dots and lockedEdges state changes.

import { useRef, useCallback } from "react";
import { Dot, Edge } from "../utils/tree";

/** Snapshot of the undoable state */
export interface UndoSnapshot {
    dots: Dot[];
    lockedEdges: Edge[];
}

/** Action descriptor for debugging/logging */
export interface UndoAction {
    type: "add" | "delete" | "move" | "batch" | "replace";
    description?: string;
}

const MAX_UNDO_STACK = 100;

export interface UseUndoRedoOptions {
    dots: Dot[];
    lockedEdges: Edge[];
    setDots: React.Dispatch<React.SetStateAction<Dot[]>>;
    setLockedEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
    /** Called after undo/redo to clear derived state (edges, freeNodes, newick) */
    onStateChange?: () => void;
}

export function useUndoRedo({
    dots,
    lockedEdges,
    setDots,
    setLockedEdges,
    onStateChange,
}: UseUndoRedoOptions) {
    // Stacks hold snapshots of state BEFORE each action
    const undoStack = useRef<UndoSnapshot[]>([]);
    const redoStack = useRef<UndoSnapshot[]>([]);

    /**
     * Record the current state before making a change.
     * Call this BEFORE mutating dots/lockedEdges.
     */
    const recordSnapshot = useCallback(
        (_action?: UndoAction) => {
            const snapshot: UndoSnapshot = {
                dots: dots.map(d => ({ ...d })),
                lockedEdges: lockedEdges.map(e => [...e] as Edge),
            };
            undoStack.current.push(snapshot);
            // Trim stack if too large
            if (undoStack.current.length > MAX_UNDO_STACK) {
                undoStack.current.shift();
            }
            // Clear redo stack on new action
            redoStack.current = [];
        },
        [dots, lockedEdges]
    );

    /**
     * Undo the last action: restore previous snapshot.
     */
    const undo = useCallback(() => {
        if (undoStack.current.length === 0) return false;

        // Save current state to redo stack
        const currentSnapshot: UndoSnapshot = {
            dots: dots.map(d => ({ ...d })),
            lockedEdges: lockedEdges.map(e => [...e] as Edge),
        };
        redoStack.current.push(currentSnapshot);

        // Pop and restore from undo stack
        const snapshot = undoStack.current.pop()!;
        setDots(snapshot.dots);
        setLockedEdges(snapshot.lockedEdges);
        onStateChange?.();
        return true;
    }, [dots, lockedEdges, setDots, setLockedEdges, onStateChange]);

    /**
     * Redo the last undone action.
     */
    const redo = useCallback(() => {
        if (redoStack.current.length === 0) return false;

        // Save current state to undo stack
        const currentSnapshot: UndoSnapshot = {
            dots: dots.map(d => ({ ...d })),
            lockedEdges: lockedEdges.map(e => [...e] as Edge),
        };
        undoStack.current.push(currentSnapshot);

        // Pop and restore from redo stack
        const snapshot = redoStack.current.pop()!;
        setDots(snapshot.dots);
        setLockedEdges(snapshot.lockedEdges);
        onStateChange?.();
        return true;
    }, [dots, lockedEdges, setDots, setLockedEdges, onStateChange]);

    /**
     * Clear all undo/redo history (e.g., when loading a new image).
     */
    const clearHistory = useCallback(() => {
        undoStack.current = [];
        redoStack.current = [];
    }, []);

    /**
     * Check if undo is available.
     */
    const canUndo = useCallback(() => undoStack.current.length > 0, []);

    /**
     * Check if redo is available.
     */
    const canRedo = useCallback(() => redoStack.current.length > 0, []);

    return {
        recordSnapshot,
        undo,
        redo,
        clearHistory,
        canUndo,
        canRedo,
    };
}
