/**
 * Element skipping logic for transparent containers
 */

/**
 * Check if an element should be skipped (transparent container with children)
 * @param {HTMLElement} el
 * @returns {boolean}
 */
export function shouldSkipElement(el) {
    try {
        const cs = getComputedStyle(el);
        const bgImage = (cs && cs.getPropertyValue && cs.getPropertyValue("background-image")) || "";
        const bgColor = (cs && cs.getPropertyValue && cs.getPropertyValue("background-color")) || "";
        const isTransparentColor =
            /transparent/i.test(bgColor) || /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/i.test(bgColor);

        if ((bgImage === "none" || !bgImage) && isTransparentColor) {
            // If element has other element children, treat it as a container and skip it.
            // Text-only elements (no element children) should still be cloned so text can become PEs.
            const hasElementChildren = el.children && el.children.length > 0;
            return hasElementChildren;
        }
        return false;
    } catch (e) {
        return false;
    }
}

/**
 * Mark element as skipped and add to skipped set
 * @param {HTMLElement} el
 * @param {Set} skippedElements
 * @param {HTMLElement} container
 */
export function markElementSkipped(el, skippedElements, container) {
    try {
        skippedElements.add(el);
        try {
            el.classList && el.classList.add("dom-skip");
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
    } catch (e) {}
}
