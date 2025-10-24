// ==UserScript==
// @name         YouTube Restore Deprecated Fullscreen UI
// @namespace    https://github.com/CheatingChicken/lucibear-userscripts
// @version      0.3
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

    // Translated CSS from adblock filter rules -> inject into the page so
    // the full-screen layout behaves like the old UI. Kept in a single
    // style element so it can be re-applied by the observer if YouTube
    // replaces it during SPA navigations.
    const CSS = /*css*/ `
        /* Layout fixes for fullscreen mode */
        ytd-watch-flexy[fullscreen] #single-column-container.ytd-watch-flexy,
        ytd-watch-flexy[fullscreen] #columns.ytd-watch-flexy {
            display: flex !important;
        }
        ytd-app[fullscreen] {
            overflow: auto !important;
        }
        ytd-app[scrolling] {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            right: calc((var(--ytd-app-fullerscreen-scrollbar-width) + 1px) * -1) !important;
            bottom: 0 !important;
            overflow-x: auto !important;
        }
        
        /* Hide fullscreen grid elements when in fullscreen grid mode */
        .html5-video-player.ytp-fullscreen:is(.ytp-fullscreen-grid-peeking, .ytp-fullscreen-grid-active) .ytp-fullscreen-grid {
            display: none !important;
        }
        .html5-video-player.ytp-fullscreen:is(.ytp-fullscreen-grid-peeking, .ytp-fullscreen-grid-active) .ytp-gradient-bottom {
            display: none !important;
        }
        
        /* Position video controls at bottom when in fullscreen grid mode */
        .html5-video-player.ytp-fullscreen:is(.ytp-fullscreen-grid-peeking, .ytp-fullscreen-grid-active) .ytp-chrome-bottom {
            bottom: 0px !important;
        }
        .html5-video-player.ytp-fullscreen:is(.ytp-fullscreen-grid-peeking, .ytp-fullscreen-grid-active):not(:is(.ytp-autohide, .ytp-autohide-active)) .ytp-chrome-bottom {
            opacity: unset !important;
        }
        
        /* Position overlays container when in fullscreen grid mode */
        .html5-video-player.ytp-fullscreen:is(.ytp-fullscreen-grid-peeking, .ytp-fullscreen-grid-active) .ytp-overlays-container {
            bottom: 90px !important;
        }
        .html5-video-player.ytp-fullscreen:is(.ytp-fullscreen-grid-peeking, .ytp-fullscreen-grid-active):not(:is(.ytp-autohide, .ytp-autohide-active)) .ytp-overlays-container {
            opacity: unset !important;
        }
        `;

    function injectCSS() {
        try {
            if (document.getElementById("yt-fullerscreen-fix-style")) return;
            const s = document.createElement("style");
            s.id = "yt-fullerscreen-fix-style";
            s.textContent = CSS;
            (document.head || document.documentElement).appendChild(s);
            console.log("youtube-fullerscreen: injected CSS fixes");
        } catch (err) {
            // non-fatal
            console.log("youtube-fullerscreen: failed to inject CSS (ignored):", err);
        }
    }

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
            // Ensure our CSS exists after SPA navigations or DOM replacements.
            injectCSS();
        } catch (e) {
            // ignore observation errors
        }
    });

    observer.observe(document.documentElement || document, { childList: true, subtree: true, attributes: true });
})();
