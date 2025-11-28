# Testing Guide - Patreon Autoplay with Multi-Tab Support

## Overview

This testing guide covers how to test the Patreon Collection Autoplay feature with video ID tracking to ensure proper multi-tab behavior.

## Features to Test

### 1. Basic Autoplay Functionality

-   ✅ Toggle appears on collection pages
-   ✅ Toggle state persists across page reloads
-   ✅ Navigation occurs automatically when video ends (if enabled)
-   ✅ Navigation does NOT occur if autoplay is disabled

### 2. Video ID Tracking

-   ✅ Only the tab with matching video triggers navigation
-   ✅ Other tabs ignore video ended events from different videos
-   ✅ Console logs show video ID validation

### 3. Cross-Script Communication

-   ✅ Streamable monitor detects video events
-   ✅ Patreon script receives video state updates
-   ✅ Video metadata (duration, currentTime) is transmitted

### 4. Keyboard Shortcut

-   ✅ Pressing 'N' key navigates to next post
-   ✅ Works regardless of autoplay toggle state
-   ✅ Fails gracefully at collection boundaries

## Testing Scenarios

### Scenario 1: Single Tab Basic Flow

1. Install both userscripts in Tampermonkey
2. Navigate to a Patreon collection page with Streamable videos
3. Open browser console (F12)
4. Look for initialization logs:
    ```
    [Patreon Autoplay] Initializing on collection page
    [Streamable Monitor] Initializing...
    ```
5. Play video to completion
6. Verify automatic navigation to next post
7. Check console for:
    ```
    [Streamable Monitor] Video ended
    [Patreon Autoplay] Received Streamable state: {state: "ended", videoId: "...", ...}
    [Patreon Autoplay] Current iframe video ID: ...
    [Patreon Autoplay] Streamable video ended (validated), checking autoplay...
    ```

### Scenario 2: Multi-Tab Isolation

1. Open two different posts from the same collection in separate tabs
2. Tab A: Post with video X
3. Tab B: Post with video Y
4. Play video X in Tab A to completion
5. **Expected:** Only Tab A navigates to next post
6. **Expected:** Tab B stays on current post
7. Check console in Tab B:
    ```
    [Patreon Autoplay] Received Streamable state: {state: "ended", videoId: "X", ...}
    [Patreon Autoplay] Current iframe video ID: Y
    [Patreon Autoplay] Video ID mismatch - received: X current: Y
    [Patreon Autoplay] Ignoring state from different video/tab
    ```

### Scenario 3: Toggle Persistence

1. Navigate to a collection page
2. Disable autoplay toggle
3. Reload page
4. Verify toggle remains unchecked
5. Play video to completion
6. **Expected:** No automatic navigation
7. Enable toggle
8. Reload page
9. Verify toggle is checked
10. Play video to completion
11. **Expected:** Automatic navigation occurs

### Scenario 4: Keyboard Shortcut

1. Navigate to any collection page
2. Press 'N' key
3. **Expected:** Navigate to next post
4. Navigate to last post in collection
5. Press 'N' key
6. **Expected:** Console log shows "Next post button not found" (disabled button)

### Scenario 5: Edge Cases

1. **No video on page:** Script should log "No Streamable iframe found" and remain idle
2. **Not a collection page:** Script should log "Not on a collection page" and exit
3. **First post in collection:** Previous button should be disabled, toggle should still appear
4. **Last post in collection:** Next button should be disabled, no navigation attempt

## Console Debugging Commands

Open browser console and try these commands:

```javascript
// Check current autoplay state
localStorage.getItem("patreon-autoplay-enabled");

// Manually enable autoplay
localStorage.setItem("patreon-autoplay-enabled", "true");

// Manually disable autoplay
localStorage.setItem("patreon-autoplay-enabled", "false");

// Check current video ID (Patreon page)
document.querySelector('iframe[src*="streamable.com"]')?.src;

// Get GM storage value (requires GM4 API)
GM.getValue("streamable-video-state").then(console.log);

// Or for GM3 API
console.log(GM_getValue("streamable-video-state"));
```

## Log Patterns to Look For

### Normal Operation (Streamable)

```
[Streamable Monitor] Initializing...
[Streamable Monitor] Video element found
[Streamable Monitor] Setting up video event listeners
[Streamable Monitor] Broadcast: initialized | ID: 2fds33 | null | https://streamable.com/o/2fds33
[Streamable Monitor] Broadcast: play | ID: 2fds33 | 0.00s/120.50s | https://streamable.com/o/2fds33
[Streamable Monitor] Broadcast: ended | ID: 2fds33 | 120.50s/120.50s | https://streamable.com/o/2fds33
```

### Normal Operation (Patreon)

```
[Patreon Autoplay] Initializing on collection page
[Patreon Autoplay] Using GM4 API
[Patreon Autoplay] Streamable listener active
[Patreon Autoplay] Autoplay toggle created
[Patreon Autoplay] Received Streamable state: {state: "ended", videoId: "2fds33", ...}
[Patreon Autoplay] Current iframe video ID: 2fds33
[Patreon Autoplay] Streamable video ended (validated), checking autoplay...
[Patreon Autoplay] Autoplay is enabled
[Patreon Autoplay] Navigating to next post: /posts/123456?collection=789
```

### Video ID Mismatch (Multi-Tab)

```
[Patreon Autoplay] Received Streamable state: {state: "ended", videoId: "abc123", ...}
[Patreon Autoplay] Current iframe video ID: xyz789
[Patreon Autoplay] Video ID mismatch - received: abc123 current: xyz789
[Patreon Autoplay] Ignoring state from different video/tab
```

### Error Cases

```
[Patreon Autoplay] Not on a collection page
[Patreon Autoplay] No Streamable iframe found on current page
[Patreon Autoplay] Next post button not found (may be at collection end)
[Streamable Monitor] Error: Failed to find video element after 10 attempts
```

## Expected Behavior Summary

| Situation                                  | Expected Behavior                              |
| ------------------------------------------ | ---------------------------------------------- |
| Video ends in active tab with autoplay ON  | Navigate to next post                          |
| Video ends in active tab with autoplay OFF | Stay on current page                           |
| Video ends in different tab                | Ignore event, stay on current page             |
| Press 'N' key                              | Navigate to next post (regardless of autoplay) |
| Last post in collection                    | Log error, no navigation                       |
| Not a collection page                      | Script inactive                                |
| No Streamable iframe                       | Script idle, no errors                         |

## Troubleshooting

### Scripts Not Communicating

-   Check `@grant` declarations in Tampermonkey
-   Verify both scripts are enabled
-   Ensure URL patterns match actual pages
-   Check if GM storage API is available: `typeof GM !== 'undefined'`

### Navigation Not Working

-   Check autoplay toggle state
-   Verify collection URL format: `/posts/*?collection=*`
-   Look for next post button in DOM
-   Check console for error messages

### Wrong Tab Navigating

-   This should be fixed with video ID tracking
-   Check console logs for video ID validation
-   Verify iframe src format matches expected pattern

## Version Information

-   Patreon Collection Autoplay: v1.2.0
-   Streamable Video Monitor: v1.0.0
-   Features: Multi-tab support, video ID tracking, GM4/GM3 compatibility
