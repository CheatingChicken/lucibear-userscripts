/**
 * Fireworks particle system module
 * - exports initFireworks(), spawnFirework(x,y), getActiveCount(), setParticlesPerFirework(n)
 *
 * JSDoc typedefs included to help editors provide inline typing and to make runtime behavior explicit.
 */

/**
 * @typedef {{x:number,y:number}} Vec2
 */

let canvas, ctx, w, h;
let particles = [];
let blasts = [];

/**
 * Initialize the fireworks canvas and animation loop.
 */
export function initFireworks() {
    canvas = document.getElementById("fw");
    if (!canvas) return;
    ctx = canvas.getContext("2d");
    w = canvas.width = innerWidth;
    h = canvas.height = innerHeight;
    window.particlesPerFirework = window.particlesPerFirework || 80;

    window.addEventListener("resize", () => {
        w = canvas.width = innerWidth;
        h = canvas.height = innerHeight;
    });

    document.addEventListener(
        "click",
        (e) => {
            try {
                const el = e.target;
                if (el.closest && el.closest("#fw-panel")) {
                    // console.log("fireworks: click ignored on UI element", el);
                    return;
                }
                spawnFirework(e.clientX, e.clientY);
            } catch (err) {
                console.error("fireworks click error", err);
            }
        },
        { passive: true },
    );

    let last = performance.now();
    function frame(t) {
        const dt = t - last || 16;
        last = t;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "rgba(10,15,20,0.12)";
        ctx.fillRect(0, 0, w, h);
        // draw transient explosion blasts
        for (let i = blasts.length - 1; i >= 0; i--) {
            const b = blasts[i];
            b.t += dt;
            const p = b.t / b.dur;
            if (p >= 1) {
                blasts.splice(i, 1);
                continue;
            }
            const ease = 1 - (1 - p) * (1 - p);
            const r = b.r0 + (b.r1 - b.r0) * ease;
            ctx.beginPath();
            const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
            grad.addColorStop(0, `rgba(255,220,120,${0.9 * (1 - p)})`);
            grad.addColorStop(0.6, `rgba(255,120,60,${0.45 * (1 - p)})`);
            grad.addColorStop(1, `rgba(255,60,20,0)`);
            ctx.fillStyle = grad;
            ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
            ctx.fill();
            // draw a shockwave ring for visualization
            try {
                const ringAlpha = Math.max(0, (1 - p) * 0.9 * (b.strength || 1));
                const ringWidth = Math.max(2, 8 * (b.strength || 1) * (1 - p));
                ctx.beginPath();
                ctx.lineWidth = ringWidth;
                ctx.strokeStyle = `rgba(255,240,200,${ringAlpha})`;
                ctx.arc(b.x, b.y, r + 4 + ringWidth, 0, Math.PI * 2);
                ctx.stroke();
                ctx.lineWidth = 1;
            } catch (e) {}
        }
        particles.forEach((p) => {
            p.step(dt * 0.06);
            p.draw(ctx);
        });

        const margin = 200;
        const minX = -margin,
            minY = -margin,
            maxX = w + margin,
            maxY = h + margin;
        particles = particles.filter(
            (p) => p.alpha > 0.02 && p.s > 0.2 && p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY,
        );
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    // periodic auto-fireworks bursts for ambient effect (matches previous behavior)
    setInterval(() => spawnFirework(rand(w * 0.15, w * 0.85), rand(h * 0.1, h * 0.6)), 2200 + Math.random() * 1800);
}

/**
 * Particle class representing a single spark.
 */
class Particle {
    /**
     * @param {number} x
     * @param {number} y
     * @param {string} color
     * @param {Vec2} velocity
     */
    constructor(x, y, color, velocity) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.v = velocity;
        this.alpha = 1;
        this.s = rand(1, 3);
    }
    /**
     * Update the particle by dt
     * @param {number} dt
     */
    step(dt) {
        this.x += this.v.x * dt;
        this.y += this.v.y * dt + 0.02 * dt * dt;
        this.v.y += 0.02 * dt;
        this.alpha *= 0.995;
        this.s *= 0.999;
    }
    /**
     * Draw the particle on a 2D canvas context
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(ctx) {
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.s, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

function rand(a, b) {
    return Math.random() * (b - a) + a;
}

/**
 * Spawn a firework at x,y
 * @param {number} x
 * @param {number} y
 */
export function spawnFirework(x, y) {
    const hue = Math.floor(rand(0, 360));
    const count = Math.max(8, Math.min(400, Math.floor(window.particlesPerFirework || 80)));
    for (let i = 0; i < count; i++) {
        const speed = rand(0.6, 4.2);
        const angle = rand(0, Math.PI * 2);
        const v = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
        const color = `hsl(${hue} ${rand(70, 95)}% ${rand(50, 65)}% / 1)`;
        particles.push(new Particle(x, y, color, v));
    }
}

/**
 * Return active particle count
 * @returns {number}
 */
export function getActiveCount() {
    return particles.length;
}

/**
 * Set particles per firework value (clamped)
 * @param {number} n
 */
export function setParticlesPerFirework(n) {
    window.particlesPerFirework = Math.max(8, Math.min(400, n));
}

/**
 * Spawn a visual blast (radial glow) at x,y. Used to visualize explosions.
 * @param {number} x
 * @param {number} y
 * @param {{r0?:number,r1?:number,dur?:number}} opts
 */
export function spawnBlast(x, y, opts = {}) {
    const b = {
        x,
        y,
        t: 0,
        dur: opts.dur || 600,
        r0: opts.r0 || 8,
        r1: opts.r1 || Math.max(60, Math.min(240, Math.max(w, h) * 0.12)),
        strength: opts.strength || 1,
    };
    blasts.push(b);
    // also spawn some fireworks for visual flair
    spawnFirework(x, y);
}
