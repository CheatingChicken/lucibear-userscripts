// ==UserScript==
// @name         Patreon Collection Autoplay
// @namespace    https://github.com/CheatingChicken/lucibear-userscripts
// @version      1.2.0
// @description  Automatically plays the next video in a Patreon collection with multi-tab support
// @author       Lucibear
// @match        https://www.patreon.com/posts/*
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.addValueChangeListener
// @run-at       document-end
// ==/UserScript==

(function () {
    "use strict";

    const STORAGE_KEY = "patreon-autoplay-enabled";
    const LOG_PREFIX = "[Patreon Autoplay]";

    // Helper function for logging
    function log(message, ...args) {
        console.log(`${LOG_PREFIX} ${message}`, ...args);
    }

    function logError(message, ...args) {
        console.error(`${LOG_PREFIX} ${message}`, ...args);
    }

    // Check if we're on a collection page
    function isCollectionPage() {
        try {
            const url = new URL(window.location.href);
            const hasCollection = url.searchParams.has("collection");
            const isPostPage = url.pathname.startsWith("/posts/");
            return isPostPage && hasCollection;
        } catch (error) {
            logError("Error checking collection page:", error);
            return false;
        }
    }

    // Get autoplay state from localStorage
    function getAutoplayState() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            // Default to true if not set
            return stored === null ? true : stored === "true";
        } catch (error) {
            logError("Error reading autoplay state from localStorage:", error);
            return true;
        }
    }

    // Set autoplay state to localStorage
    function setAutoplayState(enabled) {
        try {
            localStorage.setItem(STORAGE_KEY, enabled.toString());
            log("Autoplay state saved:", enabled);
        } catch (error) {
            logError("Error saving autoplay state to localStorage:", error);
        }
    }

    // Find the next post button (anchor or button)
    function findNextPostButton() {
        try {
            // Try to find anchor first (active state), then button (disabled state)
            const nextButton = document.querySelector('a[data-tag="next-post"], button[data-tag="next-post"]');
            if (!nextButton) {
                log("Next post button not found");
                return null;
            }

            // Check if it's disabled
            if (nextButton.tagName === "BUTTON" && nextButton.getAttribute("aria-disabled") === "true") {
                log("Next post button is disabled (end of collection)");
                return null;
            }

            return nextButton;
        } catch (error) {
            logError("Error finding next post button:", error);
            return null;
        }
    }

    // Find the previous post button (anchor or button)
    function findPreviousPostButton() {
        try {
            // Try to find anchor first (active state), then button (disabled state)
            const prevButton = document.querySelector('a[data-tag="previous-post"], button[data-tag="previous-post"]');
            if (!prevButton) {
                log("Previous post button not found");
                return null;
            }
            return prevButton;
        } catch (error) {
            logError("Error finding previous post button:", error);
            return null;
        }
    }

    // Navigate to next post
    function goToNextPost() {
        try {
            const nextButton = findNextPostButton();
            if (!nextButton) {
                log("Cannot navigate: next post button not found");
                return;
            }

            const href = nextButton.getAttribute("href");
            if (!href) {
                logError("Next post button has no href attribute");
                return;
            }

            log("Navigating to next post:", href);
            window.location.href = href;
        } catch (error) {
            logError("Error navigating to next post:", error);
        }
    }

    // Setup video event listener
    function setupVideoListener() {
        try {
            // First try to find a direct video element
            let video = document.querySelector("video");

            // If not found, check inside iframes
            if (!video) {
                const iframes = document.querySelectorAll("iframe");
                for (const iframe of iframes) {
                    try {
                        // Try to access iframe content (will fail for cross-origin)
                        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                        if (iframeDoc) {
                            video = iframeDoc.querySelector("video");
                            if (video) {
                                break;
                            }
                        }
                    } catch (e) {
                        // Cross-origin iframe, can't access - this is expected
                        continue;
                    }
                }
            }

            if (!video) {
                return false;
            }

            // Check if listener already added
            if (video.dataset.listenerAdded === "true") {
                return true;
            }

            log("Video element found, setting up event listener");

            video.addEventListener("ended", function () {
                log("Video ended event fired");

                const autoplayEnabled = getAutoplayState();
                log("Autoplay enabled:", autoplayEnabled);

                if (autoplayEnabled) {
                    log("Autoplay is enabled, redirecting to next post...");
                    goToNextPost();
                } else {
                    log("Autoplay is disabled, not redirecting");
                }
            });

            video.dataset.listenerAdded = "true";
            return true;
        } catch (error) {
            logError("Error setting up video listener:", error);
            return false;
        }
    }

    // Setup postMessage listener for iframe video players
    function setupPostMessageListener() {
        let messageListenerAdded = false;

        window.addEventListener("message", function (event) {
            try {
                const data = event.data;

                // Only process messages from video player origins
                if (
                    !event.origin.includes("streamable") &&
                    !event.origin.includes("vimeo") &&
                    !event.origin.includes("youtube")
                ) {
                    return;
                }

                // Handle string-based messages
                if (typeof data === "string") {
                    try {
                        const parsed = JSON.parse(data);
                        if (
                            parsed.event === "ended" ||
                            parsed.event === "finish" ||
                            parsed.status === "ended" ||
                            parsed.type === "ended"
                        ) {
                            log("Video ended via postMessage (String/JSON):", parsed);
                            handleVideoEnded();
                        }
                    } catch (e) {
                        // Not JSON, check for simple string patterns
                        if (data.includes("ended") || data.includes("finish")) {
                            log("Video ended via postMessage (String pattern):", data);
                            handleVideoEnded();
                        }
                    }
                }
                // Handle object-based messages
                else if (data && typeof data === "object") {
                    // Streamable patterns (checking various possible formats)
                    if (
                        data.event === "ended" ||
                        data.event === "finish" ||
                        data.event === "onEnded" ||
                        data.event === "playerEnded" ||
                        data.type === "ended" ||
                        data.type === "finish" ||
                        data.status === "ended" ||
                        data.status === "finished" ||
                        data.state === "ended" ||
                        data.playerState === "ended"
                    ) {
                        log("Video ended via postMessage (Streamable/Generic):", data);
                        handleVideoEnded();
                    }
                    // Vimeo player
                    else if (data.event === "ended" || data.event === "finish") {
                        log("Video ended via postMessage (Vimeo):", data);
                        handleVideoEnded();
                    }
                    // YouTube player
                    else if (data.event === "onStateChange" && data.info === 0) {
                        log("Video ended via postMessage (YouTube):", data);
                        handleVideoEnded();
                    }
                }
            } catch (error) {
                // Silently ignore postMessage errors
            }
        });

        messageListenerAdded = true;
        log("PostMessage listener set up (supports Vimeo, YouTube if present)");
        return messageListenerAdded;
    }

    // Handle video ended event
    function handleVideoEnded() {
        const autoplayEnabled = getAutoplayState();
        log("Autoplay enabled:", autoplayEnabled);

        if (autoplayEnabled) {
            log("Autoplay is enabled, redirecting to next post...");
            goToNextPost();
        } else {
            log("Autoplay is disabled, not redirecting");
        }
    }

    // Poll for video element with exponential backoff
    function pollForVideo() {
        return new Promise((resolve) => {
            const maxAttempts = 20; // Poll for up to 10 seconds
            const pollInterval = 500; // Check every 500ms
            let attempts = 0;

            const poll = () => {
                attempts++;

                if (setupVideoListener()) {
                    log("Video listener setup successful");
                    resolve(true);
                    return;
                }

                if (attempts >= maxAttempts) {
                    log("Direct video element not found after 10 seconds, relying on postMessage");
                    resolve(false);
                    return;
                }

                setTimeout(poll, pollInterval);
            };

            poll();
        });
    }

    // Create and insert autoplay toggle
    function createAutoplayToggle() {
        try {
            const prevButton = findPreviousPostButton();
            if (!prevButton) {
                log("Cannot create toggle: previous post button not found");
                return;
            }

            // Check if toggle already exists
            if (document.querySelector("#patreon-autoplay-toggle")) {
                log("Autoplay toggle already exists");
                return;
            }

            // Create toggle container
            const toggleContainer = document.createElement("div");
            toggleContainer.id = "patreon-autoplay-toggle";
            toggleContainer.style.cssText = `
                display: inline-flex;
                align-items: center;
                margin-left: 12px;
                padding: 6px 12px;
                background: rgba(0, 0, 0, 0.1);
                border-radius: 4px;
                cursor: pointer;
                user-select: none;
                font-size: 14px;
                transition: background 0.2s;
            `;

            // Create checkbox
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.id = "patreon-autoplay-checkbox";
            checkbox.checked = getAutoplayState();
            checkbox.style.cssText = `
                margin-right: 6px;
                cursor: pointer;
            `;

            // Create label
            const label = document.createElement("label");
            label.htmlFor = "patreon-autoplay-checkbox";
            label.textContent = "Autoplay";
            label.style.cssText = `
                cursor: pointer;
                margin: 0;
            `;

            // Add hover effect
            toggleContainer.addEventListener("mouseenter", function () {
                toggleContainer.style.background = "rgba(0, 0, 0, 0.15)";
            });
            toggleContainer.addEventListener("mouseleave", function () {
                toggleContainer.style.background = "rgba(0, 0, 0, 0.1)";
            });

            // Add change event listener
            checkbox.addEventListener("change", function () {
                const enabled = checkbox.checked;
                setAutoplayState(enabled);
                log("Autoplay toggled:", enabled);
            });

            // Assemble toggle
            toggleContainer.appendChild(checkbox);
            toggleContainer.appendChild(label);

            // Insert after previous post button
            prevButton.parentNode.insertBefore(toggleContainer, prevButton.nextSibling);
            log("Autoplay toggle created and inserted");
        } catch (error) {
            logError("Error creating autoplay toggle:", error);
        }
    }

    // Get current Streamable video ID from iframe
    function getCurrentStreamableVideoId() {
        try {
            const iframe = document.querySelector('iframe[src*="streamable.com"]');
            if (!iframe) {
                return null;
            }

            const iframeSrc = iframe.getAttribute("src");
            if (!iframeSrc) {
                return null;
            }

            // Extract video ID from iframe src
            // Format: https://streamable.com/o/2fds33?referrer=...
            const url = new URL(iframeSrc);
            const pathParts = url.pathname.split("/").filter((p) => p);
            const videoId = pathParts[pathParts.length - 1];

            log("Current iframe video ID:", videoId);
            return videoId || null;
        } catch (error) {
            logError("Error getting current video ID:", error);
            return null;
        }
    }

    // Validate if the received video state matches current page
    function validateVideoState(data) {
        if (!data || !data.videoId) {
            log("No video ID in received state");
            return false;
        }

        const currentVideoId = getCurrentStreamableVideoId();
        if (!currentVideoId) {
            log("No Streamable iframe found on current page");
            return false;
        }

        const matches = data.videoId === currentVideoId;
        if (!matches) {
            log("Video ID mismatch - received:", data.videoId, "current:", currentVideoId);
        }

        return matches;
    }

    // Setup cross-script communication with Streamable monitor
    async function setupStreamableListener() {
        try {
            // Check if GM functions are available (both old and new API)
            const hasGM4 = typeof GM !== "undefined" && typeof GM.getValue === "function";
            const hasGM3 = typeof GM_getValue === "function";

            if (!hasGM4 && !hasGM3) {
                log("GM functions not available, cross-script communication disabled");
                return false;
            }

            log("Setting up Streamable video state listener...");

            // Handler function for state changes
            const handleStateChange = function (name, oldValue, newValue, remote) {
                // DEBUG: Log ALL parameters received
                console.log("═══════════════════════════════════════════════");
                console.log("[Patreon Autoplay] GM LISTENER TRIGGERED");
                console.log("Name:", name);
                console.log("Old Value:", oldValue);
                console.log("New Value:", newValue);
                console.log("Remote:", remote);
                console.log("═══════════════════════════════════════════════");

                try {
                    if (!newValue) {
                        log("No newValue received");
                        return;
                    }

                    const data = JSON.parse(newValue);
                    log("Parsed Streamable state:", data);

                    // Validate that this video belongs to current page
                    if (!validateVideoState(data)) {
                        log("Ignoring state from different video/tab");
                        return;
                    }

                    // If video ended, trigger navigation
                    if (data.state === "ended") {
                        log("Streamable video ended (validated), checking autoplay...");
                        handleVideoEnded();
                    }
                } catch (error) {
                    logError("Error processing Streamable state:", error);
                }
            };

            // Use GM4 API if available, otherwise fall back to GM3
            if (hasGM4) {
                log("Using GM4 API");
                console.log("[Patreon Autoplay] Registering GM4 listener for 'streamable-video-state'");
                const listenerId = GM.addValueChangeListener("streamable-video-state", handleStateChange);
                console.log("[Patreon Autoplay] GM4 listener registered, ID:", listenerId);
            } else {
                log("Using GM3 API");
                console.log("[Patreon Autoplay] Registering GM3 listener for 'streamable-video-state'");
                GM_addValueChangeListener("streamable-video-state", handleStateChange);
                console.log("[Patreon Autoplay] GM3 listener registered");
            }

            log("Streamable listener active - waiting for messages...");

            // Try to read current value to verify GM storage is accessible
            if (hasGM4) {
                GM.getValue("streamable-video-state").then((val) => {
                    console.log("[Patreon Autoplay] Current GM storage value:", val);
                    if (val) {
                        console.log("[Patreon Autoplay] Parsed current value:", JSON.parse(val));
                    }
                });
            } else if (hasGM3) {
                const val = GM_getValue("streamable-video-state");
                console.log("[Patreon Autoplay] Current GM storage value:", val);
                if (val) {
                    console.log("[Patreon Autoplay] Parsed current value:", JSON.parse(val));
                }
            }

            console.log("[Patreon Autoplay] Listener is now active and waiting for changes...");
            console.log("[Patreon Autoplay] NOTE: Listener only fires when value CHANGES, not on initial set");

            return true;
        } catch (error) {
            logError("Error setting up Streamable listener:", error);
            return false;
        }
    }

    // Setup keyboard shortcut for manual next
    function setupKeyboardShortcut() {
        try {
            document.addEventListener("keydown", function (event) {
                // Press 'N' key to go to next (ignore if typing in input/textarea)
                if (event.key === "n" || event.key === "N") {
                    const activeElement = document.activeElement;
                    const isTyping =
                        activeElement &&
                        (activeElement.tagName === "INPUT" ||
                            activeElement.tagName === "TEXTAREA" ||
                            activeElement.isContentEditable);

                    if (!isTyping) {
                        log("Keyboard shortcut triggered (N key)");
                        goToNextPost();
                        event.preventDefault();
                    }
                }
            });
            log("Keyboard shortcut set up (Press 'N' to go to next post)");
        } catch (error) {
            logError("Error setting up keyboard shortcut:", error);
        }
    }

    // Test function to manually trigger GM storage value
    function testGMStorage() {
        console.log("═══════════════════════════════════════════════");
        console.log("[TEST] Manually setting GM storage value...");
        const testData = {
            state: "test",
            videoId: "TEST123",
            timestamp: Date.now(),
            url: "test://test",
            duration: 999,
            currentTime: 999,
        };

        if (typeof GM !== "undefined" && typeof GM.setValue === "function") {
            GM.setValue("streamable-video-state", JSON.stringify(testData)).then(() => {
                console.log("[TEST] GM4 setValue complete");
            });
        } else if (typeof GM_setValue === "function") {
            GM_setValue("streamable-video-state", JSON.stringify(testData));
            console.log("[TEST] GM3 setValue complete");
        }
        console.log("═══════════════════════════════════════════════");
    }

    // Expose test function to console
    window.testGMStorage = testGMStorage;

    // Initialize the script
    async function init() {
        log("Initializing...");

        if (!isCollectionPage()) {
            log("Not a collection page, script will not activate");
            return;
        }

        log("Collection page detected");

        // Set up cross-script communication with Streamable
        const streamableListenerActive = await setupStreamableListener();

        // Expose test function
        log("Test function available: window.testGMStorage()");

        // Set up keyboard shortcut for manual navigation
        setupKeyboardShortcut();

        // Set up postMessage listener for cross-origin iframes
        setupPostMessageListener();

        // Poll for video element
        await pollForVideo();

        // Try to create toggle immediately
        createAutoplayToggle();

        // If toggle creation failed, retry after a delay
        if (!document.querySelector("#patreon-autoplay-toggle")) {
            setTimeout(() => {
                createAutoplayToggle();
            }, 2000);
        }

        // Set up a MutationObserver to handle dynamic content loading
        try {
            const observer = new MutationObserver(function (mutations) {
                // Check if toggle needs to be added
                if (!document.querySelector("#patreon-autoplay-toggle")) {
                    const prevButton = findPreviousPostButton();
                    if (prevButton) {
                        createAutoplayToggle();
                    }
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
            });

            log("MutationObserver set up for dynamic content");
        } catch (error) {
            logError("Error settings up MutationObserver:", error);
        }

        if (streamableListenerActive) {
            log("✓ Streamable cross-script communication active");
        }
        log("Tip: Press 'N' key to manually go to next post");
    }

    // Start the script when DOM is ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    log("Script loaded");
})();
