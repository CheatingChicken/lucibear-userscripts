// ==UserScript==
// @name         YouTube Remove Deprecated Fullscreen UI
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

    function removeAttributeIfPresent() {
        try {
            const el = document.querySelector(`[${ATTRIBUTE}]`);
            if (el) {
                el.removeAttribute(ATTRIBUTE);
                console.log("youtube-fullerscreen: removed attribute", ATTRIBUTE, el);
            } else {
                // Fail silently but provide a harmless log so the user can inspect behaviour
                console.log("youtube-fullerscreen: no elements with attribute found:", ATTRIBUTE);
            }
        } catch (err) {
            // Always fail silently for page behaviour — surface to console for debugging only
            console.log("youtube-fullerscreen: error while trying to remove attribute (ignored):", err);
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
    // It disconnects after it successfully handles the attribute once.
    const observer = new MutationObserver((mutations, obs) => {
        try {
            const found = document.querySelector(`[${ATTRIBUTE}]`);
            if (found) {
                removeAttributeIfPresent();
                obs.disconnect();
            }
        } catch (e) {
            // ignore observation errors
        }
    });

    observer.observe(document.documentElement || document, { childList: true, subtree: true });
})();
