// ==UserScript==
// @name         Patreon Collection Autoplay
// @namespace    https://github.com/CheatingChicken/lucibear-userscripts
// @version      1.3.0
// @description  Automatically plays the next video in a Patreon collection (Streamable videos)
// @author       Lucibear
// @match        https://www.patreon.com/posts/*
// @match        https://streamable.com/*
// @grant        none
// @updateURL    https://cheatingchicken.github.io/lucibear-userscripts/patreon-autoplay/patreon-autoplay.user.js
// @downloadURL  https://cheatingchicken.github.io/lucibear-userscripts/patreon-autoplay/patreon-autoplay.user.js
// @run-at       document-end
// ==/UserScript==

(function () {
    "use strict";

    // Detect which page we're on
    const isPatreonPage = window.location.hostname.includes("patreon.com");
    const isStreamablePage = window.location.hostname.includes("streamable.com");

    // =============================================================================
    // STREAMABLE VIDEO MONITOR (runs on streamable.com)
    // =============================================================================
    if (isStreamablePage) {
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
                const url = new URL(window.location.href);
                const pathParts = url.pathname.split("/").filter((p) => p);
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

        // Initialize Streamable monitor
        function initStreamable() {
            broadcastVideoState("initialized", null);
            pollForVideo();
        }

        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", initStreamable);
        } else {
            initStreamable();
        }

        return; // Exit early for Streamable pages
    }

    // =============================================================================
    // PATREON AUTOPLAY (runs on patreon.com)
    // =============================================================================
    if (!isPatreonPage) {
        return; // Exit if not on Patreon or Streamable
    }

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

                // Check if this is from our Streamable monitor script
                if (data && typeof data === "object" && data.source === "streamable-monitor") {
                    // Validate video ID matches current iframe
                    if (validateVideoState(data)) {
                        if (data.state === "ended") {
                            log("Video ended, navigating to next post...");
                            handleVideoEnded();
                        }
                    }
                    return;
                }

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
        log("PostMessage listener set up (listening for Streamable monitor + Vimeo/YouTube)");
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
            // Look for iframe that contains streamable in src or embedly with streamable
            const iframe = document.querySelector('iframe[src*="streamable"], iframe[src*="embedly"]');
            if (!iframe) {
                return null;
            }

            const iframeSrc = iframe.getAttribute("src");
            if (!iframeSrc) {
                return null;
            }

            // Extract video ID from different possible formats:
            // 1. Direct: https://streamable.com/o/a392qi
            // 2. Embedly: //cdn.embedly.com/widgets/media.html?src=https%3A%2F%2Fstreamable.com%2Fo%2Fa392qi&...

            let videoId = null;

            // Check if it's an embedly iframe with encoded streamable URL
            if (iframeSrc.includes("embedly")) {
                // Extract the 'src' parameter which contains the encoded Streamable URL
                const srcMatch = iframeSrc.match(/[?&]src=([^&]+)/);
                if (srcMatch) {
                    const encodedUrl = srcMatch[1];
                    const decodedUrl = decodeURIComponent(encodedUrl);

                    // Extract video ID from decoded URL: https://streamable.com/o/a392qi
                    const idMatch = decodedUrl.match(/streamable\.com\/(?:o\/)?([a-zA-Z0-9]+)/);
                    if (idMatch) {
                        videoId = idMatch[1];
                    }
                }
            } else {
                // Direct streamable iframe - extract from path
                const url = new URL(iframeSrc.startsWith("//") ? "https:" + iframeSrc : iframeSrc);
                const pathParts = url.pathname.split("/").filter((p) => p);
                videoId = pathParts[pathParts.length - 1];
            }

            return videoId || null;
        } catch (error) {
            logError("Error getting current video ID:", error);
            return null;
        }
    }

    // Validate if the received video state matches current page
    function validateVideoState(data) {
        if (!data || !data.videoId) {
            return false;
        }

        const currentVideoId = getCurrentStreamableVideoId();
        if (!currentVideoId) {
            return false;
        }

        return data.videoId === currentVideoId;
    }

    // Setup keyboard shortcut for manual next
    function setupKeyboardShortcut() {
        const hasGM4 = typeof GM !== "undefined" && typeof GM.getValue === "function";
        const hasGM3 = typeof GM_getValue === "function";

        if (!hasGM4 && !hasGM3) return;

        log("Starting GM storage polling (500ms interval)...");

        let pollCount = 0;
        pollingInterval = setInterval(async () => {
            try {
                pollCount++;
                let currentValue;

                if (hasGM4) {
                    currentValue = await GM.getValue("streamable-video-state");
                } else if (hasGM3) {
                    currentValue = GM_getValue("streamable-video-state");
                }

                // Log every 10th poll to show it's working
                if (pollCount % 10 === 0) {
                    console.log(`[Poll #${pollCount}] Checking... Current value exists: ${!!currentValue}`);
                }

                if (currentValue && currentValue !== lastKnownState) {
                    console.log("🎉🎉🎉 POLLING DETECTED CHANGE! 🎉🎉🎉");
                    console.log("Poll #", pollCount);
                    console.log("Old:", lastKnownState);
                    console.log("New:", currentValue);

                    lastKnownState = currentValue;

                    try {
                        const data = JSON.parse(currentValue);
                        console.log("📦 Parsed data:", data);
                        console.log("📦 State:", data.state);
                        console.log("📦 Video ID:", data.videoId);
                        console.log("📦 Timestamp:", data.timestamp);
                    } catch (error) {
                        logError("Error parsing polled state:", error);
                    }
                }
            } catch (error) {
                logError("Error polling GM storage:", error);
            }
        }, 500);
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
            console.log("[Patreon Autoplay] WARNING: Listener may not work cross-domain, starting polling fallback...");

            // Start polling as fallback (listener doesn't work cross-domain reliably)
            startPollingGMStorage();

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

    // Initialize the script
    async function init() {
        log("Initializing...");

        if (!isCollectionPage()) {
            log("Not a collection page, script will not activate");
            return;
        }

        log("Collection page detected");

        // Set up keyboard shortcut for manual navigation
        setupKeyboardShortcut();

        // Set up postMessage listener for iframe communication
        setupPostMessageListener();
        log("✓ PostMessage listener active for Streamable video events");

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
