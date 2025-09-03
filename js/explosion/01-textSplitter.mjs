/**
 * Text node splitting utilities
 */

/**
 * Split text nodes into word spans for better granular physics
 * @param {HTMLElement|Document} root
 */
export function splitTextNodes(root) {
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
        }
        try {
            textNode.parentNode.replaceChild(frag, textNode);
        } catch (e) {}
    }
}
