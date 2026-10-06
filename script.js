const nav = document.getElementById('nav');
const navToggle = document.getElementById('navToggle');
const navLinks = document.querySelectorAll('.nav-links a');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Nav background once the page scrolls
const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 20);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Mobile menu
navToggle.addEventListener('click', () => {
    const open = nav.classList.toggle('nav-open');
    navToggle.setAttribute('aria-expanded', open);
});
navLinks.forEach(a => a.addEventListener('click', () => {
    nav.classList.remove('nav-open');
    navToggle.setAttribute('aria-expanded', false);
}));

// Reveal on scroll, staggered within each batch
const revealObserver = new IntersectionObserver(entries => {
    entries.filter(e => e.isIntersecting).forEach((entry, i) => {
        entry.target.style.transitionDelay = `${i * 80}ms`;
        entry.target.classList.add('in');
        revealObserver.unobserve(entry.target);
    });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// Highlight the nav link for the section in view
const sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#${entry.target.id}`));
    });
}, { rootMargin: '-45% 0px -50% 0px' });
document.querySelectorAll('main section[id]').forEach(s => sectionObserver.observe(s));

// Count-up for stats
const countObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = Number(el.dataset.count);
        const start = performance.now();
        const tick = now => {
            const p = Math.min((now - start) / 1200, 1);
            el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
            if (p < 1) requestAnimationFrame(tick);
        };
        if (!reduceMotion) requestAnimationFrame(tick);
        countObserver.unobserve(el);
    });
}, { threshold: 0.6 });
document.querySelectorAll('[data-count]').forEach(el => countObserver.observe(el));

// Parallax on the photo band
const band = document.querySelector('.band');
const bandImg = document.querySelector('.band-img');
if (band && !reduceMotion) {
    const parallax = () => {
        const r = band.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) return;
        const progress = (r.top + r.height) / (window.innerHeight + r.height) - 0.5;
        bandImg.style.transform = `translateY(${progress * 80}px)`;
    };
    window.addEventListener('scroll', parallax, { passive: true });
    parallax();
}

// Gallery lightbox
const lightbox = document.getElementById('lightbox');
const lbImg = lightbox.querySelector('img');
const lbCap = lightbox.querySelector('figcaption');
const photos = [...document.querySelectorAll('.gallery .g')];
let current = 0;

const show = i => {
    current = (i + photos.length) % photos.length;
    const img = photos[current].querySelector('img');
    lbImg.src = img.src;
    lbImg.alt = img.alt;
    lbCap.textContent = photos[current].querySelector('figcaption').textContent;
};
const openLb = i => { show(i); lightbox.classList.add('open'); lightbox.setAttribute('aria-hidden', false); document.body.style.overflow = 'hidden'; };
const closeLb = () => { lightbox.classList.remove('open'); lightbox.setAttribute('aria-hidden', true); document.body.style.overflow = ''; };

photos.forEach((fig, i) => fig.addEventListener('click', () => openLb(i)));
lightbox.querySelector('.lb-close').addEventListener('click', closeLb);
lightbox.querySelector('.lb-prev').addEventListener('click', e => { e.stopPropagation(); show(current - 1); });
lightbox.querySelector('.lb-next').addEventListener('click', e => { e.stopPropagation(); show(current + 1); });
lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLb(); });
document.addEventListener('keydown', e => {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') closeLb();
    if (e.key === 'ArrowLeft') show(current - 1);
    if (e.key === 'ArrowRight') show(current + 1);
});

// Star cursor trail (kept from the original site, lighter and desktop-only)
if (window.matchMedia('(pointer: fine)').matches && !reduceMotion) {
    let last = 0;
    document.addEventListener('mousemove', e => {
        const now = performance.now();
        if (now - last < 45) return;
        last = now;
        const star = document.createElement('span');
        star.className = 'star-cursor';
        star.textContent = '✦';
        star.style.left = `${e.clientX}px`;
        star.style.top = `${e.clientY}px`;
        document.body.appendChild(star);
        setTimeout(() => star.remove(), 800);
    });
}

// Project modals
let lastTrigger = null;
const openModal = modal => {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', false);
    document.body.style.overflow = 'hidden';
    modal.querySelector('.modal-close').focus();
};
const closeModal = modal => {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', true);
    document.body.style.overflow = '';
    if (lastTrigger) lastTrigger.focus();
};
document.querySelectorAll('[data-modal]').forEach(trigger => trigger.addEventListener('click', () => {
    lastTrigger = trigger;
    openModal(document.getElementById(trigger.dataset.modal));
}));
document.querySelectorAll('.modal').forEach(modal => {
    modal.querySelector('.modal-close').addEventListener('click', () => closeModal(modal));
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(modal); });
    // Screenshot opens full-size in a new tab
    const shot = modal.querySelector('.modal-shot');
    if (shot) shot.addEventListener('click', () => window.open(shot.src, '_blank'));
});
document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.modal.open').forEach(closeModal);
});

// Scroll progress bar
const progress = document.getElementById('progress');
const updateProgress = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
};
window.addEventListener('scroll', updateProgress, { passive: true });
updateProgress();

// Cursor glow + spotlight on cards (desktop only)
if (window.matchMedia('(pointer: fine)').matches && !reduceMotion) {
    const glow = document.getElementById('cursorGlow');
    let gx = 0, gy = 0, tx = 0, ty = 0, raf = null;
    const follow = () => {
        gx += (tx - gx) * 0.12;
        gy += (ty - gy) * 0.12;
        glow.style.left = `${gx}px`;
        glow.style.top = `${gy}px`;
        raf = Math.abs(tx - gx) + Math.abs(ty - gy) > 0.5 ? requestAnimationFrame(follow) : null;
    };
    document.addEventListener('mousemove', e => {
        tx = e.clientX; ty = e.clientY;
        glow.style.opacity = 1;
        if (!raf) raf = requestAnimationFrame(follow);
    });
    document.addEventListener('mouseleave', () => { glow.style.opacity = 0; });

    document.querySelectorAll('.card, .proj, .edu-card, .honor').forEach(card => {
        card.addEventListener('mousemove', e => {
            const r = card.getBoundingClientRect();
            card.style.setProperty('--mx', `${e.clientX - r.left}px`);
            card.style.setProperty('--my', `${e.clientY - r.top}px`);
        });
    });
}
