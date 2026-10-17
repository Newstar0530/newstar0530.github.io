// "In orbit" section: the galaxy sits in the middle, two tilted rings circle it.
// Inner ring = engineering (Tiffany Blue), outer ring = creative (violet) —
// the bridge idea from the nova.logue visual language. Each label rides its ring
// in 3D, drops behind the galaxy on the far side, and is tied to the core by a
// thin flow line with a glowing node. Hovering a label pauses the orbit,
// fires a ripple through the galaxy and shows its caption.
(() => {
    const stage = document.querySelector('.orbit');
    if (!stage) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const SVGNS = 'http://www.w3.org/2000/svg';

    const wide = () => stage.clientWidth >= 900;
    const TILT = wide() ? 66 : 52, ROLL = -12;
    const layout = w => (w >= 900 ? { cx: 0, cy: -0.1, scale: 0.56 } : { cx: 0, cy: -0.06, scale: 0.25 });
    const RINGS = [
        { r: 1.22, speed: 0.11 },   // engineering
        { r: 1.6, speed: 0.065 },   // creative
    ];

    const galaxy = window.NovaGalaxy ? window.NovaGalaxy.mount(stage, { tilt: TILT, roll: ROLL, layout }) : null;
    const view = () => galaxy ? galaxy.view()
        : Object.assign({ W: stage.clientWidth, H: stage.clientHeight, tilt: TILT, roll: ROLL }, layout(stage.clientWidth));

    // same projection as the galaxy shader, so the rings sit on the disc plane
    const project = (R, th, v) => {
        const t = v.tilt * Math.PI / 180, ro = v.roll * Math.PI / 180;
        const x = R * Math.cos(th), y = R * Math.sin(th);
        const y2 = y * Math.cos(t), z = y * Math.sin(t);
        const qx = x * Math.cos(ro) - y2 * Math.sin(ro), qy = x * Math.sin(ro) + y2 * Math.cos(ro);
        const p = 1 / (1 + z * 0.22), aspect = v.W / v.H;   // same perspective as the shader
        const cx = v.cx + qx * v.scale * p / aspect, cy = v.cy + qy * v.scale * p;
        return { x: (cx + 1) / 2 * v.W, y: (1 - cy) / 2 * v.H, z };
    };

    // ---------- SVG overlay: rings, flow lines, nodes, drawing-frame corners ----------
    const svg = stage.querySelector('.orbit-lines');
    const el = (tag, attrs, parent = svg) => {
        const e = document.createElementNS(SVGNS, tag);
        for (const k in attrs) e.setAttribute(k, attrs[k]);
        parent.appendChild(e);
        return e;
    };
    const defs = el('defs', {});
    const glow = el('filter', { id: 'orbitGlow', x: '-100%', y: '-100%', width: '300%', height: '300%' }, defs);
    el('feGaussianBlur', { stdDeviation: 3, result: 'b' }, glow);
    const merge = el('feMerge', {}, glow);
    el('feMergeNode', { in: 'b' }, merge); el('feMergeNode', { in: 'SourceGraphic' }, merge);

    const ringBack = RINGS.map((_, i) => el('path', { class: `ring ring-back ring-${i}` }));
    const flowG = el('g', { class: 'flows' });
    const ringFront = RINGS.map((_, i) => el('path', { class: `ring ring-front ring-${i}` }));
    const nodeG = el('g', { class: 'nodes', filter: 'url(#orbitGlow)' });
    const frame = el('path', { class: 'frame' });

    const drawRings = v => {
        RINGS.forEach((ring, i) => {
            let back = '', front = '', prevFront = null;
            for (let k = 0; k <= 160; k++) {
                const p = project(ring.r, (k / 160) * Math.PI * 2, v);
                const isFront = p.z <= 0;
                const cmd = (prevFront === isFront ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1);
                if (isFront) front += cmd; else back += cmd;
                prevFront = isFront;
            }
            ringBack[i].setAttribute('d', back);
            ringFront[i].setAttribute('d', front);
        });
        // technical-drawing corner brackets
        const m = v.W >= 900 ? 40 : 18, s = 22, W = v.W, H = v.H;
        frame.setAttribute('d', `M${m} ${m + s}V${m}H${m + s} M${W - m - s} ${m}H${W - m}V${m + s}
            M${W - m} ${H - m - s}V${H - m}H${W - m - s} M${m + s} ${H - m}H${m}V${H - m - s}`);
    };

    // ---------- labels ----------
    const labels = [...stage.querySelectorAll('.orbit-label')].map(btn => {
        const ring = +btn.dataset.ring;
        return {
            btn, ring,
            th: (+btn.dataset.angle) * Math.PI / 180,
            flow: el('path', { class: `flow flow-${ring}` }, flowG),
            node: el('circle', { class: `node node-${ring}`, r: 3.5 }, nodeG),
        };
    });

    const caption = stage.querySelector('.orbit-caption');
    const captionDefault = caption ? caption.innerHTML : '';
    let paused = 0, hot = null;

    labels.forEach(l => {
        const enter = () => {
            hot = l;
            l.btn.classList.add('hot');
            stage.classList.add('has-hot');
            if (galaxy) {
                const r = l.btn.getBoundingClientRect();
                galaxy.ripple(r.left + r.width / 2, r.top + r.height / 2);
                galaxy.hold(true);
            }
            if (caption) caption.innerHTML =
                `<em>${l.btn.querySelector('span').textContent}</em><span>${l.btn.dataset.desc}</span>`;
        };
        const leave = () => {
            if (hot === l) hot = null;
            l.btn.classList.remove('hot');
            stage.classList.remove('has-hot');
            if (galaxy) galaxy.hold(false);
            if (caption) caption.innerHTML = captionDefault;
        };
        l.btn.addEventListener('mouseenter', enter);
        l.btn.addEventListener('mouseleave', leave);
        l.btn.addEventListener('focus', enter);
        l.btn.addEventListener('blur', leave);
        l.btn.addEventListener('click', () => (hot === l ? leave() : enter()));   // tap on touch screens
    });

    // ---------- loop ----------
    let v = view(), last = performance.now(), running = false, visible = true;
    const place = () => {
        const core = project(0, 0, v);
        labels.forEach(l => {
            const p = project(RINGS[l.ring].r, l.th, v);
            const depth = Math.max(-1, Math.min(1, p.z / (RINGS[l.ring].r * Math.sin(v.tilt * Math.PI / 180))));
            const front = (1 - depth) / 2;          // 0 = far side, 1 = nearest
            const sc = 0.82 + 0.22 * front;
            l.btn.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${sc.toFixed(3)})`;
            l.btn.style.opacity = (0.42 + 0.58 * front).toFixed(2);
            l.btn.classList.toggle('back', p.z > 0);
            // flow line from the core to the label, bowed upward like the brand flow modules
            const mx = (core.x + p.x) / 2, my = Math.min(core.y, p.y) - Math.abs(p.x - core.x) * 0.18;
            l.flow.setAttribute('d', `M${core.x.toFixed(1)} ${core.y.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
            l.flow.style.opacity = (l === hot ? 0.95 : 0.12 + 0.2 * front).toFixed(2);
            l.node.setAttribute('cx', p.x.toFixed(1));
            l.node.setAttribute('cy', p.y.toFixed(1));
            l.node.style.opacity = (0.35 + 0.65 * front).toFixed(2);
        });
    };
    const tick = now => {
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        paused += ((hot ? 1 : 0) - paused) * 0.12;
        labels.forEach(l => { l.th += dt * RINGS[l.ring].speed * (1 - paused); });
        place();
        if (visible && !reduceMotion) requestAnimationFrame(tick); else running = false;
    };
    const start = () => {
        if (running || reduceMotion) return;
        running = true; last = performance.now(); requestAnimationFrame(tick);
    };

    const relayout = () => {
        svg.setAttribute('viewBox', `0 0 ${stage.clientWidth} ${stage.clientHeight}`);
        v = view();
        drawRings(v);
        place();
    };
    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(relayout, 180); });
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }).observe(stage);
    relayout();
    start();
})();
