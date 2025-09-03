/**
 * Physics element creation and setup
 */
import { PhysicsElement } from "../physicsElement.mjs";

/**
 * Mark all direct children of a repaired element as repairable, and recursively handle dom-skipped children
 * @param {Element} repairedElement - The element that was just repaired
 * @param {Array} clones - Array of all physics element clones to update
 */
function markChildrenAsRepairable(repairedElement, clones) {
    // debugger;
    try {
        // Mark all direct children as repairable
        const directChildren = Array.from(repairedElement.children || []);
        console.log("Marking direct children as repairable", { elements: directChildren });
        for (const child of directChildren) {
            try {
                child.classList.add("repairable");

                const childClone = clones.find((clone) => clone._origEl === child);
                if (childClone) {
                    // Update repairability using the proper method
                    try {
                        childClone.classList.add("repairable");
                    } catch (e) {}
                }

                // If this child was dom-skipped, recursively mark its children too
                if (child.classList && child.classList.contains("dom-skip")) {
                    console.log("Marking children oof skipped element", { element: child });
                    markChildrenAsRepairable(child, clones);
                }
            } catch (e) {}
        }
    } catch (e) {}
}

/**
 * Create physics element from DOM element
 * @param {HTMLElement} el
 * @param {HTMLElement} container
 * @param {number} explX
 * @param {number} explY
 * @param {number} blastStrength
 * @param {Set} repairedOriginals
 * @param {Array} clones - Array of all physics element clones (for updating repairability)
 * @returns {PhysicsElement|null}
 */
export function createPhysicsElement(el, container, explX, explY, blastStrength, repairedOriginals, clones = []) {
    try {
        const rect = el.getBoundingClientRect();
        if (rect.width < 4 || rect.height < 4) return null;

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

        // Style the clone
        clone.style.position = "absolute";
        clone.style.left = pageLeft + "px";
        clone.style.top = pageTop + "px";
        clone.style.width = rect.width + "px";
        clone.style.height = rect.height + "px";
        clone.style.boxSizing = "border-box";
        clone.style.margin = "0";
        clone.style.overflow = "hidden";
        clone.style.zIndex = 9999;
        clone.style.pointerEvents = "auto";
        clone.style.cursor = "grab";
        clone.style.willChange = "left, top, transform";
        clone.style.transform = "rotate(0deg)";
        clone.style.transformOrigin = "center center";

        // copy a few computed styles to better match visual appearance
        try {
            const cs = getComputedStyle(el);
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

        // create physics body
        const pe = new PhysicsElement(
            clone,
            rect,
            { x: pageLeft, y: pageTop },
            { x: 0, y: 0, noJitter: true, frozen: true },
        );

        // apply explosion impulse calculations
        const ex = cx - explX;
        const ey = cy - explY;
        const edist = Math.max(8, Math.sqrt(ex * ex + ey * ey));
        const dir = { x: ex / edist, y: ey / edist };
        const Jraw = 300 + Math.random() * 900;
        const J = (Jraw * blastStrength * (0.85 + Math.random() * 0.3)) / edist;
        const dvx = (J / pe.mass) * dir.x;
        const dvy = (J / pe.mass) * dir.y;

        pe._pendingImpulse = { dvx, dvy, J, dir, edist };

        // angular impulse calculation
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
            const torque = r.x * (J * dir.y) - r.y * (J * dir.x);
            pe.angV += (torque * 0.02) / pe.inertia;
            pe.angV += (Math.random() - 0.5) * 0.02;
        } catch (e) {}

        // Store original element reference
        pe._origEl = el;
        pe._origRect = rect;
        pe._origCenter = { x: cx, y: cy };
        pe._repairThreshold = 20;

        // Set up repair callback
        pe._onRepair = createRepairCallback(pe, el, repairedOriginals, clones);

        // Hide original element
        try {
            el.style.visibility = "hidden";
        } catch (e) {}

        return pe;
    } catch (err) {
        console.warn("[domExplosion] clone failed for", el && el.tagName, err);
        return null;
    }
}

/**
 * Create repair callback for physics element
 */
function createRepairCallback(pe, el, repairedOriginals, clones) {
    return () => {
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
            pe._removalAt = (performance && performance.now ? performance.now() : Date.now()) + 520;

            // mark the original element as repaired
            try {
                repairedOriginals.add(el);
                try {
                    el.classList && el.classList.add("repaired-original");
                } catch (e) {}

                // mark all direct children as repairable and recursively handle dom-skipped children
                try {
                    markChildrenAsRepairable(el, clones);
                } catch (e) {}
            } catch (e) {}
        } catch (e) {}
    };
}
