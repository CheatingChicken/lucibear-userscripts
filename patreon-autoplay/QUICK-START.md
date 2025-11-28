# Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Install Tampermonkey

Install the Tampermonkey browser extension:

-   **Chrome**: [Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
-   **Firefox**: [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
-   **Edge**: [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

### Step 2: Install Both Scripts

Click the Tampermonkey icon → Dashboard → Utilities tab → Import from URL

**Script 1 - Patreon Autoplay** (required)

-   File: `patreon-autoplay.user.js`
-   Runs on: `patreon.com`
-   Purpose: Main autoplay functionality

**Script 2 - Streamable Monitor** (required)

-   File: `streamable-monitor.user.js`
-   Runs on: `streamable.com`
-   Purpose: Detects video playback events

### Step 3: Test It!

1. Go to a Patreon collection page: `https://www.patreon.com/posts/xxx?collection=yyy`
2. Look for the autoplay toggle (checkmark) next to the previous post button
3. Play a Streamable video to completion
4. Page should automatically navigate to next post

**That's it!** 🎉

## 💡 Usage Tips

### Toggle Autoplay

Click the checkbox next to the previous post button:

-   ☑ **Checked** = Autoplay enabled (default)
-   ☐ **Unchecked** = Autoplay disabled

Your choice is saved automatically.

### Manual Navigation

Press the **N** key to skip to next post anytime (works even with autoplay off).

### Check if It's Working

Open browser console (F12) and look for:

```
[Patreon Autoplay] Initializing on collection page
[Streamable Monitor] Initializing...
[Streamable Monitor] Video element found
[Patreon Autoplay] Streamable listener active
```

### Troubleshooting

**Not working?**

1. Check both scripts are enabled in Tampermonkey
2. Make sure you're on a collection page (URL contains `?collection=`)
3. Check console for error messages (F12)
4. See [TESTING-GUIDE.md](TESTING-GUIDE.md) for detailed debugging

## 📋 What It Does

### Automatically:

-   ✓ Detects when Streamable video ends
-   ✓ Navigates to next post in collection
-   ✓ Skips navigation at collection boundaries
-   ✓ Works across multiple open tabs (no confusion!)

### Manually:

-   ✓ Toggle autoplay on/off with checkbox
-   ✓ Use 'N' key for manual skip
-   ✓ Console logs for debugging

## 🎯 Common Scenarios

### Binge-Watching a Collection

1. Open first post in collection
2. Enable autoplay (it's on by default)
3. Start video
4. Lean back and enjoy! 🍿
    - Videos play automatically
    - Pages navigate automatically
    - Stops at end of collection

### Browsing at Your Own Pace

1. Disable autoplay checkbox
2. Watch videos at your leisure
3. Press 'N' key when ready for next post
4. Or click the next post button manually

### Multiple Tabs Open

1. Open several posts from collection in tabs
2. Play video in any tab
3. Only that tab navigates when video ends
4. Other tabs stay put (no cross-tab interference)

## 🔧 Configuration

### Change Default Autoplay State

Edit `patreon-autoplay.user.js` line 34:

```javascript
// Default to true (enabled)
const defaultState = true;

// Or change to false (disabled)
const defaultState = false;
```

### Change Keyboard Shortcut

Edit `patreon-autoplay.user.js` around line 510:

```javascript
// Current: N key
if (event.key === 'n' || event.key === 'N') {

// Change to: Space key
if (event.key === ' ') {

// Change to: Right arrow
if (event.key === 'ArrowRight') {
```

## 📚 Learn More

-   **Architecture**: See [ARCHITECTURE.md](ARCHITECTURE.md) for system design
-   **Testing**: See [TESTING-GUIDE.md](TESTING-GUIDE.md) for comprehensive testing
-   **Technical Details**: See [CROSS-SCRIPT-COMMUNICATION.md](CROSS-SCRIPT-COMMUNICATION.md)
-   **Implementation**: See [IMPLEMENTATION-SUMMARY.md](IMPLEMENTATION-SUMMARY.md)

## 🆘 Need Help?

### Check Console Logs

Press F12 → Console tab → Look for messages starting with:

-   `[Patreon Autoplay]`
-   `[Streamable Monitor]`

### Common Issues

**"Next post button not found"**

-   You're at the end of the collection
-   Or not on a collection page

**"No Streamable iframe found"**

-   Current post doesn't have a video
-   Or video hasn't loaded yet

**"Video ID mismatch"**

-   This is normal! It means another tab triggered the event
-   Current tab correctly ignored it

### Still Stuck?

Check the detailed [TESTING-GUIDE.md](TESTING-GUIDE.md) for debugging commands and scenarios.

---

**Version**: 1.2.0 / 1.0.0  
**Last Updated**: 2024  
**License**: See LICENSE file
