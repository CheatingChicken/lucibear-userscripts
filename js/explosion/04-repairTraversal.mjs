/**
 * Repair chain traversal and marking logic
 */

/**
 * Traverse DOM tree top-to-bottom and mark unbroken chains of skipped/repaired elements as repaired
 * @param {HTMLElement} container
 * @param {Set} repairedOriginals
 */
export function markRepairChains(container, repairedOriginals) {
    try {
        // Start with direct children of container
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

                // Traverse down the tree and mark unbroken chains
                traverseAndMarkChains(child, repairedOriginals);
            } catch (e) {}
        }
    } catch (e) {}
}

/**
 * Recursively traverse and mark repair chains
 * @param {HTMLElement} node
 * @param {Set} repairedOriginals
 */
function traverseAndMarkChains(node, repairedOriginals) {
    if (!node) return;

    try {
        const isRepaired = node.classList && node.classList.contains("repaired-original");
        const isSkipped = node.classList && node.classList.contains("dom-skip");

        // If current node is repaired or skipped, check children
        if (isRepaired || isSkipped) {
            const children = Array.from(node.children || []);
            for (const child of children) {
                try {
                    const childIsSkipped = child.classList && child.classList.contains("dom-skip");

                    // If child is skipped and parent is repaired/skipped, mark child as repaired
                    if (childIsSkipped) {
                        try {
                            child.classList.add("repaired-original");
                        } catch (e) {}
                        try {
                            repairedOriginals.add(child);
                        } catch (e) {}

                        // Continue traversing down this chain
                        traverseAndMarkChains(child, repairedOriginals);
                    }
                } catch (e) {}
            }
        }
    } catch (e) {}
}

/**
 * Update clone repairability based on original parent's repaired status
 * @param {Array} clones
 */
export function updateCloneRepairability(clones) {
    try {
        for (const clone of clones) {
            try {
                // Use the isRepairable() method to check and update class
                clone.isRepairable();
            } catch (e) {}
        }
    } catch (e) {}
}
