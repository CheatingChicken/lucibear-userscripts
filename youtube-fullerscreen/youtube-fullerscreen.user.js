// ==UserScript==
// @name         YouTube Restore Deprecated Fullscreen UI
// @namespace    https://github.com/CheatingChicken/lucibear-userscripts
// @version      0.1
// @description  Remove `deprecate-fullerscreen-ui` attribute from YouTube watch pages after load
// @author       Lucibear
// @match        https://www.youtube.com/watch*
// @run-at       document-idle
// @updateURL    https://cheatingchicken.github.io/lucibear-userscripts/youtube-fullerscreen/youtube-fullerscreen.user.js
// @downloadURL  https://cheatingchicken.github.io/lucibear-userscripts/youtube-fullerscreen/youtube-fullerscreen.user.js
// @grant        none
// ==/UserScript==

(function () {
    "use strict";

    // Contract:
    // - Input: DOM of a YouTube watch page after load
    // - Output: remove the attribute `deprecate-fullerscreen-ui` from the first matching element
    // - Errors: fail silently; log a message if nothing was found or an error occurred

    const ATTRIBUTE = "deprecate-fullerscreen-ui";

    // Attempts to remove the attribute. Returns true if an attribute was removed.
    function removeAttributeIfPresent() {
        try {
            const el = document.querySelector(`[${ATTRIBUTE}]`);
            if (el) {
                el.removeAttribute(ATTRIBUTE);
                console.log("youtube-fullerscreen: removed attribute", ATTRIBUTE);
                return true;
            }
            return false;
        } catch (err) {
            // Keep failures silent for page behaviour; log for debugging.
            console.log("youtube-fullerscreen: error while trying to remove attribute (ignored):", err);
            return false;
        }
    }

    // Ensure script runs after document load. Use document-idle @run-at, and also attach to load if needed.
    if (document.readyState === "complete" || document.readyState === "interactive") {
        // Defer slightly so dynamic content that finishes immediately after readyState can settle
        setTimeout(removeAttributeIfPresent, 0);
    } else {
        window.addEventListener("load", () => setTimeout(removeAttributeIfPresent, 0), { once: true });
    }

    // Lightweight MutationObserver to cover SPA navigations or late-inserted elements.
    // Keep the observer running so the attribute is removed whenever the player
    // adds it (e.g. when toggling fullscreen).
    const observer = new MutationObserver((mutations) => {
        try {
            // Try to remove attr; only log when an actual removal occurred.
            removeAttributeIfPresent();
        } catch (e) {
            // ignore observation errors
        }
    });

    observer.observe(document.documentElement || document, { childList: true, subtree: true, attributes: true });
})();
