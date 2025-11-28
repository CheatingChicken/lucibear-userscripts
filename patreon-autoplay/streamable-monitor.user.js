// ==UserScript==
// @name         Streamable Video Monitor (for Patreon Autoplay)
// @namespace    https://github.com/CheatingChicken/lucibear-userscripts
// @version      1.0.0
// @description  Monitors Streamable video playback with video ID tracking and GM storage sync
// @author       Lucibear
// @match        https://streamable.com/*
// @grant        GM.setValue
// @grant        GM.getValue
// @updateURL    https://cheatingchicken.github.io/lucibear-userscripts/patreon-autoplay/streamable-monitor.user.js
// @downloadURL  https://cheatingchicken.github.io/lucibear-userscripts/patreon-autoplay/streamable-monitor.user.js
// @run-at       document-end
// ==/UserScript==

(function () {
    "use strict";

    const LOG_PREFIX = "[Streamable Monitor]";

    function log(message, ...args) {
        console.log(`${LOG_PREFIX} ${message}`, ...args);
    }

    function logError(message, ...args) {
        console.error(`${LOG_PREFIX} ${message}`, ...args);
    }

    // Extract video ID from URL
    function getVideoId() {
        try {
            // Streamable URLs can be:
            // https://streamable.com/o/2fds33
            // https://streamable.com/2fds33
            const url = new URL(window.location.href);
            const pathParts = url.pathname.split("/").filter((p) => p);

            // Get the last part of the path (video ID)
            const videoId = pathParts[pathParts.length - 1];
            return videoId || null;
        } catch (error) {
            logError("Error extracting video ID:", error);
            return null;
        }
    }

    // Broadcast video state via postMessage to parent window
    function broadcastVideoState(state, videoElement) {
        try {
            const videoId = getVideoId();
            const data = {
                source: "streamable-monitor",
                state: state,
                videoId: videoId,
                timestamp: Date.now(),
                url: window.location.href,
                duration: videoElement ? videoElement.duration : null,
                currentTime: videoElement ? videoElement.currentTime : null,
            };

            // Send message to parent window (Patreon page)
            if (window.parent && window.parent !== window) {
                window.parent.postMessage(data, "*");
            }

            if (window.top && window.top !== window) {
                window.top.postMessage(data, "*");
            }
        } catch (error) {
            logError("Error broadcasting state:", error);
        }
    }

    // Setup video monitoring
    function setupVideoMonitor() {
        try {
            const video = document.querySelector("video");
            if (!video) {
                return false;
            }

            // Listen for ended event
            video.addEventListener("ended", function () {
                broadcastVideoState("ended", video);
            });

            // Listen for play event
            video.addEventListener("play", function () {
                broadcastVideoState("playing", video);
            });

            // Listen for pause event
            video.addEventListener("pause", function () {
                broadcastVideoState("paused", video);
            });

            // Broadcast initial state
            if (video.paused) {
                broadcastVideoState("paused", video);
            } else {
                broadcastVideoState("playing", video);
            }

            return true;
        } catch (error) {
            logError("Error setting up video monitor:", error);
            return false;
        }
    }

    // Poll for video element
    function pollForVideo() {
        let attempts = 0;
        const maxAttempts = 20;
        const pollInterval = 500;

        const poll = () => {
            attempts++;

            if (setupVideoMonitor()) {
                return;
            }

            if (attempts >= maxAttempts) {
                return;
            }

            setTimeout(poll, pollInterval);
        };

        poll();
    }

    // Initialize
    function init() {
        // Broadcast initial state
        broadcastVideoState("initialized", null);

        // Start polling for video
        pollForVideo();
    }

    // Start when ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
