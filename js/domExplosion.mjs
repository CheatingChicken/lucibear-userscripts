/**
 * DOM-based explosion module
 * - Exports initDomExplosion() which returns an object with a trigger() method.
 * - Clones only immediate children of `.wrap`, creates shallow HTML clones (no children),
 *   and animates them using PhysicsElement instances.
 */
import { PhysicsElement } from "./physicsElement.mjs";
import { spawnBlast } from "./fireworks.mjs";

/**
 * Optionally split text nodes into letter spans. For now this is a no-op placeholder
 * to keep API compatibility with previous iterations.
 * @param {HTMLElement|Document} root
 */
function splitTextNodes(root) {
    if (!root) return;
    // Walk text nodes and replace them with spans for each word
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (!node || !node.nodeValue) return NodeFilter.FILTER_REJECT;
            // skip pure whitespace-only nodes
            if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            // don't split inside script/style/textarea/pre/code or inside our control panel
            const tag = parent.tagName;
            if (parent.closest && parent.closest("#fw-panel, #fw")) return NodeFilter.FILTER_REJECT;
            if (parent.closest && parent.closest("script,style,textarea,pre,code")) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        },
    });

    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);

    for (const textNode of nodes) {
        const txt = textNode.nodeValue;
        // split into words and whitespace
        const parts = txt.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        for (const part of parts) {
            if (part.length === 0) continue;
            if (/^\s+$/.test(part)) {
                frag.appendChild(document.createTextNode(part));
            } else {
                const span = document.createElement("span");
                span.className = "fw-word";
                // keep inline display; CSS can override if needed
                span.style.display = "inline";
                span.appendChild(document.createTextNode(part));
                frag.appendChild(span);
            }

            // Post-pass: traverse direct children of the container to propagate repaired/skipped chains.
            try {
                const directChildren = Array.from(container.children || []);
                for (const child of directChildren) {
                    try {
                        // if child is a skipped node, mark it repaired so its direct cloned descendants become repairable
                        if (child.classList && child.classList.contains("dom-skip")) {
                            try {
                                child.classList.add("repaired-original");
                            } catch (e) {}
                            try {
                                repairedOriginals.add(child);
                            } catch (e) {}
                        }
                        // walk down chains: if element has repaired-original and next is skipped, mark skipped as repaired
                        let node = child;
                        while (node) {
                            try {
                                const next = node.firstElementChild;
                                if (!next) break;
                                if (
                                    node.classList &&
                                    node.classList.contains("repaired-original") &&
                                    next.classList &&
                                    next.classList.contains("dom-skip")
                                ) {
                                    try {
                                        next.classList.add("repaired-original");
                                    } catch (e) {}
                                    try {
                                        repairedOriginals.add(next);
                                    } catch (e) {}
                                    node = next;
                                    continue;
                                }
                                break;
                            } catch (e) {
                                break;
                            }
                        }
                    } catch (e) {}
                }

                // mark clones repairable if their original parent has repaired-original class
                for (const other of clones) {
                    try {
                        const origParent = other._origEl && other._origEl.parentElement;
                        if (origParent && origParent.classList && origParent.classList.contains("repaired-original")) {
                            other._repairAllowed = true;
                            try {
                                other.el && other.el.classList && other.el.classList.add("repairable");
                            } catch (e) {}
                        }
                    } catch (e) {}
                }
            } catch (e) {}
        }
        try {
            textNode.parentNode.replaceChild(frag, textNode);
        } catch (e) {}
    }
}

/**
 * Initialize the DOM explosion wiring
 * @returns {{trigger:()=>Promise<void>}}
 */
export function initDomExplosion() {
    return {
        trigger: async function trigger() {
            console.log("[domExplosion] trigger");

            // Make page non-scrolling during the effect (user requested `overflow:none` — using 'hidden')
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
            // Collect every descendant element under .wrap — the whole child tree will become physics bodies
            const allElems = Array.from(container.querySelectorAll("*")).filter((el) => {
                if (!el) return false;
                // exclude our UI panels (fireworks panel and do-not-press controls) and the fw canvas
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

            const centerX = innerWidth / 2,
                centerY = innerHeight / 2;

            // visual explosion origin: 50% width, ~20% off the bottom (80% from top)
            const baseExplX = innerWidth * 0.5;
            const baseExplY = innerHeight * 0.8;
            // randomize origin by +/-10% of viewport
            const jitterX = (Math.random() * 0.2 - 0.1) * innerWidth;
            const jitterY = (Math.random() * 0.2 - 0.1) * innerHeight;
            const explX = baseExplX + jitterX;
            const explY = baseExplY + jitterY;
            // blast strength multiplier: increased base for stronger effect, with ±12.5% randomness
            const blastMultiplierBase = 5.5; // raised from ~3.0
            const blastMultiplierJitter = 1 + (Math.random() * 0.25 - 0.125);
            const blastStrength = blastMultiplierBase * blastMultiplierJitter;
            try {
                spawnBlast(explX, explY, {
                    r0: 12,
                    r1: 160 * blastStrength,
                    dur: Math.round(700 * Math.min(2, blastStrength)),
                    strength: blastStrength,
                });
            } catch (e) {}

            // physics bodies are handled by the external PhysicsElement module
            // import changed at top-level via module import (below)

            const clones = [];
            // track elements we intentionally skipped (transparent/non-cloned)
            const skippedElements = new Set();
            // track which original elements have been repaired
            const repairedOriginals = new Set();
            let created = 0;
            for (const el of allElems) {
                try {
                    const rect = el.getBoundingClientRect();
                    if (rect.width < 4 || rect.height < 4) continue;
                    // avoid creating physics clones for container-like elements that are visually transparent
                    // (no background image and fully transparent background-color)
                    let cs = null;
                    try {
                        cs = getComputedStyle(el);
                        const bgImage = (cs && cs.getPropertyValue && cs.getPropertyValue("background-image")) || "";
                        const bgColor = (cs && cs.getPropertyValue && cs.getPropertyValue("background-color")) || "";
                        const isTransparentColor =
                            /transparent/i.test(bgColor) || /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/i.test(bgColor);
                        if ((bgImage === "none" || !bgImage) && isTransparentColor) {
                            // If element has other element children, treat it as a container and skip it.
                            // Text-only elements (no element children) should still be cloned so text can become PEs.
                            const hasElementChildren = el.children && el.children.length > 0;
                            if (hasElementChildren) {
                                // skip invisible container: record it so repairs can 'pass through' this node and
                                // enable its direct cloned descendants when the ancestor is repaired.
                                try {
                                    skippedElements.add(el);
                                    try {
                                        el.classList && el.classList.add("dom-skip");
                                    } catch (e) {}
                                } catch (e) {}
                                // additionally, if this skipped element is a direct child of the container (.wrap),
                                // record that its descendants should be treated as directly repairable when parent repaired
                                try {
                                    if (el.parentElement === container) {
                                        // mark a special flag to indicate wrap-direct skipped elements
                                        el._skippedDirectChildOfWrap = true;
                                    }
                                } catch (e) {}
                                // keep the original hidden for now so layout is preserved only by clones
                                try {
                                    el.style.visibility = "hidden";
                                } catch (e) {}
                                continue;
                            }
                            // else: allow text-only transparent elements to be cloned
                        }
                    } catch (e) {
                        cs = null;
                    }

                    // create a shallow clone of this element (no grandchildren)
                    const clone = el.cloneNode(false);
                    // copy classlist so cloned UI appears similar
                    try {
                        clone.className = el.className || "";
                    } catch (e) {}
                    // remove ids to avoid duplication
                    try {
                        clone.removeAttribute && clone.removeAttribute("id");
                    } catch (e) {}
                    clone.classList.add("phy-clone");

                    // append immediate child nodes: text nodes and shallow clones of child elements (no grandchildren)
                    for (const child of Array.from(el.childNodes)) {
                        if (child.nodeType === Node.TEXT_NODE) {
                            const t = document.createTextNode(child.nodeValue);
                            clone.appendChild(t);
                        } else if (child.nodeType === Node.ELEMENT_NODE) {
                            const childShallow = child.cloneNode(false);
                            try {
                                childShallow.className = child.className || "";
                            } catch (e) {}
                            try {
                                childShallow.removeAttribute && childShallow.removeAttribute("id");
                            } catch (e) {}
                            // remove navigational attributes from anchors to avoid navigation when clicked
                            try {
                                if (childShallow.tagName === "A" || childShallow.tagName === "a") {
                                    childShallow.removeAttribute && childShallow.removeAttribute("href");
                                    childShallow.removeAttribute && childShallow.removeAttribute("target");
                                }
                            } catch (e) {}
                            clone.appendChild(childShallow);
                        }
                    }

                    const pageLeft = rect.left + (window.scrollX || window.pageXOffset || 0);
                    const pageTop = rect.top + (window.scrollY || window.pageYOffset || 0);
                    clone.style.position = "absolute";
                    clone.style.left = pageLeft + "px";
                    clone.style.top = pageTop + "px";
                    clone.style.width = rect.width + "px";
                    clone.style.height = rect.height + "px";
                    clone.style.boxSizing = "border-box";
                    clone.style.margin = "0";
                    clone.style.overflow = "hidden";
                    clone.style.zIndex = 9999;
                    // allow pointer events so clones can be dragged by the user
                    clone.style.pointerEvents = "auto";
                    clone.style.cursor = "grab";
                    clone.style.willChange = "left, top, transform";
                    clone.style.transform = "rotate(0deg)";
                    clone.style.transformOrigin = "center center";

                    // copy a few computed styles to better match visual appearance
                    try {
                        // reuse computed style if available, otherwise compute now
                        cs = cs || getComputedStyle(el);
                        [
                            "display",
                            "visibility",
                            "background-color",
                            "background",
                            "color",
                            "font",
                            "border",
                            "border-radius",
                            "box-shadow",
                        ].forEach((p) => {
                            try {
                                const v = cs.getPropertyValue(p);
                                if (v) clone.style.setProperty(p, v);
                            } catch (e) {}
                        });
                    } catch (e) {}

                    document.body.appendChild(clone);

                    const cx = rect.left + rect.width / 2;
                    const cy = rect.top + rect.height / 2;
                    const dx = cx - centerX;
                    const dy = cy - centerY;
                    const dist = Math.max(8, Math.sqrt(dx * dx + dy * dy));

                    // create physics body with small baseV (the constructor will add jitter)
                    // create physics body but disable initial random jitter so items don't move until the shockwave hits
                    const pe = new PhysicsElement(
                        clone,
                        rect,
                        { x: pageLeft, y: pageTop },
                        { x: 0, y: 0, noJitter: true, frozen: true },
                    );

                    // apply explosion impulse from previously computed explX/explY
                    const ex = cx - explX;
                    const ey = cy - explY;
                    const edist = Math.max(8, Math.sqrt(ex * ex + ey * ey));
                    const dir = { x: ex / edist, y: ey / edist };
                    // compute impulse to apply later when shockwave reaches this body
                    const Jraw = 300 + Math.random() * 900;
                    const J = (Jraw * blastStrength * (0.85 + Math.random() * 0.3)) / edist; // stronger base
                    const dvx = (J / pe.mass) * dir.x;
                    const dvy = (J / pe.mass) * dir.y;
                    // store pending impulse (applied when wave front passes)
                    pe._pendingImpulse = { dvx, dvy, J, dir, edist };

                    // angular impulse: approximate by applying impulse at the nearest corner
                    try {
                        const corners = pe.getCorners(pe.ang, pe.pos);
                        let nearest = corners[0];
                        let nd = Infinity;
                        for (const c of corners) {
                            const dd = (c.x - explX) * (c.x - explX) + (c.y - explY) * (c.y - explY);
                            if (dd < nd) {
                                nd = dd;
                                nearest = c;
                            }
                        }
                        const r = { x: nearest.x - pe.pos.x, y: nearest.y - pe.pos.y };
                        // torque = r x (J * dir)
                        const torque = r.x * (J * dir.y) - r.y * (J * dir.x);
                        // scale down to keep it stable visually
                        pe.angV += (torque * 0.02) / pe.inertia;
                        // small random angular jitter
                        pe.angV += (Math.random() - 0.5) * 0.02;
                    } catch (e) {}

                    // attach original element/rect so pieces can be 'repaired' later
                    try {
                        pe._origEl = el;
                        pe._origRect = rect;
                        pe._origCenter = { x: cx, y: cy };
                        pe._repairThreshold = 20; // px
                        // only allow repair immediately if this element's parent is the container
                        // or the parent already has been marked repaired (repaired-original)
                        try {
                            const p = el.parentElement;
                            if (
                                p === container ||
                                (p &&
                                    p.classList &&
                                    (p.classList.contains("repaired-original") || p.classList.contains(".wrap")))
                            ) {
                                pe._repairAllowed = true;
                            }
                        } catch (e) {
                            pe._repairAllowed = false;
                        }

                        // mark clone DOM for debugging if repairable
                        try {
                            if (pe._repairAllowed && pe.el && pe.el.classList) pe.el.classList.add("repairable");
                        } catch (e) {}

                        // repair callback will restore original and mark this original as repaired
                        pe._onRepair = () => {
                            try {
                                // restore original visibility immediately so layout returns to original state
                                el.style.visibility = "visible";
                            } catch (e) {}
                            try {
                                // add a CSS class to the clone to play a repair ripple animation before removal
                                if (pe.el) pe.el.classList.add("repair-ripple");
                                // trigger the repaired state on the next frame so transition can run
                                try {
                                    requestAnimationFrame(() => {
                                        try {
                                            pe.el && pe.el.classList.add("repaired");
                                        } catch (e) {}
                                    });
                                } catch (e) {}
                            } catch (e) {}
                            // ensure any repair hint created by the PhysicsElement is removed
                            try {
                                if (pe._hintTimeout) {
                                    try {
                                        clearTimeout(pe._hintTimeout);
                                    } catch (e) {}
                                    pe._hintTimeout = null;
                                }
                            } catch (e) {}
                            try {
                                if (pe._hintEl) {
                                    try {
                                        pe._hintEl.remove();
                                    } catch (e) {}
                                    pe._hintEl = null;
                                }
                            } catch (e) {}
                            // mark as removed and schedule safe removal time after the animation completes
                            try {
                                pe._removed = true;
                                // align removal with CSS transition duration (~420ms) plus small buffer
                                pe._removalAt = (performance && performance.now ? performance.now() : Date.now()) + 520;
                                // mark the original element as repaired so immediate children can now be repaired
                                try {
                                    repairedOriginals.add(el);
                                } catch (e) {}
                                // enable repair for any clones whose original is a descendant of this repaired original
                                try {
                                    function isDescendant(child, ancestor) {
                                        try {
                                            let n = child;
                                            while (n) {
                                                if (n === ancestor) return true;
                                                n = n.parentElement;
                                            }
                                        } catch (e) {}
                                        return false;
                                    }
                                    for (const other of clones) {
                                        try {
                                            if (other._repairAllowed) continue;
                                            if (!other._origEl) continue;
                                            // if the other clone's original is a direct descendant of 'el', allow repair
                                            if (other._origEl.parentElement === el) {
                                                other._repairAllowed = true;
                                                continue;
                                            }
                                            // if the original is a deeper descendant, allow repair as before
                                            if (isDescendant(other._origEl, el)) {
                                                other._repairAllowed = true;
                                                continue;
                                            }
                                            // special case: if there is a skipped/non-cloned direct child of 'el',
                                            // then enable repair for cloned elements that are direct children of that skipped element
                                            try {
                                                for (const skipped of skippedElements) {
                                                    try {
                                                        if (skipped.parentElement !== el) continue;
                                                        // find clones whose original parent is this skipped node
                                                        if (other._origEl.parentElement === skipped) {
                                                            other._repairAllowed = true;
                                                            break;
                                                        }
                                                    } catch (e) {}
                                                }
                                            } catch (e) {}
                                        } catch (e) {}
                                    }
                                } catch (e) {}
                            } catch (e) {}
                        };
                    } catch (e) {}
                    clones.push(pe);
                    created++;
                    try {
                        el.style.visibility = "hidden";
                    } catch (e) {}
                } catch (err) {
                    console.warn("[domExplosion] clone failed for", el && el.tagName, err);
                }
            }

            // shockwave scheduling: create a short-lived expanding wave that applies additional radial dv
            // We'll keep a simple representation: wave expands from expl{X,Y} from r=0 to r=maxR over dur ms
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
            function processShockwave(now) {
                const dtms = now - swStart;
                shockwave.t = dtms;
                const p = Math.min(1, shockwave.t / shockwave.dur);
                const currR = shockwave.r0 + (shockwave.r1 - shockwave.r0) * p;
                const waveThickness = Math.max(12, 80 * (1 - p) + 6);

                // when the wave front passes each body (distance within [currR - thickness/2, currR + thickness/2]) apply a pulse
                for (const item of swBodies) {
                    if (item.applied) continue;
                    const dx = item.pe.pos.x - shockwave.x;
                    const dy = item.pe.pos.y - shockwave.y;
                    const d = Math.sqrt(dx * dx + dy * dy);
                    if (d >= currR - waveThickness / 2 && d <= currR + waveThickness / 2) {
                        // pulse magnitude decays with distance and overall strength
                        const pulse = (1200 * shockwave.strength) / Math.max(12, d + 20);
                        const dir = { x: dx / (d || 1), y: dy / (d || 1) };
                        const dv = pulse / item.pe.mass;
                        // apply as an impulse that is stronger in the radial direction and slightly upward bias
                        // apply any precomputed main impulse first
                        try {
                            if (item.pe._pendingImpulse) {
                                // unfreeze before applying stored impulse so simulation begins
                                try {
                                    if (typeof item.pe.unfreeze === "function") item.pe.unfreeze();
                                } catch (e) {}
                                item.pe.v.x += item.pe._pendingImpulse.dvx;
                                item.pe.v.y += item.pe._pendingImpulse.dvy;
                                // compute angular impulse from stored J and dir; choose sign based on which corner is hit first
                                try {
                                    const corners = item.pe.getCorners(item.pe.ang, item.pe.pos);
                                    let nearest = corners[0];
                                    let nd = Infinity;
                                    let nearestIdx = 0;
                                    for (let i = 0; i < corners.length; i++) {
                                        const c = corners[i];
                                        const dd =
                                            (c.x - shockwave.x) * (c.x - shockwave.x) +
                                            (c.y - shockwave.y) * (c.y - shockwave.y);
                                        if (dd < nd) {
                                            nd = dd;
                                            nearest = c;
                                            nearestIdx = i;
                                        }
                                    }
                                    const r = { x: nearest.x - item.pe.pos.x, y: nearest.y - item.pe.pos.y };
                                    const rawTorque =
                                        r.x * (item.pe._pendingImpulse.J * item.pe._pendingImpulse.dir.y) -
                                        r.y * (item.pe._pendingImpulse.J * item.pe._pendingImpulse.dir.x);
                                    // user-specified direction rule:
                                    // if nearest corner is top-left (0) or bottom-right (2) => counterclockwise
                                    // else (top-right 1, bottom-left 3) => clockwise
                                    const wantsCCW = nearestIdx === 0 || nearestIdx === 2;
                                    const torqueMag = (Math.abs(rawTorque) * 0.02) / item.pe.inertia;
                                    item.pe.angV += (wantsCCW ? -1 : 1) * torqueMag;
                                } catch (e) {}
                                // clear pending marker so we don't reapply
                                delete item.pe._pendingImpulse;
                            }
                        } catch (e) {}

                        // apply shockwave pulse
                        item.pe.v.x += dir.x * dv;
                        item.pe.v.y += dir.y * dv - Math.abs(dv) * 0.08;
                        // small angular kick with direction based on which corner the wave hit
                        try {
                            // reuse nearest corner logic to determine preferred rotation direction
                            const corners2 = item.pe.getCorners(item.pe.ang, item.pe.pos);
                            let nd2 = Infinity;
                            let nearestIdx2 = 0;
                            for (let i = 0; i < corners2.length; i++) {
                                const c = corners2[i];
                                const dd =
                                    (c.x - shockwave.x) * (c.x - shockwave.x) +
                                    (c.y - shockwave.y) * (c.y - shockwave.y);
                                if (dd < nd2) {
                                    nd2 = dd;
                                    nearestIdx2 = i;
                                }
                            }
                            const wantsCCW2 = nearestIdx2 === 0 || nearestIdx2 === 2;
                            const smallKick = 0.03 * shockwave.strength * (0.6 + Math.random() * 0.8);
                            item.pe.angV += (wantsCCW2 ? -1 : 1) * smallKick;
                        } catch (e) {
                            // fallback random jitter
                            item.pe.angV += (Math.random() - 0.5) * 0.06 * shockwave.strength;
                        }
                        item.applied = true;
                    }
                }

                if (p < 1) requestAnimationFrame(processShockwave);
            }
            requestAnimationFrame(processShockwave);

            console.log("[domExplosion] created clones:", created, "total elems:", allElems.length);

            // remove the controls wrapper so it doesn't block picking up pieces
            try {
                const cw = document.getElementById("controls-wrap");
                if (cw && cw.parentElement) cw.parentElement.removeChild(cw);
            } catch (e) {}

            // Animate with a clamped timestep to avoid explosion on tab-switch or long pauses
            let last = performance.now();
            function frame(now) {
                let ms = now - last || 16;
                // clamp ms to [8, 40] ms to avoid huge dt on tab switch or suspends
                ms = Math.max(8, Math.min(40, ms));
                last = now;
                const dt = ms * 0.06; // reuse the fireworks time scaling, dt in reasonable range
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

                // (removed pairwise collisions) clones only collide with viewport edges

                // render all (skip removed)
                clones.forEach((p) => {
                    if (!p._removed) p.render();
                });
                requestAnimationFrame(frame);
            }
            requestAnimationFrame(frame);
        },
    };
}

// Debug helper: report shallow-cloneability of first N children of .wrap
export async function debugSnapshotSample(n = 12) {
    const container = document.querySelector(".wrap");
    if (!container) return console.log("[domExplosion debug] no .wrap");
    const items = Array.from(container.children).slice(0, n);
    for (const el of items) {
        const rect = el.getBoundingClientRect();
        console.log(
            "[domExplosion debug sample]",
            el.tagName,
            "rect=",
            rect,
            "shallowCloneOK=",
            rect.width >= 4 && rect.height >= 4,
        );
    }
}
