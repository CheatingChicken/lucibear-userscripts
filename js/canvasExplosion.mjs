/*
 * Canvas-based explosion alternative
 * - Captures DOM elements as image tiles (via same foreignObject -> canvas pipeline)
 * - Draws and animates them on the background fireworks canvas (id="fw") instead of creating DOM clones
 * - Exposes initCanvasExplosion() which returns { trigger: ()=>void }
 *
 * This keeps the DOM intact and should be higher-performance for large numbers of pieces.
 */

/**
 * @typedef {{x:number,y:number}} Vec2
 */

/**
 * Create an image snapshot of an element (same as domExplosion.renderElementToDataURL) but slightly safer for canvas animation.
 * @param {Element} el
 * @param {{hideChildren?:boolean}} options
 * @returns {Promise<{img:HTMLImageElement,rect:DOMRect,w:number,h:number}|null>}
 */
function snapshotElement(el, options = { hideChildren: false }) {
    return new Promise((resolve) => {
        try {
            const rect = el.getBoundingClientRect();
            const w = Math.max(1, Math.ceil(rect.width));
            const h = Math.max(1, Math.ceil(rect.height));
            const clone = el.cloneNode(true);
            if (options.hideChildren)
                Array.from(clone.querySelectorAll("*")).forEach((c) => (c.style.display = "none"));
            try {
                const cs = getComputedStyle(el);
                clone.style.setProperty("background", cs.background || cs.backgroundColor || "transparent");
                clone.style.setProperty("color", cs.color || "inherit");
                clone.style.setProperty("font", cs.font || "inherit");
            } catch (e) {}
            const xmlns = "http://www.w3.org/2000/svg";
            const svg = `<svg xmlns='${xmlns}' width='${w}' height='${h}'><foreignObject width='100%' height='100%'>${new XMLSerializer().serializeToString(
                clone,
            )}</foreignObject></svg>`;
            const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve({ img, rect, w, h });
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                resolve(null);
            };
            img.src = url;
        } catch (e) {
            resolve(null);
        }
    });
}

/**
 * Initialize canvas-based explosion module
 * @returns {{ trigger: ()=>void }}
 */
export function initCanvasExplosion() {
    const canvas = document.getElementById("fw");
    if (!canvas) return { trigger: () => console.warn("canvas explosion: no canvas") };
    const ctx = canvas.getContext("2d");
    let tiles = [];
    const gravity = 0.6;

    function drawTiles() {
        // redraw background fireworks are handled by fireworks module; this overlay only draws pieces
        // We'll composite on top by using globalCompositeOperation if desired. For now just draw normally.
        tiles.forEach((tile) => {
            ctx.save();
            ctx.translate(tile.x + tile.w / 2, tile.y + tile.h / 2);
            ctx.rotate((tile.angle * Math.PI) / 180);
            ctx.globalAlpha = tile.alpha;
            ctx.drawImage(tile.img, -tile.w / 2, -tile.h / 2, tile.w, tile.h);
            ctx.restore();
        });
    }

    let running = false;
    function animate() {
        if (!running) return;
        // note: fireworks module clears and repaints the canvas each frame; to composite our tiles we rely on draw order
        // so we schedule our draw after a short timeout to let fireworks render first (hacky but simple).
        requestAnimationFrame(() => {
            // update physics
            tiles.forEach((t) => {
                t.vy += gravity;
                t.vx *= 0.995;
                t.vy *= 0.995;
                t.x += t.vx;
                t.y += t.vy;
                t.angle += t.av;
                // border collisions
                const left = 0,
                    top = 0,
                    right = innerWidth - t.w,
                    bottom = innerHeight - t.h;
                if (t.x < left) {
                    t.x = left;
                    t.vx = -t.vx * 0.6;
                    t.av += (Math.random() - 0.5) * 4;
                } else if (t.x > right) {
                    t.x = right;
                    t.vx = -t.vx * 0.6;
                    t.av += (Math.random() - 0.5) * 4;
                }
                if (t.y < top) {
                    t.y = top;
                    t.vy = -t.vy * 0.6;
                    t.av += (Math.random() - 0.5) * 4;
                } else if (t.y > bottom) {
                    t.y = bottom;
                    t.vy = -t.vy * 0.6;
                    t.av += (Math.random() - 0.5) * 4;
                }
            });
            // draw overlay
            drawTiles();
            // continue
            if (tiles.some((t) => t.alpha > 0.01)) requestAnimationFrame(animate);
            else running = false;
        });
    }

    return {
        trigger: async function trigger() {
            console.log("[canvasExplosion] trigger");
            // collect elements (same filter as domExplosion)
            const elems = Array.from(
                document.body.querySelectorAll("*:not(.phy-clone):not(#fw-panel):not(#fw):not(script):not(style)"),
            ).filter((el) => !el.closest || !el.closest("#fw-panel"));
            const centerX = innerWidth / 2,
                centerY = innerHeight / 2;
            const jobs = elems.map((el) => {
                const rect = el.getBoundingClientRect();
                if (rect.width < 4 || rect.height < 4) return Promise.resolve(null);
                return snapshotElement(el, { hideChildren: true }).then((res) => ({ el, rect, res }));
            });
            const results = await Promise.all(jobs);
            tiles = [];
            results.forEach((r) => {
                if (!r || !r.res) return;
                const { el, rect, res } = r;
                const img = res.img;
                const w = res.w,
                    h = res.h;
                const x = rect.left,
                    y = rect.top;
                const cx = x + w / 2,
                    cy = y + h / 2;
                const dx = cx - centerX,
                    dy = cy - centerY;
                const dist = Math.sqrt(dx * dx + dy * dy) + 1;
                const push = (200 + Math.random() * 400) / dist;
                const vx = (Math.random() - 0.5) * 1.4 + (dx / dist) * push;
                const vy = (Math.random() - 0.5) * 1.4 + (dy / dist) * push;
                tiles.push({
                    img,
                    x,
                    y,
                    w,
                    h,
                    vx,
                    vy,
                    av: (Math.random() - 0.5) * 12,
                    angle: Math.random() * 360,
                    alpha: 1,
                });
                try {
                    el.style.visibility = "hidden";
                } catch (e) {}
            });
            if (tiles.length) {
                running = true;
                animate();
            }
        },
    };
}
