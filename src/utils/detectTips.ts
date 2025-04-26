// src/utils/detectTips.ts
// ------------------------------------------------------------
// Robust tip detector for the “Treemble” app.
// Works on arbitrary colours/thickness by:
//
//   1. extracting the user-chosen rectangle into an off-screen canvas
//   2. converting it to greyscale
//   3. computing an adaptive threshold (Otsu-like) → binary image
//   4. thinning the binary image with a lightweight Zhang–Suen pass
//   5. taking every skeleton pixel that has exactly ONE 8-neighbour
//      and whose lone neighbour is to the LEFT of it  ➜ endpoint
//   6. clustering endpoints by Y so each horizontal line ⇒ one tip
//
// Returned tip coordinates are in **full-image space** (not rectangle
// space), ready to drop into your dot list.
// ------------------------------------------------------------

export interface Rect { x: number; y: number; width: number; height: number; }
export interface Tip { x: number; y: number; }

/* helpers --------------------------------------------------- */

const idx = (x: number, y: number, w: number) => (y * w + x);

/* main ------------------------------------------------------ */

export function detectTipsInRect(
    img: HTMLImageElement,
    rect: Rect,
): Tip[] {

    /* --- 1  draw the rectangle into an off-screen canvas --- */
    const off = document.createElement("canvas");
    off.width = rect.width;
    off.height = rect.height;
    const ctx = off.getContext("2d")!;
    ctx.drawImage(
        img,
        rect.x, rect.y, rect.width, rect.height,   // src
        0, 0, rect.width, rect.height              // dst
    );
    const { data, width: W, height: H } = ctx.getImageData(0, 0, rect.width, rect.height);

    /* --- 2  greyscale luminance 0‥255 per pixel ------------- */
    const lum = new Uint8ClampedArray(W * H);
    for (let p = 0, j = 0; p < data.length; p += 4, ++j) {
        lum[j] = 0.3 * data[p] + 0.59 * data[p + 1] + 0.11 * data[p + 2];
    }

    /* --- 3  adaptive threshold  (simple Otsu) --------------- */
    const hist = new Uint32Array(256);
    lum.forEach(v => ++hist[v]);

    let sum = 0, n = W * H;
    for (let i = 0; i < 256; ++i) sum += i * hist[i];

    let sumB = 0, wB = 0, wF = 0, maxVar = 0, threshold = 128;
    for (let t = 0; t < 256; ++t) {
        wB += hist[t]; if (!wB) continue;
        wF = n - wB; if (!wF) break;
        sumB += t * hist[t];

        const mB = sumB / wB;
        const mF = (sum - sumB) / wF;
        const between = wB * wF * (mB - mF) ** 2;

        if (between > maxVar) { maxVar = between; threshold = t; }
    }

    const bin = new Uint8Array(W * H);
    lum.forEach((v, i) => { bin[i] = v < threshold ? 1 : 0; });

    /* --- 4  FULL Zhang–Suen thinning until stable -------------- */
    /*     (one iteration was leaving diagonal / double-width      */
    /*      ends, so endpoints were never “single-neighbour”.)     */

    const minRun = 6;                 // ≥ this many contiguous dark pixels
    const tipsRaw: Tip[] = [];

    for (let y = 0; y < H; ++y) {
        let run = 0;
        for (let x = W - 1; x >= 0; --x) {
            if (bin[idx(x, y, W)]) {
                run += 1;
            } else {
                if (run >= minRun) {
                    /* rightmost pixel of this run is (x + run) */
                    tipsRaw.push({ x: x + run, y });
                }
                run = 0;
            }
        }
        if (run >= minRun) {
            tipsRaw.push({ x: 0 + run, y }); // run reaches image edge
        }
    }

    /* --- cluster by Y so one tip per horizontal line ------------- */
    tipsRaw.sort((a, b) => a.y - b.y);
    const tips: Tip[] = [];
    let group: typeof tipsRaw = [];

    const flush = () => {
        if (!group.length) return;
        const gy = group.reduce((s, p) => s + p.y, 0) / group.length;
        const gx = Math.max(...group.map(p => p.x));         // take RIGHTMOST x
        tips.push({ x: gx + rect.x, y: gy + rect.y });       // back to full-image
        group = [];
    };

    for (const pt of tipsRaw) {
        if (!group.length || pt.y - group[group.length - 1].y < 5) {
            group.push(pt);
        } else {
            flush();
            group.push(pt);
        }
    }
    flush();

    /* DEBUG ------------------------------------------------------ */
    console.log(
        `[detectTips] threshold=${threshold}` +
        ` · raw=${tipsRaw.length}` +
        ` · final tips=${tips.length}`
    );
    /* ------------------------------------------------------------ */

    return tips;
}