// Motion layer inspired by React Bits (blur text, decrypted text, magnet,
// tilted card, spotlight border, click spark), written in plain JS.
(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(pointer: fine)').matches;

    // ---------- Blur text: headings fade in word by word from a blur ----------
    const splitWords = el => {
        let i = 0;
        [...el.childNodes].forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                const frag = document.createDocumentFragment();
                node.textContent.split(/(\s+)/).forEach(part => {
                    if (!part) return;
                    if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
                    const w = document.createElement('span');
                    w.className = 'bt-w';
                    w.style.setProperty('--i', i++);
                    w.textContent = part;
                    frag.appendChild(w);
                });
                node.replaceWith(frag);
            } else if (node.nodeName !== 'BR') {
                // Keep styled elements (like the gradient <em>) whole so their effects stay intact
                node.classList.add('bt-w');
                node.style.setProperty('--i', i++);
            }
        });
    };

    const blurTargets = document.querySelectorAll('.hero h1, .section-head h2, .contact h2');
    if (!reduceMotion) {
        const blurObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('bt-on');
                blurObserver.unobserve(entry.target);
            });
        }, { threshold: 0.3 });
        blurTargets.forEach(el => {
            el.classList.remove('reveal');   // the words animate instead of the whole block
            el.classList.add('bt');
            splitWords(el);
            blurObserver.observe(el);
        });
    }

    // ---------- Decrypted text: section numbers scramble before settling ----------
    const GLYPHS = '01<>/#%*+=';
    const decrypt = el => {
        const final = el.textContent;
        const start = performance.now();
        const run = now => {
            const p = Math.min((now - start) / 700, 1);
            const settled = Math.floor(p * final.length);
            el.textContent = [...final].map((ch, k) =>
                k < settled || ch === ' ' ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]).join('');
            if (p < 1) requestAnimationFrame(run);
            else el.textContent = final;
        };
        requestAnimationFrame(run);
    };
    if (!reduceMotion) {
        const decryptObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                decrypt(entry.target);
                decryptObserver.unobserve(entry.target);
            });
        }, { threshold: 0.8 });
        document.querySelectorAll('.section-head .num').forEach(el => decryptObserver.observe(el));
    }

    if (reduceMotion || !finePointer) return;

    // ---------- Magnet: buttons lean toward the cursor ----------
    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('mousemove', e => {
            const r = btn.getBoundingClientRect();
            const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
            const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
            btn.style.translate = `${dx * 10}px ${dy * 8}px`;
        });
        btn.addEventListener('mouseleave', () => { btn.style.translate = ''; });
    });

    // ---------- Tilted card: the portrait follows the cursor in 3D ----------
    const portrait = document.querySelector('.hero-portrait');
    const arch = document.querySelector('.arch');
    if (portrait && arch) {
        portrait.addEventListener('mousemove', e => {
            const r = portrait.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width - 0.5;
            const y = (e.clientY - r.top) / r.height - 0.5;
            arch.style.transform = `perspective(900px) rotateX(${-y * 10}deg) rotateY(${x * 12}deg) scale(1.02)`;
            portrait.style.setProperty('--px', x);
            portrait.style.setProperty('--py', y);
        });
        portrait.addEventListener('mouseleave', () => {
            arch.style.transform = '';
            portrait.style.setProperty('--px', 0);
            portrait.style.setProperty('--py', 0);
        });
    }

    // ---------- Click spark: a small burst of light where you click ----------
    document.addEventListener('click', e => {
        if (e.target.closest('input, textarea')) return;
        const burst = document.createElement('span');
        burst.className = 'spark-burst';
        burst.style.left = `${e.clientX}px`;
        burst.style.top = `${e.clientY}px`;
        for (let k = 0; k < 8; k++) {
            const ray = document.createElement('i');
            ray.style.setProperty('--a', `${k * 45}deg`);
            burst.appendChild(ray);
        }
        document.body.appendChild(burst);
        setTimeout(() => burst.remove(), 600);
    });
})();
