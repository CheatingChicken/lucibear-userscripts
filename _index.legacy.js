// // This is a legacy copy of the index.js file. It has been renamed to _index.legacy.js.
// // Fireworks and panel wiring extracted from index.html
// (function () {
//     const canvas = document.getElementById("fw");
//     if (!canvas) return;
//     const ctx = canvas.getContext("2d");
//     let w = (canvas.width = innerWidth);
//     let h = (canvas.height = innerHeight);
//     const rand = (a, b) => Math.random() * (b - a) + a;
//     window.addEventListener("resize", () => {
//         w = canvas.width = innerWidth;
//         h = canvas.height = innerHeight;
//     });

//     // Fireworks and panel wiring extracted from index.html
//     (function () {
//         const canvas = document.getElementById('fw');
//         if (!canvas) return;
//         const ctx = canvas.getContext('2d');
//         let w = (canvas.width = innerWidth);
//         let h = (canvas.height = innerHeight);
//         const rand = (a, b) => Math.random() * (b - a) + a;

//         window.addEventListener('resize', () => {
//             w = canvas.width = innerWidth;
//             h = canvas.height = innerHeight;
//         });

//         window.particlesPerFirework = window.particlesPerFirework || 80;

//         class Particle {
//             constructor(x, y, color, velocity) {
//                 this.x = x; this.y = y; this.color = color; this.v = velocity; this.alpha = 1; this.s = rand(1, 3);
//             }
//             step(dt) {
//                 this.x += this.v.x * dt;
//                 this.y += this.v.y * dt + 0.02 * dt * dt;
//                 this.v.y += 0.02 * dt;
//                 this.alpha *= 0.995; this.s *= 0.999;
//             }
//             draw() {
//                 ctx.globalAlpha = this.alpha;
//                 ctx.fillStyle = this.color;
//                 ctx.beginPath(); ctx.arc(this.x, this.y, this.s, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
//             }
//         }

//         let particles = [];
//         function spawnFirework(x, y) {
//             const hue = Math.floor(rand(0, 360));
//             const count = Math.max(8, Math.min(400, Math.floor(window.particlesPerFirework || 80)));
//             for (let i = 0; i < count; i++) {
//                 const speed = rand(0.6, 4.2);
//                 const angle = rand(0, Math.PI * 2);
//                 const v = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
//                 const color = `hsl(${hue} ${rand(70, 95)}% ${rand(50, 65)}% / 1)`;
//                 particles.push(new Particle(x, y, color, v));
//             }
//         }

//         setInterval(() => spawnFirework(rand(w * 0.15, w * 0.85), rand(h * 0.1, h * 0.6)), 2200 + Math.random() * 1800);

//         document.addEventListener('click', (e) => {
//             try {
//                 const el = e.target;
//                 if (el.closest && el.closest('#fw-panel')) { console.log('fireworks: click ignored on UI element', el); return; }
//                 spawnFirework(e.clientX, e.clientY);
//             } catch (err) { console.error('fireworks click error', err); }
//         }, { passive: true });

//         let last = performance.now();
//         function frame(t) {
//             const dt = (t - last) || 16; last = t;
//             ctx.clearRect(0, 0, w, h);
//             ctx.fillStyle = 'rgba(10,15,20,0.12)'; ctx.fillRect(0, 0, w, h);
//             particles.forEach(p => { p.step(dt * 0.06); p.draw(); });

//             const margin = 200;
//             const minX = -margin, minY = -margin, maxX = w + margin, maxY = h + margin;
//             particles = particles.filter(p => p.alpha > 0.02 && p.s > 0.2 && p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY);
//             const activeEl = document.getElementById('fw-active'); if (activeEl) activeEl.textContent = String(particles.length);
//             requestAnimationFrame(frame);
//         }
//         requestAnimationFrame(frame);

//         (function panelWiring() {
//             const panel = document.getElementById('fw-panel');
//             const toggle = document.getElementById('fw-toggle');
//             const inc = document.getElementById('fw-inc');
//             const dec = document.getElementById('fw-dec');
//             const count = document.getElementById('fw-count');
//             function setCount(n) { window.particlesPerFirework = Math.max(8, Math.min(400, n)); if (count) count.textContent = window.particlesPerFirework; }
//             setCount(window.particlesPerFirework || 80);
//             if (toggle) toggle.addEventListener('click', () => panel.classList.toggle('collapsed'));
//             if (inc) inc.addEventListener('click', () => setCount((window.particlesPerFirework || 80) + 10));
//             if (dec) dec.addEventListener('click', () => setCount((window.particlesPerFirework || 80) - 10));
//         })();
//     })();

//     // Self-destruct sequence
//     (function () {
//         function log(...args) { try { console.log('[self-destruct]', ...args); } catch (e) {} }

//         function splitTextNodes(root) {
//             try {
//                 const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
//                     acceptNode(node) {
//                         if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
//                         const p = node.parentNode; if (!p) return NodeFilter.FILTER_REJECT;
//                         if (p.closest && p.closest('#fw-panel')) return NodeFilter.FILTER_REJECT;
//                         if (p.classList && p.classList.contains('phy-clone')) return NodeFilter.FILTER_REJECT;
//                         return NodeFilter.FILTER_ACCEPT;
//                     }
//                 });
//                 const nodes = []; let n;
//                 while ((n = walker.nextNode())) nodes.push(n);
//                 nodes.forEach(textNode => {
//                     const parent = textNode.parentNode; if (!parent) return;
//                     const txt = textNode.nodeValue; const frag = document.createDocumentFragment();
//                     for (let i = 0; i < txt.length; i++) { const span = document.createElement('span'); span.textContent = txt[i]; span.style.whiteSpace = 'pre'; frag.appendChild(span); }
//                     parent.replaceChild(frag, textNode);
//                 });
//             } catch (e) { log('splitTextNodes failed', e); }
//         }

//         function renderElementToDataURL(original, options = { hideChildren: false }) {
//             return new Promise(resolve => {
//                 try {
//                     const rect = original.getBoundingClientRect(); const w = Math.max(1, Math.ceil(rect.width)); const h = Math.max(1, Math.ceil(rect.height));
//                     const clone = original.cloneNode(true);
//                     if (options.hideChildren) Array.from(clone.querySelectorAll('*')).forEach(c => (c.style.display = 'none'));
//                     try { const cs = getComputedStyle(original); clone.style.setProperty('background', cs.background || cs.backgroundColor || 'transparent'); clone.style.setProperty('color', cs.color || 'inherit'); clone.style.setProperty('font', cs.font || 'inherit'); } catch (e) {}
//                     const xmlns = 'http://www.w3.org/2000/svg';
//                     const svg = `<svg xmlns='${xmlns}' width='${w}' height='${h}'><foreignObject width='100%' height='100%'>${new XMLSerializer().serializeToString(clone)}</foreignObject></svg>`;
//                     const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }); const url = URL.createObjectURL(blob);
//                     const img = new Image(); img.onload = () => { try { const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0); const dataURL = canvas.toDataURL('image/png'); URL.revokeObjectURL(url); resolve({ dataURL, rect, w, h }); } catch (err) { URL.revokeObjectURL(url); resolve(null); } };
//                     img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
//                     img.src = url;
//                 } catch (err) { resolve(null); }
//             });
//         }

//         async function initSelfDestruct() {
//             const nukeBtn = document.getElementById('fw-nuke'); if (!nukeBtn) { log('fw-nuke not found'); return; }
//             log('init');
//             let confirmations = 0;
//             function ominousPrompt() { confirmations++; nukeBtn.textContent = confirmations === 1 ? 'CONFIRM' : 'FINAL CONFIRM'; nukeBtn.style.filter = 'drop-shadow(0 6px 28px rgba(255,80,80,0.6))'; setTimeout(() => (nukeBtn.style.filter = ''), 900); }

//             async function explodeAll() {
//                 log('explodeAll'); splitTextNodes(document.body);
//                 const elems = Array.from(document.body.querySelectorAll('*:not(.phy-clone):not(#fw-panel):not(#fw):not(script):not(style)')).filter(el => !el.closest || !el.closest('#fw-panel'));
//                 const centerX = innerWidth / 2, centerY = innerHeight / 2; const clones = [];
//                 const jobs = elems.map(el => { const rect = el.getBoundingClientRect(); if (rect.width < 4 || rect.height < 4) return Promise.resolve(null); return renderElementToDataURL(el, { hideChildren: true }).then(res => ({ el, rect, res })); });
//                 const results = await Promise.all(jobs);
//                 results.forEach(r => { if (!r || !r.res) return; const { el, rect, res } = r; const wrap = document.createElement('div'); wrap.className = 'phy-clone'; wrap.style.left = rect.left + 'px'; wrap.style.top = rect.top + 'px'; wrap.style.width = rect.width + 'px'; wrap.style.height = rect.height + 'px'; wrap.style.display = 'block'; wrap.style.overflow = 'visible'; const img = document.createElement('img'); img.src = res.dataURL; img.style.width = '100%'; img.style.height = '100%'; img.style.display = 'block'; wrap.appendChild(img); document.body.appendChild(wrap); const cx = rect.left + rect.width/2; const cy = rect.top + rect.height/2; const dx = cx - centerX; const dy = cy - centerY; const dist = Math.sqrt(dx*dx + dy*dy) + 1; const push = (200 + Math.random()*400)/dist; const baseV = { x: (Math.random()-0.5)*1.4 + (dx/dist)*push, y: (Math.random()-0.5)*1.4 + (dy/dist)*push }; clones.push({ el: wrap, rect, pos: { x: rect.left, y: rect.top }, v: baseV, ang: Math.random()*360, angV: (Math.random()-0.5)*12 }); try { el.style.visibility = 'hidden'; } catch (e) {} });

//                 const dura = 4000; const start = performance.now(); function step(now) { const t = now - start; const progress = Math.min(1, t / dura); clones.forEach(c => { c.v.y += 0.6; c.v.x *= 0.995; c.v.y *= 0.995; c.pos.x += c.v.x; c.pos.y += c.v.y; c.ang += c.angV; const leftBound = 0, topBound = 0, rightBound = innerWidth - c.rect.width, bottomBound = innerHeight - c.rect.height; if (c.pos.x < leftBound) { c.pos.x = leftBound; c.v.x = -c.v.x * 0.6; c.angV += (Math.random()-0.5)*8; } else if (c.pos.x > rightBound) { c.pos.x = rightBound; c.v.x = -c.v.x * 0.6; c.angV += (Math.random()-0.5)*8; } if (c.pos.y < topBound) { c.pos.y = topBound; c.v.y = -c.v.y * 0.6; c.angV += (Math.random()-0.5)*8; } else if (c.pos.y > bottomBound) { c.pos.y = bottomBound; c.v.y = -c.v.y * 0.6; c.angV += (Math.random()-0.5)*8; } const dx = c.pos.x - c.rect.left, dy = c.pos.y - c.rect.top; c.el.style.transform = `translate(${dx}px, ${dy}px) rotate(${c.ang}deg)`; c.el.style.opacity = '1'; }); if (progress < 1) requestAnimationFrame(step); }
//                 requestAnimationFrame(step); log('explode scheduled', clones.length);
//             }

//             const nukeBtn = document.getElementById('fw-nuke');
//             nukeBtn.addEventListener('click', (e) => { e.stopPropagation(); if (confirmations < 2) { ominousPrompt(); return; } nukeBtn.textContent = 'ENGAGE'; nukeBtn.disabled = true; setTimeout(() => explodeAll(), 350); });
//             const resetBtn = document.getElementById('fw-reset'); if (resetBtn) resetBtn.addEventListener('click', (e) => { e.stopPropagation(); location.reload(); });
//         }

//         if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSelfDestruct);
//         else initSelfDestruct();
//     })();
//             const t = now - start;
//             const progress = Math.min(1, t / dura);
//             clones.forEach((c) => {
//                 // simple physics integration
//                 // gravity
//                 c.v.y += 0.6;
//                 // air drag
//                 c.v.x *= 0.995;
//                 c.v.y *= 0.995;

//                 // update position
//                 c.pos.x += c.v.x;
//                 c.pos.y += c.v.y;

//                 // rotation
//                 c.ang += c.angV;

//                 // screen border collision
//                 const leftBound = 0;
//                 const topBound = 0;
//                 const rightBound = innerWidth - c.rect.width;
//                 const bottomBound = innerHeight - c.rect.height;
//                 let collided = false;
//                 if (c.pos.x < leftBound) {
//                     c.pos.x = leftBound;
//                     c.v.x = -c.v.x * 0.6; // bounce with damping
//                     c.angV += (Math.random() - 0.5) * 8;
//                     collided = true;
//                 } else if (c.pos.x > rightBound) {
//                     c.pos.x = rightBound;
//                     c.v.x = -c.v.x * 0.6;
//                     c.angV += (Math.random() - 0.5) * 8;
//                     collided = true;
//                 }
//                 if (c.pos.y < topBound) {
//                     c.pos.y = topBound;
//                     c.v.y = -c.v.y * 0.6;
//                     c.angV += (Math.random() - 0.5) * 8;
//                     collided = true;
//                 } else if (c.pos.y > bottomBound) {
//                     c.pos.y = bottomBound;
//                     c.v.y = -c.v.y * 0.6;
//                     c.angV += (Math.random() - 0.5) * 8;
//                     collided = true;
//                 }

//                 const dx = c.pos.x - c.rect.left;
//                 const dy = c.pos.y - c.rect.top;
//                 c.el.style.transform = `translate(${dx}px, ${dy}px) rotate(${c.ang}deg)`;
//                 // keep exploded UI fully opaque while they fly
//                 c.el.style.opacity = "1";
//             });
//             if (progress < 1) requestAnimationFrame(step);
//             else {
//                 // end of animation — intentionally leave clones in-place and keep originals hidden
//                 // This leaves the UI in pieces on-screen as requested.
//             }
//         }
//         requestAnimationFrame(step);
//     }

//     nukeBtn.addEventListener("click", (e) => {
//         e.stopPropagation();
//         if (confirmations < 2) {
//             ominousPrompt(() => {});
//             return;
//         }
//         // final: trigger explosion
//         nukeBtn.textContent = "ENGAGE";
//         nukeBtn.disabled = true;
//         setTimeout(() => explodeAll(), 350);
//     });

//     // Reset button: reload page to restore original DOM
//     const resetBtn = document.getElementById("fw-reset");
//     if (resetBtn)
//         resetBtn.addEventListener("click", (e) => {
//             e.stopPropagation();
//             location.reload();
//         });
// })();
