// Interactive layer: hero constellation, variable-weight name, scroll-velocity
// marquee, 3D tilt cards and a custom cursor ring. Runs after motion.js.
(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    if (reduceMotion) return;

    const hero = document.querySelector('.hero');
    const mouse = { x: -9999, y: -9999, active: false };

    // ---------- 1. Constellation: nodes link up near the cursor and scatter from it ----------
    if (hero) {
        const canvas = document.createElement('canvas');
        canvas.className = 'constellation';
        canvas.setAttribute('aria-hidden', 'true');
        hero.insertBefore(canvas, hero.querySelector('.wrap'));
        const ctx = canvas.getContext('2d');
        let W = 0, H = 0, dpr = 1, nodes = [], visible = true;

        const COLORS = ['95, 216, 207', '122, 162, 255', '139, 92, 246'];
        const build = () => {
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            W = hero.clientWidth; H = hero.clientHeight;
            canvas.width = W * dpr; canvas.height = H * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const count = Math.round(Math.min(W * H / (finePointer ? 11000 : 18000), 140));
            nodes = Array.from({ length: count }, () => ({
                x: Math.random() * W, y: Math.random() * H,
                vx: (Math.random() - .5) * .25, vy: (Math.random() - .5) * .25,
                r: Math.random() * 1.6 + .6,
                c: COLORS[Math.floor(Math.random() * COLORS.length)],
            }));
        };

        const LINK = 120, REACH = 170;
        const frame = () => {
            if (visible) {
                ctx.clearRect(0, 0, W, H);
                for (const n of nodes) {
                    const dx = n.x - mouse.x, dy = n.y - mouse.y, d = Math.hypot(dx, dy);
                    if (mouse.active && d < REACH && d > 0.1) {   // gently pushed away by the cursor
                        const f = (1 - d / REACH) * 0.9;
                        n.x += dx / d * f; n.y += dy / d * f;
                    }
                    n.x += n.vx; n.y += n.vy;
                    if (n.x < -20) n.x = W + 20; if (n.x > W + 20) n.x = -20;
                    if (n.y < -20) n.y = H + 20; if (n.y > H + 20) n.y = -20;
                }
                ctx.lineWidth = 1;
                for (let i = 0; i < nodes.length; i++) {
                    const a = nodes[i];
                    for (let j = i + 1; j < nodes.length; j++) {
                        const b = nodes[j];
                        const d = Math.hypot(a.x - b.x, a.y - b.y);
                        if (d < LINK) {
                            ctx.strokeStyle = `rgba(122, 162, 255, ${(1 - d / LINK) * 0.16})`;
                            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
                        }
                    }
                    if (mouse.active) {   // bright threads to the cursor
                        const d = Math.hypot(a.x - mouse.x, a.y - mouse.y);
                        if (d < REACH * 1.3) {
                            ctx.strokeStyle = `rgba(95, 216, 207, ${(1 - d / (REACH * 1.3)) * 0.55})`;
                            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
                        }
                    }
                }
                for (const n of nodes) {
                    const near = mouse.active && Math.hypot(n.x - mouse.x, n.y - mouse.y) < REACH * 1.3;
                    ctx.fillStyle = `rgba(${n.c}, ${near ? 1 : .7})`;
                    ctx.shadowColor = `rgba(${n.c}, 1)`;
                    ctx.shadowBlur = near ? 12 : 4;
                    ctx.beginPath(); ctx.arc(n.x, n.y, near ? n.r * 1.8 : n.r, 0, Math.PI * 2); ctx.fill();
                }
                ctx.shadowBlur = 0;
            }
            requestAnimationFrame(frame);
        };

        hero.addEventListener('pointermove', e => {
            const r = hero.getBoundingClientRect();
            mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.active = true;
        });
        hero.addEventListener('pointerleave', () => { mouse.active = false; });
        new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(hero);
        let rt;
        window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(build, 200); });
        build();
        requestAnimationFrame(frame);
    }

    if (!finePointer) return;   // everything below needs a mouse

    // ---------- 2. Variable proximity: letters of the name swell near the cursor ----------
    const h1 = document.querySelector('.hero h1');
    if (h1) {
        // split every text node inside the heading into single letters
        const walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
        const texts = [];
        while (walker.nextNode()) texts.push(walker.currentNode);
        texts.forEach(t => {
            if (!t.textContent.trim()) return;
            const frag = document.createDocumentFragment();
            [...t.textContent].forEach(ch => {
                const s = document.createElement('span');
                s.className = 'vp';
                s.textContent = ch;
                frag.appendChild(s);
            });
            t.replaceWith(frag);
        });
        const letters = [...h1.querySelectorAll('.vp')].map(el => {
            const italic = !!el.closest('em');
            return { el, min: italic ? 300 : 400, max: italic ? 600 : 700 };
        });
        let px = -9999, py = -9999, queued = false;
        const update = () => {
            queued = false;
            letters.forEach(l => {
                const r = l.el.getBoundingClientRect();
                const d = Math.hypot(r.left + r.width / 2 - px, r.top + r.height / 2 - py);
                const t = Math.max(0, 1 - d / 220);
                l.el.style.fontWeight = Math.round(l.min + (l.max - l.min) * t * t);
            });
        };
        hero.addEventListener('pointermove', e => {
            px = e.clientX; py = e.clientY;
            if (!queued) { queued = true; requestAnimationFrame(update); }
        });
        hero.addEventListener('pointerleave', () => { px = py = -9999; update(); });
    }

    // ---------- 3. Scroll velocity: the marquee speeds up and leans with your scroll ----------
    const track = document.querySelector('.marquee-track');
    if (track) {
        track.classList.add('js-driven');
        let x = 0, lastY = window.scrollY, vel = 0, dir = -1;
        const loop = () => {
            const y = window.scrollY;
            const dv = y - lastY; lastY = y;
            vel += (dv - vel) * 0.15;
            if (Math.abs(dv) > 0.5) dir = dv > 0 ? -1 : 1;
            const half = track.scrollWidth / 2;
            x += dir * (0.6 + Math.min(Math.abs(vel) * 0.35, 14));
            if (x <= -half) x += half;
            if (x > 0) x -= half;
            const skew = Math.max(-14, Math.min(14, -vel * 0.5));
            track.style.transform = `translate3d(${x}px, 0, 0) skewX(${skew}deg)`;
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    // ---------- 4. Tilt + glare on project, honor and education cards ----------
    // The rect is read once on enter: reading it while the card is rotated returns the
    // tilted box, which feeds back into the angle and makes the card jitter.
    // The angle eases toward the target every frame instead of restarting a CSS transition.
    document.querySelectorAll('.proj, .honor, .edu-card').forEach(card => {
        const glare = document.createElement('span');
        glare.className = 'glare';
        glare.setAttribute('aria-hidden', 'true');
        card.appendChild(glare);

        let rect = null, raf = null, hovering = false;
        const cur = { rx: 0, ry: 0, lift: 0 }, tgt = { rx: 0, ry: 0, lift: 0 };
        const step = () => {
            cur.rx += (tgt.rx - cur.rx) * 0.16;
            cur.ry += (tgt.ry - cur.ry) * 0.16;
            cur.lift += (tgt.lift - cur.lift) * 0.16;
            card.style.transform = `perspective(1000px) rotateX(${cur.rx.toFixed(2)}deg) rotateY(${cur.ry.toFixed(2)}deg) translateY(${cur.lift.toFixed(2)}px)`;
            const settled = Math.abs(tgt.rx - cur.rx) + Math.abs(tgt.ry - cur.ry) + Math.abs(tgt.lift - cur.lift) < 0.02;
            if (settled && !hovering) {
                card.style.transform = '';
                card.classList.remove('tilting');
                raf = null;
                return;
            }
            raf = requestAnimationFrame(step);
        };
        const kick = () => { if (!raf) raf = requestAnimationFrame(step); };

        const enter = () => {
            card.style.transform = '';
            rect = card.getBoundingClientRect();
            hovering = true;
            card.classList.add('tilting');
            tgt.lift = -6;
            kick();
        };
        card.addEventListener('mouseenter', enter);
        card.addEventListener('mousemove', e => {
            if (!hovering) enter();   // e.g. still over the card after a scroll reset it
            const x = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
            const y = Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1);
            tgt.rx = (0.5 - y) * 9;
            tgt.ry = (x - 0.5) * 11;
            glare.style.setProperty('--gx', `${x * 100}%`);
            glare.style.setProperty('--gy', `${y * 100}%`);
            kick();
        });
        card.addEventListener('mouseleave', () => {
            hovering = false;
            rect = null;
            tgt.rx = tgt.ry = tgt.lift = 0;
            kick();
        });
    });
    window.addEventListener('scroll', () => {
        document.querySelectorAll('.tilting').forEach(c => c.dispatchEvent(new MouseEvent('mouseleave')));
    }, { passive: true });

    // ---------- 5. Cursor ring that grows over anything clickable ----------
    const ring = document.createElement('div');
    ring.className = 'cursor-ring';
    const dot = document.createElement('div');
    dot.className = 'cursor-dot';
    document.body.append(ring, dot);
    let rx = 0, ry = 0, tx = 0, ty = 0;
    document.addEventListener('mousemove', e => {
        tx = e.clientX; ty = e.clientY;
        dot.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
        document.body.classList.add('has-ring');
        const hot = e.target instanceof Element && e.target.closest('a, button, .g, [data-modal], .tags li');
        ring.classList.toggle('hot', !!hot);
    });
    document.addEventListener('mouseleave', () => document.body.classList.remove('has-ring'));
    // mouse moves inside an iframe (the travel globe) never reach this page, so hide the ring there
    document.querySelectorAll('iframe').forEach(f => f.addEventListener('mouseenter', () => document.body.classList.remove('has-ring')));
    document.addEventListener('mousedown', () => ring.classList.add('press'));
    document.addEventListener('mouseup', () => ring.classList.remove('press'));
    const chase = () => {
        rx += (tx - rx) * 0.18; ry += (ty - ry) * 0.18;
        ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
        requestAnimationFrame(chase);
    };
    requestAnimationFrame(chase);
})();
