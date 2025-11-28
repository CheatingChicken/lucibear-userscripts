# System Architecture - Patreon Autoplay

## Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                  │
│                                                                  │
│  ┌────────────────────────┐      ┌─────────────────────────┐  │
│  │   Patreon Tab          │      │   Streamable Tab        │  │
│  │   (patreon.com)        │      │   (streamable.com)      │  │
│  │                        │      │                         │  │
│  │  ┌──────────────────┐ │      │  ┌──────────────────┐  │  │
│  │  │ Collection Page  │ │      │  │ Video Player     │  │  │
│  │  │                  │ │      │  │                  │  │  │
│  │  │ ┌──────────────┐ │ │      │  │ ┌──────────────┐ │  │  │
│  │  │ │ [<] [Toggle] │ │ │      │  │ │   <video>    │ │  │  │
│  │  │ │ Autoplay: ☑  │ │ │      │  │ │   element    │ │  │  │
│  │  │ └──────────────┘ │ │      │  │ └──────┬───────┘ │  │  │
│  │  │                  │ │      │  │        │         │  │  │
│  │  │ ┌──────────────┐ │ │      │  │        │         │  │  │
│  │  │ │   iframe     │ │ │      │  └────────┼─────────┘  │  │
│  │  │ │ ────────────►│ │ │      │           │            │  │
│  │  │ │ (Streamable) │ │ │      │           │            │  │
│  │  │ └──────────────┘ │ │      │           │            │  │
│  │  │                  │ │      │           │            │  │
│  │  └──────────────────┘ │      │           │            │  │
│  │           │            │      │           │            │  │
│  │           │            │      │           │            │  │
│  │  ┌────────▼─────────┐ │      │  ┌────────▼─────────┐ │  │
│  │  │ Patreon Autoplay │ │      │  │ Streamable       │ │  │
│  │  │    Userscript    │ │      │  │    Monitor       │ │  │
│  │  │    (v1.2.0)      │ │      │  │  Userscript      │ │  │
│  │  │                  │ │      │  │  (v1.0.0)        │ │  │
│  │  │ • Validates ID   │ │      │  │ • Detects events │ │  │
│  │  │ • Navigates      │ │      │  │ • Extracts ID    │ │  │
│  │  │ • Toggle UI      │ │      │  │ • Broadcasts     │ │  │
│  │  └────────┬─────────┘ │      │  └────────┬─────────┘ │  │
│  │           │            │      │           │            │  │
│  └───────────┼────────────┘      └───────────┼────────────┘  │
│              │                               │                │
│              │   ┌───────────────────────┐   │                │
│              │   │  Tampermonkey API     │   │                │
│              │   │  GM Storage           │   │                │
│              └───►                       ◄───┘                │
│                  │  Key: streamable-     │                    │
│                  │       video-state     │                    │
│                  │                       │                    │
│                  │  Value: {             │                    │
│                  │    state: "ended",    │                    │
│                  │    videoId: "2fds33", │                    │
│                  │    timestamp: ...,    │                    │
│                  │    url: ...,          │                    │
│                  │    duration: 120.5,   │                    │
│                  │    currentTime: 120.5 │                    │
│                  │  }                    │                    │
│                  └───────────────────────┘                    │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              localStorage                             │   │
│  │                                                       │   │
│  │  Key: patreon-autoplay-enabled                       │   │
│  │  Value: "true" | "false"                             │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Video Playback Event

```
Streamable Video
    │
    │ (ended event)
    ▼
streamable-monitor.user.js
    │
    │ getVideoId()
    │ → Extract "2fds33" from URL
    │
    │ broadcastVideoState()
    ▼
GM.setValue("streamable-video-state", {
    state: "ended",
    videoId: "2fds33",
    timestamp: 1234567890,
    url: "https://streamable.com/o/2fds33",
    duration: 120.5,
    currentTime: 120.5
})
```

### 2. Cross-Script Communication

```
GM Storage (Shared)
    │
    │ (value change event)
    ▼
GM.addValueChangeListener()
    │
    │ (in patreon-autoplay.user.js)
    ▼
handleStateChange()
    │
    │ Parse JSON data
    ▼
validateVideoState()
    │
    │ getCurrentStreamableVideoId()
    │ → Extract ID from iframe src
    │
    │ Compare: received.videoId === current.videoId
    │
    ├─► Match: continue
    │
    └─► Mismatch: ignore (different tab)
```

### 3. Navigation Decision

```
validateVideoState()
    │
    │ (if valid)
    ▼
handleVideoEnded()
    │
    │ Check localStorage
    │ → patreon-autoplay-enabled
    │
    ├─► "true": proceed
    │
    └─► "false": abort
        │
        ▼
    findNextPostButton()
        │
        │ Query: [data-tag="next-post"]
        │
        ├─► Found <a>: navigate to href
        │
        ├─► Found <button disabled>: log end of collection
        │
        └─► Not found: log error
```

## Multi-Tab Scenario

```
Tab A: /posts/123?collection=789
Iframe: streamable.com/o/VIDEO_X
    │
    │ Video X ends
    ▼
GM Storage ← {videoId: "VIDEO_X", state: "ended"}
    │
    ├───────────────────┬─────────────────┐
    │                   │                 │
    ▼                   ▼                 ▼
Tab A Listener    Tab B Listener    Tab C Listener
(VIDEO_X)         (VIDEO_Y)         (VIDEO_X)
    │                   │                 │
    ├─► Validate        ├─► Validate     ├─► Validate
    │   VIDEO_X         │   VIDEO_Y      │   VIDEO_X
    │   === VIDEO_X     │   !== VIDEO_X  │   === VIDEO_X
    │   ✓ MATCH         │   ✗ MISMATCH   │   ✓ MATCH
    │                   │                 │
    ▼                   ▼                 ▼
Navigate to      Stay on current   Navigate to
next post        page (ignored)    next post
```

## Component Responsibilities

### Patreon Autoplay Script

-   ✓ Detect collection pages (`/posts/*?collection=*`)
-   ✓ Create and manage toggle UI
-   ✓ Store/retrieve autoplay preference
-   ✓ Listen for GM storage changes
-   ✓ Validate video ID against current iframe
-   ✓ Navigate to next post when appropriate
-   ✓ Handle keyboard shortcuts ('N' key)
-   ✓ Log all operations for debugging

### Streamable Monitor Script

-   ✓ Find `<video>` element on page
-   ✓ Attach event listeners (ended, play, pause)
-   ✓ Extract video ID from URL
-   ✓ Capture video metadata (duration, currentTime)
-   ✓ Broadcast state changes to GM storage
-   ✓ Log all operations for debugging

### GM Storage API

-   ✓ Provide cross-domain shared storage
-   ✓ Notify listeners of value changes
-   ✓ Support both GM3 and GM4 APIs
-   ✓ Persist across page reloads

### localStorage

-   ✓ Store user preference (autoplay on/off)
-   ✓ Survive browser restarts
-   ✓ Domain-specific (patreon.com only)

## Security & Privacy

### Same-Origin Policy Bypass

-   ✗ Cannot access iframe content directly (blocked)
-   ✓ Use GM storage for legitimate cross-script communication
-   ✓ Only shares video playback state (no personal data)

### Data Shared

```javascript
{
  state: "ended",           // Public: video state
  videoId: "2fds33",        // Public: video identifier
  timestamp: 1234567890,    // Public: event time
  url: "https://...",       // Public: current page
  duration: 120.5,          // Public: video length
  currentTime: 120.5        // Public: playback position
}
```

**No sensitive data is transmitted.**

## Error Handling

```
Every Operation
    │
    ├─► try {
    │       // Operation
    │   }
    │
    └─► catch (error) {
            console.log("[Script] Error:", error);
            // Silent failure, no user alert
        }
```

All errors are:

-   ✓ Caught and logged
-   ✓ Non-blocking
-   ✓ Silent to user (console only)
-   ✓ Include context for debugging

## Performance

### Polling Strategy

```javascript
// Video element detection
MAX_ATTEMPTS = 10
POLL_INTERVAL = 500ms
TIMEOUT = 5 seconds

// Only runs once at page load
// Stops when video found or timeout
```

### Event-Driven Updates

```javascript
// No polling after initialization
// All updates triggered by:
//   - Video events (ended, play, pause)
//   - GM storage changes (instant)
//   - User interactions (toggle, keyboard)
```

**Result**: Minimal CPU/battery impact
