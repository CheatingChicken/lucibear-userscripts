// Entrypoint module for lucibear userscripts landing page effects
// Initializes fireworks, panel wiring, and explosion mode switching

import { initFireworks, spawnFirework, getActiveCount, setParticlesPerFirework } from "./fireworks.mjs";
import { initDomExplosion } from "./explosion/index.mjs";
import { initCanvasExplosion } from "./canvasExplosion.mjs";

// Module scope state
let explosionMode = "DOM"; // or 'CANVAS'

// Wait for DOM ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
} else {
    start();
}

function start() {
    initFireworks();
    const panel = document.getElementById("fw-panel");
    const nukeNowBtn = document.getElementById("fw-nuke-now");
    const modeBtn = document.getElementById("fw-mode");
    const countEl = document.getElementById("fw-count");
    const activeEl = document.getElementById("fw-active");
    const dnpPanel = document.getElementById("dnp-panel");
    const dnpToggle = document.getElementById("dnp-toggle");
    const dnpButton = document.getElementById("dnp-button");
    const dnpControls = document.querySelector(".dnp-controls");

    const inc = document.getElementById("fw-inc");
    const dec = document.getElementById("fw-dec");

    function refresh() {
        if (countEl) countEl.textContent = String(window.particlesPerFirework || 80);
        if (activeEl) activeEl.textContent = String(getActiveCount());
    }

    // Panel toggle wiring (was missing in refactor)
    const toggleBtn = document.getElementById("fw-toggle");
    if (toggleBtn && panel) {
        toggleBtn.addEventListener("click", () => panel.classList.toggle("collapsed"));
    }

    // Only show the main fw panel and the immediate trigger when on localhost
    const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
    try {
        if (!isLocal) {
            if (panel) panel.style.display = "none";
            if (nukeNowBtn) nukeNowBtn.style.display = "none";
        }
    } catch (e) {}

    // Hook inc/dec
    if (inc)
        inc.addEventListener("click", () => {
            setParticlesPerFirework((window.particlesPerFirework || 80) + 10);
            refresh();
        });
    if (dec)
        dec.addEventListener("click", () => {
            setParticlesPerFirework((window.particlesPerFirework || 80) - 10);
            refresh();
        });

    // Init both explosion implementations so they can wire to buttons
    const domExplosion = initDomExplosion();
    const canvasExplosion = initCanvasExplosion();

    // Development debug: on localhost try a small snapshot sample to surface serialization/image errors
    if (location.hostname === "localhost" && domExplosion && typeof domExplosion === "object") {
        import("./domExplosion.mjs")
            .then((m) => {
                if (m && m.debugSnapshotSample) m.debugSnapshotSample(10);
            })
            .catch(() => {});
    }

    // Mode toggle wiring
    if (modeBtn) {
        modeBtn.addEventListener("click", () => {
            explosionMode = explosionMode === "DOM" ? "CANVAS" : "DOM";
            modeBtn.textContent = `Mode: ${explosionMode}`;
        });
    }

    // Wire nuke button to selected implementation
    const nuke = document.getElementById("fw-nuke");
    if (nuke)
        nuke.addEventListener("click", (e) => {
            e.stopPropagation();
            const confirmations = nuke.dataset.confirmations ? Number(nuke.dataset.confirmations) : 0;
            if (confirmations < 1) {
                nuke.dataset.confirmations = String(confirmations + 1);
                nuke.textContent = "CONFIRM";
                nuke.style.filter = "drop-shadow(0 6px 28px rgba(255,80,80,0.6))";
                setTimeout(() => (nuke.style.filter = ""), 900);
                return;
            }
            if (confirmations < 2) {
                nuke.dataset.confirmations = String(confirmations + 1);
                nuke.textContent = "FINAL CONFIRM";
                nuke.style.filter = "drop-shadow(0 6px 28px rgba(255,80,80,0.6))";
                setTimeout(() => (nuke.style.filter = ""), 900);
                return;
            }
            nuke.textContent = "ENGAGE";
            nuke.disabled = true;
            setTimeout(() => {
                if (explosionMode === "CANVAS") canvasExplosion.trigger();
                else domExplosion.trigger();
            }, 350);
        });

    // Immediate trigger button (no confirmations)
    const nukeNow = document.getElementById("fw-nuke-now");
    if (nukeNow) {
        nukeNow.addEventListener("click", (e) => {
            e.stopPropagation();
            const clicks = Number(nukeNow.dataset.clicked || 0) + 1;
            nukeNow.dataset.clicked = String(clicks);
            if (clicks === 1) {
                // first click: trigger explosion
                nukeNow.textContent = "💥 (again to reload)";
                if (explosionMode === "CANVAS") canvasExplosion.trigger();
                else domExplosion.trigger();
                return;
            }
            // second click: reload for convenient debugging
            location.reload();
        });
    }

    // Wire the new Do-Not-Press toggled panel (always present)
    if (dnpToggle && dnpPanel) {
        // hide the controls wrapper initially until the toggle is clicked
        try {
            if (dnpControls) dnpControls.style.display = "none";
        } catch (e) {}
        dnpToggle.addEventListener("click", (e) => {
            e.stopPropagation();
            try {
                // reveal the controls and remove the toggle so it can't be toggled again
                dnpPanel.classList.remove("collapsed");
                if (dnpControls) dnpControls.style.display = "flex";
                // remove the small toggle from the DOM
                dnpToggle.remove();
            } catch (err) {}
        });
    }

    if (dnpButton) {
        // possible confirmation messages
        const msgs = [
            "do not press",
            "seriously, do not press",
            "please don't",
            "definitely do not press",
            "absolutely do NOT press",
        ];
        // track rounds required and current round
        const rounds = 2 + Math.floor(Math.random() * 2); // 2 or 3 rounds
        let round = 0;
        let pressed = false;

        function nextLabel() {
            return msgs[Math.floor(Math.random() * msgs.length)];
        }

        dnpButton.addEventListener("click", (e) => {
            e.stopPropagation();
            if (pressed) return;
            round++;
            if (round < rounds) {
                dnpButton.textContent = nextLabel();
                // quick visual feedback
                dnpButton.style.transform = "scale(0.96)";
                setTimeout(() => (dnpButton.style.transform = ""), 220);
                return;
            }
            // final engagement
            dnpButton.textContent = "";
            pressed = true;
            // visually pressed state: inset shadow and subtle translate
            dnpButton.style.boxShadow = "inset 0 6px 16px rgba(0,0,0,0.6)";
            dnpButton.style.transform = "translateY(2px)";
            dnpButton.setAttribute("aria-pressed", "true");
            dnpButton.disabled = true;
            // change cursor to default to indicate no further interaction
            dnpButton.style.cursor = "default";
            // trigger the domExplosion after a random delay between 1 and 10 seconds
            try {
                const delay = 1000 + Math.floor(Math.random() * 9000);
                setTimeout(() => {
                    try {
                        domExplosion && domExplosion.trigger && domExplosion.trigger();
                    } catch (e) {}
                }, delay);
            } catch (e) {}
        });
    }

    // Reset wiring (reload page)
    const reset = document.getElementById("fw-reset");
    if (reset)
        reset.addEventListener("click", (e) => {
            e.stopPropagation();
            location.reload();
        });

    // Expose a simple heartbeat to update active count
    setInterval(() => {
        if (activeEl) activeEl.textContent = String(getActiveCount());
    }, 250);
}
