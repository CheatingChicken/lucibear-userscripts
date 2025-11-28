# Patreon Autoplay - Cross-Script Communication Proof of Concept

## How It Works

This uses Tampermonkey's `GM_setValue` and `GM_getValue` APIs to communicate between two userscripts running on different domains:

1. **Streamable Monitor** (`streamable-monitor.user.js`) - Runs on streamable.com

    - Detects video events (play, pause, ended)
    - Extracts video ID from URL pathname
    - Broadcasts video state with metadata via `GM_setValue`
    - Data structure: `{state, videoId, timestamp, url, duration, currentTime}`

2. **Patreon Autoplay** (`patreon-autoplay.user.js`) - Runs on patreon.com
    - Listens for state changes via `GM_addValueChangeListener`
    - Validates video ID against current page's iframe
    - Auto-advances to next post when video ends (if IDs match)
    - Supports GM4 (Promise-based) and GM3 (synchronous) APIs

## Installation for Testing

### Step 1: Install Streamable Monitor

Install the local test version:

```javascript
// Copy contents of streamable-monitor.local.user.js
// Or install streamable-monitor.user.js directly
```

### Step 2: Update Patreon Autoplay

The main script has been updated with `@grant GM_getValue` and `@grant GM_addValueChangeListener`.

### Step 3: Test Single Tab

1. Open a Patreon collection page: `https://www.patreon.com/posts/xxx?collection=yyy`
2. Check console for: `[Patreon Autoplay] Streamable listener active`
3. Check for current video ID: `[Patreon Autoplay] Current iframe video ID: abc123`
4. Click on a Streamable video in the embedded iframe
5. Let the video play completely
6. Check console for:
    - `[Streamable Monitor] Broadcast: ended | ID: abc123 | ...`
    - `[Patreon Autoplay] Received Streamable state: {state: "ended", videoId: "abc123", ...}`
    - `[Patreon Autoplay] Current iframe video ID: abc123`
    - `[Patreon Autoplay] Streamable video ended (validated), checking autoplay...`
7. If autoplay is enabled, page should navigate to next post

### Step 4: Test Multi-Tab Isolation

1. Open two different posts from same collection in separate tabs
2. Tab A: Post with video X
3. Tab B: Post with video Y
4. Play video X in Tab A to completion
5. Tab A should navigate to next post
6. Tab B should stay on current post and log:
    - `[Patreon Autoplay] Video ID mismatch - received: X current: Y`
    - `[Patreon Autoplay] Ignoring state from different video/tab`

## Debugging

### Check if Streamable Monitor is Running

Open any Streamable page and check console for:

```
[Streamable Monitor] Script loaded
[Streamable Monitor] Initializing Streamable monitor...
```

### Check if Communication Works

In Streamable page console, manually trigger:

```javascript
// For GM4 API
GM.setValue(
    "streamable-video-state",
    JSON.stringify({
        state: "ended",
        videoId: "test123",
        timestamp: Date.now(),
        url: window.location.href,
        duration: 120,
        currentTime: 120,
    }),
);

// For GM3 API
GM_setValue(
    "streamable-video-state",
    JSON.stringify({
        state: "ended",
        videoId: "test123",
        timestamp: Date.now(),
        url: window.location.href,
        duration: 120,
        currentTime: 120,
    }),
);
```

Then check Patreon page console for the received message.

### Check Current Video ID

In Patreon page console:

```javascript
// Get iframe element
const iframe = document.querySelector('iframe[src*="streamable.com"]');
console.log(iframe?.src);

// Extract video ID
const url = new URL(iframe.src);
const videoId = url.pathname
    .split("/")
    .filter((p) => p)
    .pop();
console.log("Video ID:", videoId);
```

### Check GM Functions

In both consoles:

```javascript
console.log(typeof GM_setValue); // Should be "function"
console.log(typeof GM_getValue); // Should be "function"
console.log(typeof GM_addValueChangeListener); // Should be "function"
```

## Limitations

-   Only works with Tampermonkey (or compatible extensions that support GM APIs)
-   Both scripts must have the appropriate `@grant` permissions
-   State updates happen near-instantly but are not real-time synchronous

## Fallback

If cross-script communication fails, you can still use:

-   **'N' key** to manually advance to next post
-   Direct video element detection (for non-iframe videos)
