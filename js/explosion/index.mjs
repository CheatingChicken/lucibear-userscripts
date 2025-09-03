/**
 * Main DOM explosion orchestrator
 */
import { splitTextNodes } from "./01-textSplitter.mjs";
import { shouldSkipElement, markElementSkipped } from "./02-elementSkipping.mjs";
import { createPhysicsElement } from "./03-cloneCreation.mjs";
import { markRepairChains, updateCloneRepairability } from "./04-repairTraversal.mjs";
import { processShockwave } from "./05-shockwave.mjs";
import { spawnBlast } from "../fireworks.mjs";

/**
 * Initialize the DOM explosion wiring
 * @returns {{trigger:()=>Promise<void>}}
 */
export function initDomExplosion() {
    return {
        trigger: async function trigger() {
            console.log("[domExplosion] trigger");

            // Make page non-scrolling during the effect
            try {
                document.body.style.overflow = "hidden";
            } catch (e) {}

            // Only clone elements under .wrap to avoid duplicating UI panels
            const container = document.querySelector(".wrap");

            // split text nodes inside the container into word spans so we get more elements
            try {
                splitTextNodes(container);
            } catch (e) {}

            if (!container) {
                console.warn("[domExplosion] .wrap not found, aborting");
                return;
            }

            // Collect every descendant element under .wrap
            const allElems = Array.from(container.querySelectorAll("*")).filter((el) => {
                if (!el) return false;
                // exclude our UI panels and the fw canvas
                if (
                    el.id === "fw-panel" ||
                    el.id === "fw" ||
                    el.id === "dnp-panel" ||
                    el.id === "dnp-button" ||
                    el.id === "dnp-toggle"
                )
                    return false;
                if (el.tagName === "SCRIPT" || el.tagName === "STYLE") return false;
                return true;
            });

            // Calculate explosion parameters
            const explX = innerWidth * 0.5 + (Math.random() * 0.2 - 0.1) * innerWidth;
            const explY = innerHeight * 0.8 + (Math.random() * 0.2 - 0.1) * innerHeight;
            const blastStrength = 5.5 * (1 + (Math.random() * 0.25 - 0.125));

            // Spawn visual blast
            try {
                spawnBlast(explX, explY, {
                    r0: 12,
                    r1: 160 * blastStrength,
                    dur: Math.round(700 * Math.min(2, blastStrength)),
                    strength: blastStrength,
                });
            } catch (e) {}

            // Track elements and clones
            const clones = [];
            const skippedElements = new Set();
            const repairedOriginals = new Set();
            let created = 0;

            // Create physics elements for non-skipped elements
            for (const el of allElems) {
                try {
                    const rect = el.getBoundingClientRect();
                    if (rect.width < 4 || rect.height < 4) continue;

                    // Check if element should be skipped
                    if (shouldSkipElement(el)) {
                        markElementSkipped(el, skippedElements, container);
                        continue;
                    }

                    // Create physics element
                    const pe = createPhysicsElement(
                        el,
                        container,
                        explX,
                        explY,
                        blastStrength,
                        repairedOriginals,
                        clones,
                    );
                    if (pe) {
                        clones.push(pe);
                        created++;
                    }
                } catch (err) {
                    console.warn("[domExplosion] failed processing element:", el && el.tagName, err);
                }
            }

            // After all PEs created, traverse DOM tree top-to-bottom and mark repair chains
            markRepairChains(container, repairedOriginals);

            // Update clone repairability based on parent repair status
            updateCloneRepairability(clones);

            console.log("[domExplosion] created clones:", created, "total elems:", allElems.length);

            // Remove controls wrapper so it doesn't block picking up pieces
            try {
                const cw = document.getElementById("controls-wrap");
                if (cw && cw.parentElement) cw.parentElement.removeChild(cw);
            } catch (e) {}

            // Start shockwave processing
            processShockwave(clones, explX, explY, blastStrength);

            // Start animation loop
            startAnimationLoop(clones);
        },
    };
}

/**
 * Animation loop for physics elements
 */
function startAnimationLoop(clones) {
    let last = performance.now();

    function frame(now) {
        let ms = now - last || 16;
        // clamp ms to [8, 40] ms to avoid huge dt on tab switch or suspends
        ms = Math.max(8, Math.min(40, ms));
        last = now;
        const dt = ms * 0.06; // reuse the fireworks time scaling

        // remove any marked-for-removal clones whose ripple animation has finished
        const nowTs = performance && performance.now ? performance.now() : Date.now();
        for (let i = clones.length - 1; i >= 0; i--) {
            const p = clones[i];
            if (p && p._removed) {
                // if removal time reached, remove DOM and splice out of clones
                if (!p._removalAt || nowTs >= p._removalAt) {
                    try {
                        p.el && p.el.remove();
                    } catch (e) {}
                    clones.splice(i, 1);
                } else {
                    // otherwise keep it until the animation completes
                    continue;
                }
            }
        }

        // step all physics (skip removed ones)
        clones.forEach((p) => {
            if (!p._removed) p.step(dt);
        });

        // render all (skip removed)
        clones.forEach((p) => {
            if (!p._removed) p.render();
        });

        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}
