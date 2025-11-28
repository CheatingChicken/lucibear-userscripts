// ==UserScript==
// @name         Streamable Video Monitor (for Patreon Autoplay)
// @namespace    https://github.com/CheatingChicken/lucibear-userscripts
// @version      1.0.0
// @description  Monitors Streamable video playback with video ID tracking and GM storage sync
// @author       Lucibear
// @match        https://streamable.com/*
// @grant        GM.setValue
// @grant        GM.getValue
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

    // Broadcast video state to GM storage
    async function broadcastVideoState(state, videoElement) {
        try {
            const videoId = getVideoId();
            const data = {
                state: state,
                videoId: videoId,
                timestamp: Date.now(),
                url: window.location.href,
                duration: videoElement ? videoElement.duration : null,
                currentTime: videoElement ? videoElement.currentTime : null,
            };

            // Use GM4 API if available, otherwise fall back to GM3
            if (typeof GM !== "undefined" && typeof GM.setValue === "function") {
                await GM.setValue("streamable-video-state", JSON.stringify(data));
            } else if (typeof GM_setValue === "function") {
                GM_setValue("streamable-video-state", JSON.stringify(data));
            } else {
                logError("No GM setValue function available");
                return;
            }

            log("Broadcast state:", state, "for video:", videoId);
        } catch (error) {
            logError("Error broadcasting state:", error);
        }
    }

    // Setup video monitoring
    function setupVideoMonitor() {
        try {
            const video = document.querySelector("video");
            if (!video) {
                log("No video element found");
                return false;
            }

            log("Video element found, setting up monitors");

            // Listen for ended event
            video.addEventListener("ended", function () {
                log("Video ended!");
                broadcastVideoState("ended", video);
            });

            // Listen for play event
            video.addEventListener("play", function () {
                log("Video playing");
                broadcastVideoState("playing", video);
            });

            // Listen for pause event
            video.addEventListener("pause", function () {
                log("Video paused");
                broadcastVideoState("paused", video);
            });

            // Broadcast initial state
            if (video.paused) {
                broadcastVideoState("paused", video);
            } else {
                broadcastVideoState("playing", video);
            }

            log("Video monitoring active");
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
                log("Successfully set up video monitoring");
                return;
            }

            if (attempts >= maxAttempts) {
                log("Video element not found after 10 seconds");
                return;
            }

            setTimeout(poll, pollInterval);
        };

        poll();
    }

    // Initialize
    function init() {
        log("Initializing Streamable monitor...");

        // Clear any old state
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

    log("Script loaded");
})();
