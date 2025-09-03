// PhysicsElement module
// Simulates a rectangle as four corner points with linear and angular momentum.
// Exports PhysicsElement class with constructor(el, rect, topLeftPos, baseV)
// Methods: step(dt) and render()

function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
}

function perp(v) {
    return { x: -v.y, y: v.x };
}

// normalize angle to range (-PI, PI]
function normalizeAngle(a) {
    const TAU = Math.PI * 2;
    a = ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
    return a;
}

export class PhysicsElement {
    /**
     * @param {HTMLElement} el
     * @param {{left:number,top:number,width:number,height:number}} rect - DOM rect
     * @param {{x:number,y:number}} topLeftPos - page coordinates of top-left
     * @param {{x:number,y:number}} baseV - initial linear velocity
     */
    constructor(el, rect, topLeftPos, baseV) {
        this.el = el;
        this.w = Math.max(1, rect.width);
        this.h = Math.max(1, rect.height);
        // store center position for physics (convert from top-left)
        this.pos = { x: topLeftPos.x + this.w / 2, y: topLeftPos.y + this.h / 2 };
        // base linear velocity with a small randomized jitter so motion looks like it just started
        const bvx = baseV && typeof baseV.x === "number" ? baseV.x : 0;
        const bvy = baseV && typeof baseV.y === "number" ? baseV.y : 0;
        const noJitter = baseV && baseV.noJitter;
        const frozenFlag = baseV && baseV.frozen;
        const jitter = noJitter ? 0 : Math.min(40, Math.max(6, (this.w + this.h) * 0.05));
        this.v = {
            x: bvx + (noJitter ? 0 : (Math.random() - 0.5) * jitter),
            y: bvy + (noJitter ? 0 : (Math.random() - 0.5) * jitter),
        };
        // frozen: when true, the element is not simulated until unfrozen
        this.frozen = !!frozenFlag;
        // angle in radians
        // start without rotating the element so it looks like it just began moving from its DOM pose
        this.ang = 0;
        // angular velocity in radians per simulation unit
        // angular velocity in radians per simulation unit (randomized so pieces 'topple' naturally)
        // allow a wider but still safe initial angV
        this.angV = (Math.random() - 0.5) * 0.18; // ~±10 deg/sec in radians
        this.alpha = 1;

        // mass proportional to area (small scale factor to keep numbers reasonable)
        this.mass = Math.max(0.05, this.w * this.h * 0.0008);
        // moment of inertia for rectangle about center: (1/12) * m * (w^2 + h^2)
        this.inertia = Math.max((1 / 12) * this.mass * (this.w * this.w + this.h * this.h), 1e-4);

        // damping and limits
        this.linearDamping = 0.995;
        this.angularDamping = 0.92;
        this.maxLinear = 5000;
        this.maxAngV = 6.28; // ~360deg in radians
        this.settled = false;

        // dragging state
        this.dragging = false;
        // repair hint element and timeout (created after a short delay while dragging)
        this._hintEl = null;
        this._hintTimeout = null;
        // enable pointer interactions on the element and add handlers
        try {
            // prefer touch-action none to avoid pan gestures
            if (!this.el.style.touchAction) this.el.style.touchAction = "none";
        } catch (e) {}

        // Helper: update DOM immediately while dragging
        const doRenderImmediate = () => {
            const left = this.pos.x - this.w / 2;
            const top = this.pos.y - this.h / 2;
            try {
                this.el.style.left = `${left}px`;
                this.el.style.top = `${top}px`;
                this.el.style.transform = `rotate(${(this.ang * 180) / Math.PI}deg)`;
            } catch (e) {}
        };

        // rotation while dragging: rotate toward 0 radians at 90deg/s (pi/2 rad/s)
        const rotateSpeed = Math.PI / 2; // rad/s
        let _lastRotTs = null;
        const rotateStep = (ts) => {
            if (!this.dragging) {
                _lastRotTs = null;
                return;
            }
            if (!_lastRotTs) _lastRotTs = ts;
            const dt = (ts - _lastRotTs) / 1000;
            _lastRotTs = ts;
            // shortest signed difference from current angle to 0 (normalize to [-PI, PI])
            const diff = normalizeAngle(0 - this.ang);
            const maxDelta = rotateSpeed * dt;
            if (Math.abs(diff) <= maxDelta) {
                this.ang = 0;
            } else {
                this.ang += Math.sign(diff) * maxDelta;
            }
            doRenderImmediate();
            try {
                this._rotRAF = requestAnimationFrame(rotateStep);
            } catch (e) {}
            // keep angle in canonical range to avoid large wrap jumps
            try {
                this.ang = normalizeAngle(this.ang);
            } catch (e) {}
            // rotateStep only handles rotation; repair hint is created on pointerdown after a delay to avoid being too obvious
        };

        const onPointerDown = (ev) => {
            // only primary button
            if (typeof ev.button === "number" && ev.button !== 0) return;
            ev.preventDefault();
            try {
                this.el.setPointerCapture && this.el.setPointerCapture(ev.pointerId);
            } catch (e) {}
            // set grabbing cursor and disable text selection while dragging
            try {
                this.el.style.cursor = "grabbing";
                this.el.style.userSelect = "none";
                try {
                    this.el.classList && this.el.classList.add("dragging");
                } catch (e) {}
            } catch (e) {}
            this.dragging = true;
            // if element was settled, clear settled state so it will simulate after release
            if (this.settled) this.settled = false;
            // reset drag movement tracking
            this._didMove = false;
            this._dragStart = { x: ev.pageX, y: ev.pageY, t: performance.now() };
            // pause simulation while dragging
            this.frozen = true;
            // compute pointer offset so element position under cursor stays consistent
            const left = this.pos.x - this.w / 2;
            const top = this.pos.y - this.h / 2;
            this._dragOffset = { x: ev.pageX - left, y: ev.pageY - top };
            // track recent moves to estimate release velocity
            this._lastMoves = [{ t: performance.now(), x: ev.pageX, y: ev.pageY }];
            // start rotation RAF to rotate toward 0 while dragging
            try {
                this._rotRAF = requestAnimationFrame(rotateStep);
            } catch (e) {}
            // schedule creation of repair hint after a short delay so it isn't obvious immediately
            try {
                // only schedule the repair hint if repair is allowed for this piece
                if (this._origRect && this._repairAllowed) {
                    // clear any existing timeout just in case
                    if (this._hintTimeout) clearTimeout(this._hintTimeout);
                    this._hintTimeout = setTimeout(() => {
                        try {
                            if (this._hintEl) return; // already created
                            this._hintEl = document.createElement("div");
                            this._hintEl.className = "repair-hint";
                            this._hintEl.style.left = this._origRect.left + "px";
                            this._hintEl.style.top = this._origRect.top + "px";
                            this._hintEl.style.width = this._origRect.width + "px";
                            this._hintEl.style.height = this._origRect.height + "px";
                            // start slightly transparent; CSS controls transitions if any
                            this._hintEl.style.opacity = "0.45";
                            document.body.appendChild(this._hintEl);
                        } catch (e) {}
                    }, 2000);
                }
            } catch (e) {}
        };

        const onPointerMove = (ev) => {
            if (!this.dragging) return;
            ev.preventDefault();
            const px = ev.pageX - this._dragOffset.x + this.w / 2;
            const py = ev.pageY - this._dragOffset.y + this.h / 2;
            this.pos.x = px;
            this.pos.y = py;
            // if movement since pointerdown exceeds a small threshold, mark as moved
            try {
                const dx = Math.abs(ev.pageX - ((this._dragStart && this._dragStart.x) || 0));
                const dy = Math.abs(ev.pageY - ((this._dragStart && this._dragStart.y) || 0));
                if (!this._didMove && (dx > 4 || dy > 4)) this._didMove = true;
            } catch (e) {}
            // record move and trim to last ~0.6s window to keep history bounded
            const now = performance.now();
            this._lastMoves.push({ t: now, x: ev.pageX, y: ev.pageY });
            const windowMs = 500; // consider moves in last 0.5s
            while (this._lastMoves.length > 0 && now - this._lastMoves[0].t > windowMs) this._lastMoves.shift();
            doRenderImmediate();
        };

        const onPointerUp = (ev) => {
            if (!this.dragging) return;
            ev.preventDefault();
            try {
                this.el.releasePointerCapture && this.el.releasePointerCapture(ev.pointerId);
            } catch (e) {}
            this.dragging = false;
            // compute approximate velocity from the last two recorded moves only (pixels/sec)
            const arr = this._lastMoves || [];
            if (arr.length >= 2) {
                const a = arr[arr.length - 2];
                const b = arr[arr.length - 1];
                const dt = (b.t - a.t) / 1000;
                if (dt > 0) {
                    const vx = (b.x - a.x) / dt;
                    const vy = (b.y - a.y) / dt;
                    const scale = 0.02;
                    this.v.x = clamp(vx * scale, -this.maxLinear, this.maxLinear);
                    this.v.y = clamp(vy * scale, -this.maxLinear, this.maxLinear);
                }
            }
            this._lastMoves = null;
            // briefly suppress click events resulting from this drag
            this._suppressClickUntil = performance.now() + 120;
            // resume physics simulation
            this.frozen = false;
            // restore cursor and user-select
            try {
                this.el.style.cursor = "grab";
                this.el.style.userSelect = "";
                try {
                    this.el.classList && this.el.classList.remove("dragging");
                } catch (e) {}
            } catch (e) {}
            // check repair proximity and possibly repair
            try {
                if (this._origCenter && this._onRepair && this._repairAllowed) {
                    const dx = this.pos.x - this._origCenter.x;
                    const dy = this.pos.y - this._origCenter.y;
                    const d = Math.sqrt(dx * dx + dy * dy);
                    if (d <= (this._repairThreshold || 20)) {
                        try {
                            this._onRepair && this._onRepair();
                        } catch (e) {}
                    }
                }
            } catch (e) {}
            // remove hint overlay
            try {
                // clear any pending timeout and remove hint element if present
                if (this._hintTimeout) {
                    clearTimeout(this._hintTimeout);
                    this._hintTimeout = null;
                }
                +this._hintEl && this._hintEl.remove();
                this._hintEl = null;
            } catch (e) {}
            // cancel rotation RAF
            try {
                this._rotRAF && cancelAnimationFrame(this._rotRAF);
                this._rotRAF = null;
            } catch (e) {}
        };

        try {
            this.el.addEventListener("pointerdown", onPointerDown);
            this.el.addEventListener("pointermove", onPointerMove);
            this.el.addEventListener("pointerup", onPointerUp);
            this.el.addEventListener("pointercancel", onPointerUp);
            // block click events when a drag occurred to prevent navigation/click-through
            const onClick = (ev) => {
                try {
                    const now = performance.now();
                    if (this._didMove || (this._suppressClickUntil && now < this._suppressClickUntil)) {
                        ev.preventDefault();
                        ev.stopPropagation();
                        return false;
                    }
                } catch (e) {}
                return true;
            };
            this.el.addEventListener("click", onClick, true);
        } catch (e) {
            // ignore if element doesn't support pointer events for some reason
        }
    }

    // compute the 4 corners (array of {x,y}) for given center pos and angle
    getCorners(ang = this.ang, center = this.pos) {
        const hw = this.w / 2;
        const hh = this.h / 2;
        const c = Math.cos(ang);
        const s = Math.sin(ang);
        const pts = [
            { x: -hw, y: -hh },
            { x: hw, y: -hh },
            { x: hw, y: hh },
            { x: -hw, y: hh },
        ];
        return pts.map((p) => ({ x: center.x + p.x * c - p.y * s, y: center.y + p.x * s + p.y * c }));
    }

    // step the physics forward by dt (same dt unit used by the animation harness)
    step(dt) {
        // if frozen, skip all simulation (but render still positions the DOM element at its stored pos)
        if (this.frozen) return;
        // if already settled on the ground, skip physics
        if (this.settled) return;
        // apply constant gravity (positive Y down)
        const gravity = 1.2;
        this.v.y += gravity * dt;

        // integrate predicted motion
        const predPos = { x: this.pos.x + this.v.x * dt, y: this.pos.y + this.v.y * dt };
        const predAng = this.ang + this.angV * dt;

        // check corners against viewport after predicted step
        const corners = this.getCorners(predAng, predPos);

        // collect individual corner contacts (per-corner collision handling)
        const contacts = [];
        for (const p of corners) {
            if (p.x < 0) contacts.push({ point: p, normal: { x: 1, y: 0 }, pen: -p.x });
            else if (p.x > innerWidth) contacts.push({ point: p, normal: { x: -1, y: 0 }, pen: p.x - innerWidth });
            if (p.y < 0) contacts.push({ point: p, normal: { x: 0, y: 1 }, pen: -p.y });
            else if (p.y > innerHeight) contacts.push({ point: p, normal: { x: 0, y: -1 }, pen: p.y - innerHeight });
        }

        const e = 0.6; // restitution
        const friction = 0.22;

        // helper to apply impulse at a contact point (or average contact)
        const applyImpulseAt = (contactPoint, normal) => {
            // r vector from center to contact
            const r = { x: contactPoint.x - predPos.x, y: contactPoint.y - predPos.y };
            // linear velocity at contact point: v + omega x r  (omega cross r)
            const omega = this.angV;
            const velAt = { x: this.v.x - omega * r.y, y: this.v.y + omega * r.x };
            const relVelAlongN = velAt.x * normal.x + velAt.y * normal.y;
            // compute scalar cross(r, n)
            const rCrossN = r.x * normal.y - r.y * normal.x;
            const invMassTerm = 1 / this.mass + (rCrossN * rCrossN) / this.inertia;
            const J = invMassTerm > 1e-12 ? (-(1 + e) * relVelAlongN) / invMassTerm : 0;
            // apply linear
            this.v.x += (J * normal.x) / this.mass;
            this.v.y += (J * normal.y) / this.mass;
            // apply angular (torque = r x (J*n)) / I
            const jnx = J * normal.x;
            const jny = J * normal.y;
            const torque = r.x * jny - r.y * jnx; // cross(r, J*n)
            this.angV += torque / this.inertia;
        };

        if (contacts.length > 0) {
            // apply each contact separately to produce realistic torques (lever effect)
            const slop = 0.5; // small allowance before heavy correction
            for (const c of contacts) {
                const r = { x: c.point.x - predPos.x, y: c.point.y - predPos.y };

                // relative normal velocity at contact (including rotational contribution)
                const velAt = { x: this.v.x - this.angV * r.y, y: this.v.y + this.angV * r.x };
                const vn = velAt.x * c.normal.x + velAt.y * c.normal.y;

                // positional correction: only a portion so we don't 'force' the rect upright
                const correction = Math.max(0, c.pen - slop) * 0.5;
                predPos.x += c.normal.x * correction;
                predPos.y += c.normal.y * correction;

                // apply restitution-based impulse if moving into contact
                if (vn < 0) {
                    // compute scalar cross(r, n)
                    const rCrossN = r.x * c.normal.y - r.y * c.normal.x;
                    const invMassTerm = 1 / this.mass + (rCrossN * rCrossN) / this.inertia;
                    const J = invMassTerm > 1e-12 ? (-(1 + e) * vn) / invMassTerm : 0;
                    // apply linear impulse
                    this.v.x += (J * c.normal.x) / this.mass;
                    this.v.y += (J * c.normal.y) / this.mass;
                    // apply angular impulse (torque = r x (J*n)) / I
                    const torque = r.x * (J * c.normal.y) - r.y * (J * c.normal.x);
                    // amplify torque slightly so corner impacts produce toppling
                    this.angV += (torque * 1.1) / this.inertia;
                }

                // apply tangential friction impulse (approx)
                const tangent = { x: -c.normal.y, y: c.normal.x };
                const vt = this.v.x * tangent.x + this.v.y * tangent.y;
                // friction impulse magnitude (simple proportional reduction)
                const fr = vt * friction;
                this.v.x -= tangent.x * fr;
                this.v.y -= tangent.y * fr;
            }

            // recompute predicted angle based on updated angular velocity so toppling appears immediately
            const newPredAng = this.ang + this.angV * dt;
            // optional: could recompute corners and resolve secondary penetrations; for stability keep it simple
            // commit the updated predicted angle
            // (pos will be committed below after damping)
            this.ang = newPredAng;
        }

        // commit predicted state
        this.pos.x = predPos.x;
        this.pos.y = predPos.y;
        this.ang = predAng;

        // damping and clamps
        const linDamp = Math.pow(this.linearDamping, dt);
        this.v.x *= linDamp;
        this.v.y *= linDamp;
        this.angV *= this.angularDamping;
        this.v.x = clamp(this.v.x, -this.maxLinear, this.maxLinear);
        this.v.y = clamp(this.v.y, -this.maxLinear, this.maxLinear);
        this.angV = clamp(this.angV, -this.maxAngV, this.maxAngV);

        // guard numerics
        if (!isFinite(this.v.x)) this.v.x = 0;
        if (!isFinite(this.v.y)) this.v.y = 0;
        if (!isFinite(this.pos.x)) this.pos.x = 0;
        if (!isFinite(this.pos.y)) this.pos.y = 0;
        if (!isFinite(this.ang)) this.ang = 0;
        if (!isFinite(this.angV)) this.angV = 0;

        // settling: if box is resting on the bottom edge, with very small linear and angular momentum,
        // snap to a flat orientation and stop motion to avoid tiny vibrations.
        try {
            const cornersNow = this.getCorners(this.ang, this.pos);
            const bottomContacts = cornersNow.filter((p) => p.y >= innerHeight - 1.5);
            const speed = Math.hypot(this.v.x, this.v.y);
            const angSpeed = Math.abs(this.angV);
            const linearStopThreshold = 1.0; // small linear velocity threshold
            const angStopThreshold = 0.02; // small angular velocity threshold (radians)
            const angleTolerance = 0.35; // ~20 degrees tolerance for being 'flat'

            if (bottomContacts.length > 0 && speed < linearStopThreshold && angSpeed < angStopThreshold) {
                // check if angle is roughly horizontal (near 0 or PI)
                const nearestMultiple = Math.round(this.ang / Math.PI);
                const targetAngle = nearestMultiple * Math.PI;
                const angleDiff = Math.abs(((this.ang - targetAngle + Math.PI) % (2 * Math.PI)) - Math.PI);
                if (angleDiff < angleTolerance) {
                    // snap orientation to exact flat angle and stop motion
                    this.ang = targetAngle;
                    this.v.x = 0;
                    this.v.y = 0;
                    this.angV = 0;
                    // adjust position so bottommost corner exactly sits on viewport bottom
                    const cornersFlat = this.getCorners(this.ang, this.pos);
                    let maxY = -Infinity;
                    for (const p of cornersFlat) if (p.y > maxY) maxY = p.y;
                    const dy = innerHeight - maxY;
                    this.pos.y += dy;
                    // mark settled so future steps are no-ops
                    this.settled = true;
                }
            }
        } catch (e) {
            // swallow any errors during settling detection
        }
    }

    // unfreeze the element so it starts being simulated
    unfreeze() {
        this.frozen = false;
    }

    render() {
        // set DOM element to top-left using center position
        const left = this.pos.x - this.w / 2;
        const top = this.pos.y - this.h / 2;
        this.el.style.left = `${left}px`;
        this.el.style.top = `${top}px`;
        this.el.style.transform = `rotate(${(this.ang * 180) / Math.PI}deg)`;
        this.el.style.opacity = String(this.alpha);
        try {
            this.el.style.visibility = "visible";
        } catch (e) {}
    }
}
