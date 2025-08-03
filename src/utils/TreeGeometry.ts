// src/utils/TreeGeometry.ts

export interface TreeGeometry {
    /** Screen → “tree” coords */
    toTree(p: { x: number; y: number }): { r: number; theta: number };
    /** “Tree” → screen coords */
    toScreen(t: { r: number; theta: number }): { x: number; y: number };
    equalizeTarget(p: { x: number; y: number }): number;
    distance(p1: { x: number; y: number }, p2: { x: number; y: number }): number;
    drawEdge(
        ctx: CanvasRenderingContext2D,
        parent: { r: number; theta: number },
        child: { r: number; theta: number },
        scale: number,
        centre: { x: number; y: number }
    ): void;
    /** circular-only helpers (no-ops for rectangular) */
    setCentre(pt: { x: number; y: number }): void;
    setBreakPoint(pt: { x: number; y: number }): void;
    /** expose centre for drawing */
    getCentre(): { x: number; y: number } | null;
    getBreakTheta(): number;
}

/** Rectangular (existing) no-op geometry */
export class RectangularGeometry implements TreeGeometry {
    toTree(p: { x: number; y: number }) {
        return { r: p.x, theta: p.y };
    }
    toScreen(t: { r: number; theta: number }) {
        return { x: t.r, y: t.theta };
    }
    equalizeTarget(p: { x: number; y: number }) {
        return p.x;
    }
    distance(p1: { x: number; y: number }, p2: { x: number; y: number }) {
        return Math.abs(p2.x - p1.x);
    }
    drawEdge(
        ctx: CanvasRenderingContext2D,
        parent: { r: number; theta: number },
        child: { r: number; theta: number },
        scale: number,
        _centre: { x: number; y: number }
    ): void {
        const cx = child.r * scale;
        const cy = child.theta * scale;
        const px = parent.r * scale;
        const py = parent.theta * scale;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(px, cy);
        ctx.lineTo(px, py);
        ctx.stroke();
    }
    setCentre(_pt: { x: number; y: number }): void { /* noop */ }
    setBreakPoint(_pt: { x: number; y: number }): void { /* noop */ }
    getCentre(): { x: number; y: number } | null { return null; }
    getBreakTheta(): number {
        return 0;
    }
    
}

/** Freeform geometry: identity transforms with straight edges */
export class FreeformGeometry implements TreeGeometry {
    toTree(p: { x: number; y: number }) {
        return { r: p.x, theta: p.y };
    }
    toScreen(t: { r: number; theta: number }) {
        return { x: t.r, y: t.theta };
    }
    equalizeTarget(p: { x: number; y: number }) {
        return p.x;
    }
    distance(p1: { x: number; y: number }, p2: { x: number; y: number }) {
        return Math.hypot(p2.x - p1.x, p2.y - p1.y);
    }
    drawEdge(
        ctx: CanvasRenderingContext2D,
        parent: { r: number; theta: number },
        child: { r: number; theta: number },
        scale: number,
        _centre: { x: number; y: number }
    ): void {
        const cx = child.r * scale;
        const cy = child.theta * scale;
        const px = parent.r * scale;
        const py = parent.theta * scale;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(px, py);
        ctx.stroke();
    }
    setCentre(_pt: { x: number; y: number }): void { /* noop */ }
    setBreakPoint(_pt: { x: number; y: number }): void { /* noop */ }
    getCentre(): { x: number; y: number } | null { return null; }
    getBreakTheta(): number { return 0; }
}

/** Circular geometry with centre & break‐angle to be set at runtime */
export class CircularGeometry implements TreeGeometry {
    private centre: { x: number; y: number } | null = null;
    private breakTheta = 0;

    /** Call once when user picks centre */
    setCentre(pt: { x: number; y: number }) {
        this.centre = pt;
    }

    /** Call once when user picks break‐point */
    setBreakPoint(pt: { x: number; y: number }) {
        if (!this.centre) throw new Error("Centre must be set first");
        const dx = pt.x - this.centre.x,
            dy = pt.y - this.centre.y;
        this.breakTheta = Math.atan2(dy, dx);
    }

    getCentre(): { x: number; y: number } | null {
        return this.centre;
    }
    getBreakTheta(): number {
        return this.breakTheta;
    }
    /** Clear any tentative centre/break that was never finalised. */
    reset() {
        this.centre     = null;
        this.breakTheta = 0;
    }

    toTree(p: { x: number; y: number }) {
        if (!this.centre) throw new Error("Centre not set");
        const dx = p.x - this.centre.x,
            dy = p.y - this.centre.y;
        const r = Math.hypot(dx, dy);
        // θ measured clockwise from breakTheta
        let raw = Math.atan2(dy, dx);
        let theta = (this.breakTheta - raw + 2 * Math.PI) % (2 * Math.PI);
        return { r, theta };
    }

    toScreen(t: { r: number; theta: number }) {
        if (!this.centre) throw new Error("Centre not set");
        // reverse: angle = breakTheta – θ
        const angle = this.breakTheta - t.theta;
        return {
            x: this.centre.x + t.r * Math.cos(angle),
            y: this.centre.y + t.r * Math.sin(angle),
        };
    }

    equalizeTarget(p: { x: number; y: number }) {
        if (!this.centre) throw new Error("Centre not set");
        const dx = p.x - this.centre.x,
            dy = p.y - this.centre.y;
        return Math.hypot(dx, dy);
    }

    distance(p1: { x: number; y: number }, p2: { x: number; y: number }) {
        // true Euclidean distance
        return Math.hypot(p2.x - p1.x, p2.y - p1.y);
    }

    drawEdge(
        ctx: CanvasRenderingContext2D,
        parent: { r: number; theta: number },
        child: { r: number; theta: number },
        scale: number,
        centre: { x: number; y: number }
    ): void {
        if (!this.centre) return;          // safety

        /* Canvas angles (α) are measured clockwise from +X.
           Our stored θ is measured clockwise from the break-point.
           Therefore:  α = breakΘ − θ                                */
        const startAngle = this.breakTheta - child.theta;
        const endAngle = this.breakTheta - parent.theta;

        // ① radial leg
        const start = this.toScreen(child);
        const mid = this.toScreen({ r: parent.r, theta: child.theta });

        ctx.beginPath();
        ctx.moveTo(start.x * scale, start.y * scale);
        ctx.lineTo(mid.x * scale, mid.y * scale);

        // ② choose shorter direction for the arc
        const cwDelta = (endAngle - startAngle + 2 * Math.PI) % (2 * Math.PI);
        const anticw = cwDelta > Math.PI;        // true → counter-clockwise

        ctx.arc(
            centre.x * scale,
            centre.y * scale,
            parent.r * scale,
            startAngle,
            endAngle,
            anticw
        );
        ctx.stroke();
    }
}
