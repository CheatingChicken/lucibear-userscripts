/**
 * Shockwave processing for physics elements
 */

/**
 * Create and process shockwave that applies impulses to physics elements
 * @param {Array} clones
 * @param {number} explX
 * @param {number} explY
 * @param {number} blastStrength
 */
export function processShockwave(clones, explX, explY, blastStrength) {
    // shockwave scheduling: create a short-lived expanding wave that applies additional radial dv
    const shockwave = {
        x: explX,
        y: explY,
        t: 0,
        dur: Math.max(420, Math.min(1400, 260 * blastStrength)),
        r0: 0,
        r1: Math.max(innerWidth, innerHeight) * 1.2 * Math.min(2.5, blastStrength / 2),
        strength: blastStrength,
    };

    // mark bodies for shockwave processing
    const swBodies = clones.map((pe) => ({ pe, applied: false }));

    const swStart = performance.now();
    function shockwaveStep(now) {
        const dtms = now - swStart;
        shockwave.t = dtms;
        const p = Math.min(1, shockwave.t / shockwave.dur);
        const currR = shockwave.r0 + (shockwave.r1 - shockwave.r0) * p;
        const waveThickness = Math.max(12, 80 * (1 - p) + 6);

        // when the wave front passes each body apply a pulse
        for (const item of swBodies) {
            if (item.applied) continue;
            const dx = item.pe.pos.x - shockwave.x;
            const dy = item.pe.pos.y - shockwave.y;
            const d = Math.sqrt(dx * dx + dy * dy);

            if (d >= currR - waveThickness / 2 && d <= currR + waveThickness / 2) {
                applyShockwaveImpulse(item.pe, shockwave, d, dx, dy);
                item.applied = true;
            }
        }

        if (p < 1) requestAnimationFrame(shockwaveStep);
    }
    requestAnimationFrame(shockwaveStep);
}

/**
 * Apply shockwave impulse to a physics element
 */
function applyShockwaveImpulse(pe, shockwave, d, dx, dy) {
    try {
        // pulse magnitude decays with distance and overall strength
        const pulse = (1200 * shockwave.strength) / Math.max(12, d + 20);
        const dir = { x: dx / (d || 1), y: dy / (d || 1) };
        const dv = pulse / pe.mass;

        // apply any precomputed main impulse first
        if (pe._pendingImpulse) {
            // unfreeze before applying stored impulse so simulation begins
            try {
                if (typeof pe.unfreeze === "function") pe.unfreeze();
            } catch (e) {}

            pe.v.x += pe._pendingImpulse.dvx;
            pe.v.y += pe._pendingImpulse.dvy;

            // compute angular impulse from stored J and dir
            try {
                const corners = pe.getCorners(pe.ang, pe.pos);
                let nearest = corners[0];
                let nd = Infinity;
                let nearestIdx = 0;

                for (let i = 0; i < corners.length; i++) {
                    const c = corners[i];
                    const dd = (c.x - shockwave.x) * (c.x - shockwave.x) + (c.y - shockwave.y) * (c.y - shockwave.y);
                    if (dd < nd) {
                        nd = dd;
                        nearest = c;
                        nearestIdx = i;
                    }
                }

                const r = { x: nearest.x - pe.pos.x, y: nearest.y - pe.pos.y };
                const rawTorque =
                    r.x * (pe._pendingImpulse.J * pe._pendingImpulse.dir.y) -
                    r.y * (pe._pendingImpulse.J * pe._pendingImpulse.dir.x);

                // direction rule: if nearest corner is top-left (0) or bottom-right (2) => counterclockwise
                const wantsCCW = nearestIdx === 0 || nearestIdx === 2;
                const torqueMag = (Math.abs(rawTorque) * 0.02) / pe.inertia;
                pe.angV += (wantsCCW ? -1 : 1) * torqueMag;
            } catch (e) {}

            // clear pending marker so we don't reapply
            delete pe._pendingImpulse;
        }

        // apply shockwave pulse
        pe.v.x += dir.x * dv;
        pe.v.y += dir.y * dv - Math.abs(dv) * 0.08;

        // small angular kick with direction based on which corner the wave hit
        try {
            const corners2 = pe.getCorners(pe.ang, pe.pos);
            let nd2 = Infinity;
            let nearestIdx2 = 0;

            for (let i = 0; i < corners2.length; i++) {
                const c = corners2[i];
                const dd = (c.x - shockwave.x) * (c.x - shockwave.x) + (c.y - shockwave.y) * (c.y - shockwave.y);
                if (dd < nd2) {
                    nd2 = dd;
                    nearestIdx2 = i;
                }
            }

            const wantsCCW2 = nearestIdx2 === 0 || nearestIdx2 === 2;
            const smallKick = 0.03 * shockwave.strength * (0.6 + Math.random() * 0.8);
            pe.angV += (wantsCCW2 ? -1 : 1) * smallKick;
        } catch (e) {
            // fallback random jitter
            pe.angV += (Math.random() - 0.5) * 0.06 * shockwave.strength;
        }
    } catch (e) {}
}
