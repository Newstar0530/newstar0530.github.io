// Spiral galaxy drawn with WebGL, mountable on any element.
// Inner stars orbit faster than outer ones while the arm pattern turns slowly,
// so stars stream through the arms. Moving the pointer gathers stars into a
// trailing filament; clicking sends a ring of light outward.
// Inspired by React Bits' "Binary Orbits", written from scratch for this site.
//
//   const g = NovaGalaxy.mount(element, { layout: w => ({ cx, cy, scale }) });
//   g.view()               -> current projection, so overlays can follow the disc
//   g.ripple(clientX, Y)   -> send a ring of light from a screen point
(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(pointer: fine)').matches;

    const DEFAULTS = {
        armColor: [0.42, 0.33, 1.0],    // violet-blue arms
        coreColor: [0.37, 0.85, 0.81],  // Tiffany Blue inner disc
        hotColor: [1.0, 0.92, 0.70],    // champagne-white core
        arms: 3, twist: 3.4, armStrength: 0.85, dust: 0.5,
        coreSize: 0.07, thickness: 0.022,
        tilt: 64, roll: -14,
        speed: 0.55,
        layout: () => ({ cx: 0, cy: 0, scale: 0.8 }),
    };

    const VS = `
    precision highp float;
    attribute vec4 aA;   // radius, start angle, height, size
    attribute vec4 aB;   // colour jitter, twinkle phase, kind (0 star, 1 sparkle, 2 glow), arm jitter
    uniform float uRot, uPattern, uTime, uTwist, uArms, uArmStr, uDust, uTilt, uRoll;
    uniform vec2 uCenter; uniform float uScale, uAspect, uPx, uBoost;
    uniform vec3 uWake[8];
    uniform vec3 uRip[3];
    uniform vec3 uArmC, uCoreC, uHotC;
    varying vec3 vCol; varying float vI; varying float vKind;

    void main() {
        float r = aA.x;
        float th = aA.y + uRot * (0.42 / (r + 0.12));
        float ph = (th - uPattern - uTwist * log(r + 0.04)) * uArms + aB.w;
        float arm = pow(0.5 + 0.5 * cos(ph), 3.0);
        float inArm = smoothstep(0.06, 0.22, r);
        float armF = mix(1.0, mix(1.0 - uArmStr, 1.0, arm), inArm);
        float lane = 1.0 - uDust * pow(0.5 + 0.5 * cos(ph + 1.1), 14.0) * inArm;

        vec3 p = vec3(r * cos(th), r * sin(th), aA.z);
        float ct = cos(uTilt), st = sin(uTilt);
        p = vec3(p.x, p.y * ct - p.z * st, p.y * st + p.z * ct);
        float cr = cos(uRoll), sr = sin(uRoll);
        vec2 q = vec2(p.x * cr - p.y * sr, p.x * sr + p.y * cr);
        float persp = 1.0 / (1.0 + p.z * 0.22);
        vec2 pos = uCenter + q * uScale * persp * vec2(1.0 / uAspect, 1.0);

        vec2 s = pos * vec2(uAspect, 1.0);
        vec2 off = vec2(0.0); float glow = 0.0;
        for (int i = 0; i < 8; i++) {
            vec2 d = s - uWake[i].xy * vec2(uAspect, 1.0);
            float f = exp(-dot(d, d) / 0.006) * uWake[i].z;
            off -= d * f * 0.55; glow += f * 1.6;
        }
        for (int i = 0; i < 3; i++) {
            if (uRip[i].z < 0.0) continue;
            vec2 d = s - uRip[i].xy * vec2(uAspect, 1.0);
            float dist = length(d) + 1e-4;
            float band = exp(-pow((dist - uRip[i].z * 0.85) / 0.045, 2.0)) * exp(-uRip[i].z * 1.1);
            off += d / dist * band * 0.035; glow += band * 2.6;
        }
        pos += off * vec2(1.0 / uAspect, 1.0);
        gl_Position = vec4(pos, 0.0, 1.0);

        float tw = 1.0 - 0.35 * (0.5 + 0.5 * sin(uTime * (1.3 + aB.y) + aB.y * 6.28));
        float far = mix(1.0, 0.6, smoothstep(-0.3, 0.6, p.z));
        float size = aA.w * uPx * persp * (1.0 + glow * 0.5);
        vKind = aB.z;
        if (aB.z > 1.5) {
            gl_PointSize = aA.w * uPx * uScale;
            vCol = uHotC; vI = 0.18 * (1.0 + uBoost * 0.25);
            return;
        }
        gl_PointSize = aB.z > 0.5 ? size * 2.2 : size;
        float c = clamp(smoothstep(0.62, 0.0, r) + (aB.x - 0.5) * 0.35, 0.0, 1.0);
        vCol = mix(uArmC, uCoreC, c);
        vCol = mix(vCol, uHotC, smoothstep(0.09, 0.0, r));
        vI = armF * lane * far * tw * (1.0 + glow) * (1.0 + uBoost * 0.35)
           * (aB.z > 0.5 ? 1.6 : 0.95) * mix(1.0, 0.45, smoothstep(0.15, 0.0, r));
    }`;
    const FS = `
    precision mediump float;
    varying vec3 vCol; varying float vI; varying float vKind;
    void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = vKind > 1.5 ? exp(-d * d * 4.0) : smoothstep(1.0, 0.0, d);
        if (vKind > 0.5 && vKind < 1.5) a += 0.6 * max(0.0, 1.0 - abs(gl_PointCoord.x - 0.5) * 18.0) * (1.0 - d)
                                              + 0.6 * max(0.0, 1.0 - abs(gl_PointCoord.y - 0.5) * 18.0) * (1.0 - d);
        gl_FragColor = vec4(vCol * a * vI, 0.0);
    }`;

    const gauss = () => Math.sqrt(-2 * Math.log(Math.random() + 1e-9)) * Math.cos(2 * Math.PI * Math.random());

    function mount(host, options = {}) {
        const CFG = Object.assign({}, DEFAULTS, options);
        const canvas = document.createElement('canvas');
        canvas.className = 'galaxy';
        canvas.setAttribute('aria-hidden', 'true');
        const gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: true });
        if (!gl) return null;

        const compile = (type, src) => {
            const sh = gl.createShader(type);
            gl.shaderSource(sh, src); gl.compileShader(sh);
            if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
            return sh;
        };
        let prog;
        try {
            prog = gl.createProgram();
            gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
            gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
            gl.linkProgram(prog);
            if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
        } catch (err) {
            console.warn('galaxy disabled:', err);
            return null;
        }
        host.prepend(canvas);
        gl.useProgram(prog);

        // stars
        const N = finePointer ? 42000 : 14000;
        const A = new Float32Array((N + 1) * 4), B = new Float32Array((N + 1) * 4);
        for (let i = 0; i < N; i++) {
            let r;
            if (Math.random() < 0.10) r = Math.abs(gauss()) * CFG.coreSize * 1.4;      // bulge
            else r = 0.05 + Math.pow(Math.random(), 0.85) * 0.98;                      // disc
            const z = gauss() * CFG.thickness * (1 + 1.5 * Math.exp(-r / 0.08));
            const sparkle = Math.random() < 0.035 ? 1 : 0;
            A.set([r, Math.random() * Math.PI * 2, z, 0.75 + Math.random() * 0.75], i * 4);
            B.set([Math.random(), Math.random(), sparkle, gauss() * 0.35], i * 4);
        }
        A.set([0, 0, 0, 260], N * 4);
        B.set([0, 0, 2, 0], N * 4);
        [[A, 'aA'], [B, 'aB']].forEach(([data, name]) => {
            const b = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, b);
            gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
            const loc = gl.getAttribLocation(prog, name);
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 0, 0);
        });

        const U = {};
        ['uRot', 'uPattern', 'uTime', 'uTwist', 'uArms', 'uArmStr', 'uDust', 'uTilt', 'uRoll', 'uCenter', 'uScale',
         'uAspect', 'uPx', 'uBoost', 'uWake', 'uRip', 'uArmC', 'uCoreC', 'uHotC']
            .forEach(n => { U[n] = gl.getUniformLocation(prog, n); });
        gl.uniform1f(U.uTwist, CFG.twist); gl.uniform1f(U.uArms, CFG.arms);
        gl.uniform1f(U.uArmStr, CFG.armStrength); gl.uniform1f(U.uDust, CFG.dust);
        gl.uniform1f(U.uTilt, CFG.tilt * Math.PI / 180); gl.uniform1f(U.uRoll, CFG.roll * Math.PI / 180);
        gl.uniform3fv(U.uArmC, CFG.armColor); gl.uniform3fv(U.uCoreC, CFG.coreColor); gl.uniform3fv(U.uHotC, CFG.hotColor);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.clearColor(0, 0, 0, 0);

        // sizing
        let W = 0, H = 0, L = CFG.layout(0);
        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
            W = host.clientWidth; H = host.clientHeight;
            canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
            gl.viewport(0, 0, canvas.width, canvas.height);
            L = CFG.layout(W);
            gl.uniform2f(U.uCenter, L.cx, L.cy);
            gl.uniform1f(U.uScale, L.scale);
            gl.uniform1f(U.uAspect, W / H);
            gl.uniform1f(U.uPx, dpr * 1.6 * Math.min(1.25, Math.max(0.8, H / 900)));
        };

        // pointer
        const wake = Array.from({ length: 8 }, () => ({ x: 9, y: 9, t: -99 }));
        let wakeIdx = 0, lastWake = 0, inside = false, hoverHold = false;
        const ripples = [{ x: 0, y: 0, t: -99 }, { x: 0, y: 0, t: -99 }, { x: 0, y: 0, t: -99 }];
        let ripIdx = 0;
        const toClip = (cx, cy) => {
            const r = canvas.getBoundingClientRect();
            return { x: ((cx - r.left) / r.width) * 2 - 1, y: 1 - ((cy - r.top) / r.height) * 2 };
        };
        const ripple = (cx, cy) => {
            const c = toClip(cx, cy);
            ripples[ripIdx] = { x: c.x, y: c.y, t: performance.now() / 1000 };
            ripIdx = (ripIdx + 1) % ripples.length;
        };
        host.addEventListener('pointermove', e => {
            inside = true;
            const now = performance.now() / 1000;
            if (now - lastWake < 0.045) return;
            lastWake = now;
            const c = toClip(e.clientX, e.clientY);
            wake[wakeIdx] = { x: c.x, y: c.y, t: now };
            wakeIdx = (wakeIdx + 1) % wake.length;
        });
        host.addEventListener('pointerleave', () => { inside = false; });
        host.addEventListener('click', e => {
            if (e.target.closest('a, button, .orbit-label')) return;
            ripple(e.clientX, e.clientY);
        });

        // loop
        let rot = 8, boost = 0, last = performance.now(), visible = true, running = false;
        const wakeArr = new Float32Array(24), ripArr = new Float32Array(9);
        const draw = nowMs => {
            const now = nowMs / 1000;
            const dt = Math.min((nowMs - last) / 1000, 0.05);
            last = nowMs;
            boost += ((inside || hoverHold ? 1 : 0) - boost) * 0.06;
            if (!reduceMotion) rot += dt * CFG.speed * (1 + boost * 0.6);
            wake.forEach((w, i) => {
                const age = now - w.t;
                wakeArr.set([w.x, w.y, age < 1.6 ? Math.exp(-age * 2.2) : 0], i * 3);
            });
            ripples.forEach((rp, i) => {
                const age = now - rp.t;
                ripArr.set([rp.x, rp.y, age < 2.6 ? age : -1], i * 3);
            });
            gl.uniform1f(U.uRot, rot);
            gl.uniform1f(U.uPattern, rot * 0.08);
            gl.uniform1f(U.uTime, reduceMotion ? 0 : now);
            gl.uniform1f(U.uBoost, boost);
            gl.uniform3fv(U.uWake, wakeArr);
            gl.uniform3fv(U.uRip, ripArr);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.drawArrays(gl.POINTS, 0, N + 1);
        };
        const loop = t => {
            if (!visible || reduceMotion) { running = false; return; }
            draw(t);
            requestAnimationFrame(loop);
        };
        const start = () => {
            if (!running && !reduceMotion) { running = true; last = performance.now(); requestAnimationFrame(loop); }
        };
        let rt;
        window.addEventListener('resize', () => {
            clearTimeout(rt);
            rt = setTimeout(() => { resize(); if (reduceMotion || !running) draw(performance.now()); }, 150);
        });
        new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }).observe(host);
        resize();
        draw(performance.now());
        start();

        return {
            canvas,
            ripple,
            hold: on => { hoverHold = on; },
            view: () => ({ W, H, cx: L.cx, cy: L.cy, scale: L.scale, tilt: CFG.tilt, roll: CFG.roll }),
        };
    }

    window.NovaGalaxy = { mount, DEFAULTS };
})();
