document.addEventListener('DOMContentLoaded', () => {
    if (window.AOS) {
        AOS.init({ duration: 800, once: true, offset: 50, throttleDelay: 100, debounceDelay: 50, disableMutationObserver: true });
    }

    window.toggleMobileMenu = function () {
        const menu = document.getElementById('mobile-menu');
        const backdrop = document.getElementById('mobile-menu-backdrop');
        const drawer = document.getElementById('mobile-menu-drawer');
        if (!menu || !backdrop || !drawer) return;
        const isClosed = menu.classList.contains('pointer-events-none');
        const menuToggle = document.getElementById('header-menu-toggle');
        if (menuToggle) {
            menuToggle.setAttribute('aria-expanded', isClosed ? 'true' : 'false');
            menuToggle.setAttribute('aria-label', isClosed ? 'Close menu' : 'Open menu');
        }
        if (isClosed) {
            menu.style.top = '0px';
            menu.style.height = '100dvh';
            const hdr = document.getElementById('header');
            if (hdr) drawer.style.top = Math.round(hdr.getBoundingClientRect().bottom) + 'px';
            document.documentElement.style.overflow = 'hidden';
            document.body.style.overflow = 'hidden';
            document.body.classList.add('mm-open');
            menu.classList.remove('pointer-events-none');
            requestAnimationFrame(() => {
                backdrop.classList.remove('opacity-0');
                drawer.classList.remove('-translate-y-full');
            });
        } else {
            backdrop.classList.add('opacity-0');
            drawer.classList.add('-translate-y-full');
            document.documentElement.style.overflow = '';
            document.body.style.overflow = '';
            document.body.classList.remove('mm-open');
            setTimeout(() => { menu.classList.add('pointer-events-none'); }, 350);
        }
    };

    const mobileCloseBtn = document.getElementById('mobile-menu-close');
    if (mobileCloseBtn) mobileCloseBtn.addEventListener('click', (e) => { e.stopPropagation(); window.toggleMobileMenu(); });

    const mobileBackdrop = document.getElementById('mobile-menu-backdrop');
    if (mobileBackdrop) {
        mobileBackdrop.addEventListener('click', () => {
            const menu = document.getElementById('mobile-menu');
            if (menu && !menu.classList.contains('pointer-events-none')) window.toggleMobileMenu();
        });
    }

    const mobileDrawer = document.getElementById('mobile-menu-drawer');
    if (mobileDrawer) {
        mobileDrawer.addEventListener('touchmove', (e) => { e.stopPropagation(); }, { passive: false });
        mobileDrawer.addEventListener('wheel', (e) => { e.stopPropagation(); }, { passive: false });
    }

    document.addEventListener('keydown', (ev) => {
        if (ev.key !== 'Escape') return;
        const menu = document.getElementById('mobile-menu');
        if (menu && !menu.classList.contains('pointer-events-none')) window.toggleMobileMenu();
    });

    document.querySelectorAll('.mobile-nav-item').forEach(link => {
        link.addEventListener('click', (e) => {
            document.querySelectorAll('.mm-item, .mobile-nav-item').forEach(l => {
                l.classList.remove('is-active');
                l.classList.remove('active');
            });
            link.classList.add('is-active');
            link.setAttribute('aria-current', 'page');
            const href = link.getAttribute('href');
            const hashChar = String.fromCharCode(35);
            if (!href || !href.startsWith(hashChar)) return;
            e.preventDefault();
            const targetEl = document.querySelector(href);
            if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                setTimeout(() => {
                    const menu = document.getElementById('mobile-menu');
                    if (menu && !menu.classList.contains('pointer-events-none')) window.toggleMobileMenu();
                }, 350);
            }
        });
    });

    window.addEventListener('resize', () => {
        const menu = document.getElementById('mobile-menu');
        if (menu) {
            menu.style.top = '0px';
            menu.style.height = '100dvh';
            if (window.innerWidth >= 1024 && !menu.classList.contains('pointer-events-none')) {
                menu.classList.add('pointer-events-none');
                document.getElementById('mobile-menu-backdrop').classList.add('opacity-0');
                document.getElementById('mobile-menu-drawer').classList.add('-translate-y-full');
                document.documentElement.style.overflow = '';
                document.body.style.overflow = '';
                document.body.classList.remove('mm-open');
                const toggle = document.getElementById('header-menu-toggle');
                if (toggle) {
                    toggle.setAttribute('aria-expanded', 'false');
                    toggle.setAttribute('aria-label', 'Open menu');
                }
            }
        }
    }, { passive: true });

    const counters = document.querySelectorAll('.counter');
    let hasCounted = false;
    if ('IntersectionObserver' in window && counters.length) {
        const counterObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !hasCounted) {
                    hasCounted = true;
                    counters.forEach(counter => {
                        const target = +counter.getAttribute('data-target');
                        const duration = 1600;
                        const startTime = performance.now();
                        function updateCount(now) {
                            const elapsed = now - startTime;
                            const progress = Math.min(elapsed / duration, 1);
                            const ease = 1 - Math.pow(1 - progress, 3);
                            const current = Math.floor(ease * target);
                            counter.innerText = current;
                            if (progress < 1) requestAnimationFrame(updateCount);
                            else counter.innerText = target;
                        }
                        requestAnimationFrame(updateCount);
                    });
                }
            });
        }, { threshold: 0.2 });
        const statsContainer = document.getElementById('stats-container');
        if (statsContainer) counterObserver.observe(statsContainer);
    }

    const tabVideos = document.getElementById('tab-videos');
    const tabShorts = document.getElementById('tab-shorts');
    const gridVideos = document.getElementById('grid-videos');
    const gridShorts = document.getElementById('grid-shorts');
    if (tabVideos && tabShorts && gridVideos && gridShorts) {
        const setTab = (showVideos, moveFocus = false) => {
            tabVideos.classList.toggle('is-active', showVideos);
            tabShorts.classList.toggle('is-active', !showVideos);
            tabVideos.setAttribute('aria-selected', showVideos ? 'true' : 'false');
            tabShorts.setAttribute('aria-selected', showVideos ? 'false' : 'true');
            tabVideos.tabIndex = showVideos ? 0 : -1;
            tabShorts.tabIndex = showVideos ? -1 : 0;
            gridVideos.classList.toggle('hidden', !showVideos);
            gridShorts.classList.toggle('hidden', showVideos);
            gridVideos.hidden = !showVideos;
            gridShorts.hidden = showVideos;
            if (moveFocus) (showVideos ? tabVideos : tabShorts).focus();
            if (window.AOS) setTimeout(() => AOS.refresh(), 50);
        };
        tabVideos.addEventListener('click', () => setTab(true));
        tabShorts.addEventListener('click', () => setTab(false));
        [tabVideos, tabShorts].forEach((tab) => {
            tab.addEventListener('keydown', (event) => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return;
                event.preventDefault();
                if (event.key === 'Home') setTab(true, true);
                else if (event.key === 'End') setTab(false, true);
                else setTab(tab === tabVideos ? false : true, true);
            });
        });
    }

    window.handleNewsletterSubscribe = async function (form) {
        try {
            const input = form.querySelector('input[type="email"]');
            const value = input ? String(input.value || '').trim() : '';
            const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
            if (!valid) {
                if (window.showCustomMessage) window.showCustomMessage('Please enter a valid email address.');
                if (input) input.focus();
                return;
            }
            const csrf = form.querySelector('input[name="_csrf"]');
            const hp = form.querySelector('input[name="website_url"]');
            const fd = new FormData();
            fd.append('email', value);
            if (csrf) fd.append('_csrf', csrf.value);
            if (hp) fd.append('website_url', hp.value);
            const resp = await fetch('api/submit-newsletter.php', {
                method: 'POST',
                body: fd,
                credentials: 'same-origin'
            });
            const data = await resp.json().catch(() => ({}));
            if (resp.ok && data.ok) {
                if (window.showCustomMessage) window.showCustomMessage(data.message || 'Subscribed! Thank you.');
                form.reset();
            } else {
                if (window.showCustomMessage) window.showCustomMessage(data.error || 'Could not subscribe right now.');
            }
        } catch (err) {
            if (window.showCustomMessage) window.showCustomMessage('Could not subscribe right now.');
        }
    };
});

window.showCustomMessage = function (text) {
    const msgBox = document.getElementById('custom-msg-box');
    const msgText = document.getElementById('custom-msg-text');
    if (!msgBox || !msgText) return;
    msgText.textContent = text;
    msgBox.classList.remove('translate-x-[200%]');
    setTimeout(() => { msgBox.classList.add('translate-x-[200%]'); }, 3000);
};

(function () {
    const headerEl = document.getElementById('header');
    let headerScrolled = null;
    const onHeaderScroll = () => {
        if (!headerEl) return;
        const scrolled = window.scrollY > 8;
        if (scrolled !== headerScrolled) {
            headerScrolled = scrolled;
            headerEl.classList.toggle('scrolled', scrolled);
        }
    };
    window.addEventListener('scroll', onHeaderScroll, { passive: true });
    onHeaderScroll();

    const translations = {
        en: {
            'nav.service': 'Service', 'nav.work': 'Work', 'nav.review': 'Review', 'nav.headerTeam': 'Team',
            'brand.tagline': window.__MM_TAGLINE__ || 'Video Editing Agency',
            'header.ourServices': 'Our Services',
            'nav.home': 'Home', 'nav.about': 'About', 'nav.services': 'Services',
            'nav.portfolio': 'Portfolio', 'nav.reviews': 'Reviews', 'nav.team': 'Our Team',
            'nav.contact': 'Contact', 'cta.quote': 'Get Free Quote', 'menu.title': 'Menu'
        },
        bn: {
            'nav.service': 'সার্ভিস', 'nav.work': 'কাজ', 'nav.review': 'রিভিউ', 'nav.headerTeam': 'টিম',
            'brand.tagline': 'ভিডিও এডিটিং এজেন্সি',
            'header.ourServices': 'আমাদের সার্ভিস',
            'nav.home': 'হোম', 'nav.about': 'আমাদের সম্পর্কে', 'nav.services': 'সার্ভিস',
            'nav.portfolio': 'পোর্টফোলিও', 'nav.reviews': 'রিভিউ', 'nav.team': 'আমাদের টিম',
            'nav.contact': 'যোগাযোগ', 'cta.quote': 'ফ্রি কোটেশন নিন', 'menu.title': 'মেনু'
        }
    };
    const applyLang = (lang) => {
        const dict = translations[lang] || translations.en;
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[key]) el.textContent = dict[key];
        });
        document.querySelectorAll('.lang-switch').forEach(sw => sw.setAttribute('data-lang', lang));
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('is-active', btn.getAttribute('data-lang') === lang);
        });
        document.documentElement.setAttribute('lang', lang === 'bn' ? 'bn' : 'en');
    };
    let savedLang = 'en';
    try { savedLang = localStorage.getItem('mm_lang') || 'en'; } catch (e) {}
    applyLang(savedLang);
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const lang = btn.getAttribute('data-lang') || 'en';
            applyLang(lang);
            try { localStorage.setItem('mm_lang', lang); } catch (e) {}
        });
    });
})();

(function () {
    // The showreel opens in the shared site player (assets/js/mm-video-player.js),
    // the same component used by every video card.
    window.openShowreel = function () {
        const rawUrl = window.__MM_SHOWREEL_URL__ || '';
        if (!rawUrl) {
            const portfolio = document.getElementById('portfolio');
            if (portfolio) {
                const headerOffset = Math.max(0, document.getElementById('header')?.getBoundingClientRect().bottom || 0);
                const targetTop = portfolio.getBoundingClientRect().top + window.scrollY - headerOffset;
                window.scrollTo({ top: targetTop, behavior: 'smooth' });
            }
            return;
        }
        if (!window.MMPlayer) return;
        // A bare 11-character value is a YouTube video ID.
        const src = /^[\w-]{11}$/.test(rawUrl) ? 'https://www.youtube.com/watch?v=' + rawUrl : rawUrl;
        window.MMPlayer.open({ src: src, title: 'Showreel' });
    };

    window.closeShowreel = function () {
        if (window.MMPlayer) window.MMPlayer.close();
    };
})();

(function initReviewSlider() {
    const track = document.querySelector('.reviews-container');
    if (!track || !track.children.length) return;

    const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const originals = Array.from(track.children);
    originals.forEach(node => {
        const clone = node.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        track.appendChild(clone);
    });

    let halfWidth = 0;
    const measure = () => {
        const gap = parseFloat(getComputedStyle(track).gap) || 0;
        halfWidth = originals.reduce((sum, el) => sum + el.getBoundingClientRect().width + gap, 0);
    };
    measure();
    let resizeRaf = 0;
    window.addEventListener('resize', () => {
        if (resizeRaf) return;
        resizeRaf = requestAnimationFrame(() => { resizeRaf = 0; measure(); });
    }, { passive: true });
    window.addEventListener('load', measure);
    setTimeout(measure, 700);

    const wrapEl = track.closest('.rs-wrap') || track;
    const section = document.getElementById('reviews') || wrapEl;
    const canHover = !window.matchMedia || window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const SPEED = 34;
    let dragging = false, focusReading = false, touching = false, hovering = false;
    let lastTime = 0, pos = 0, applied = 0, raf = 0, inView = false;

    const sync = () => { pos = track.scrollLeft; applied = pos; };
    const step = (now) => {
        raf = 0;
        const dt = lastTime ? Math.min(now - lastTime, 80) : 16;
        lastTime = now;
        if (!dragging && !hovering && !focusReading && !touching && !document.hidden && halfWidth > 0) {
            pos += (SPEED * dt) / 1000;
            if (pos >= halfWidth) pos -= halfWidth;
            track.scrollLeft = pos;
            applied = track.scrollLeft;
        }
        if (inView && !document.hidden && !reduceMotion) raf = requestAnimationFrame(step);
    };
    const start = () => {
        if (reduceMotion || raf || !inView || document.hidden) return;
        lastTime = 0; sync(); raf = requestAnimationFrame(step);
    };
    const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };

    if (canHover) {
        section.addEventListener('mouseenter', () => { hovering = true; });
        section.addEventListener('mouseleave', () => { hovering = false; });
    }
    wrapEl.addEventListener('focusin', (e) => {
        if (e.target.matches && e.target.matches(':focus-visible')) { focusReading = true; sync(); }
    });
    wrapEl.addEventListener('focusout', () => { focusReading = false; sync(); });
    wrapEl.addEventListener('touchstart', () => { touching = true; sync(); }, { passive: true });
    wrapEl.addEventListener('touchend', () => { touching = false; sync(); }, { passive: true });
    wrapEl.addEventListener('touchcancel', () => { touching = false; sync(); }, { passive: true });

    let dragStartX = 0, dragStartScroll = 0;
    track.addEventListener('mousedown', (e) => {
        dragStartX = e.pageX; dragStartScroll = track.scrollLeft;
        dragging = true; track.classList.add('is-dragging'); sync();
    });
    window.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const dx = e.pageX - dragStartX;
        if (Math.abs(dx) > 3) { track.scrollLeft = dragStartScroll - dx; sync(); }
    });
    window.addEventListener('mouseup', () => {
        if (!dragging) return;
        dragging = false; track.classList.remove('is-dragging'); sync();
    });
    track.addEventListener('scroll', () => {
        if (dragging || Math.abs(track.scrollLeft - applied) > 2) sync();
    }, { passive: true });

    if ('IntersectionObserver' in window) {
        new IntersectionObserver((entries) => {
            inView = entries[0].isIntersecting;
            if (inView) start(); else stop();
        }, { rootMargin: '120px 0px', threshold: 0 }).observe(section);
    } else { inView = true; start(); }
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });

    track.setAttribute('tabindex', '0');
    track.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const card = track.querySelector('.review-card');
        const gap = parseFloat(getComputedStyle(track).gap) || 0;
        const d = (card ? card.getBoundingClientRect().width : 340) + gap;
        track.scrollLeft += (e.key === 'ArrowRight' ? d : -d);
        sync();
    });
})();

(function () {
    'use strict';
    var nav = document.querySelector('.nav-desk');
    if (!nav) return;

    var ind = document.createElement('span');
    ind.className = 'nav-ind';
    ind.setAttribute('aria-hidden', 'true');
    nav.appendChild(ind);

    var links = Array.prototype.slice.call(nav.querySelectorAll('.nav-link'));
    var hovered = null;

    function activeLink() {
        return nav.querySelector('.nav-link.is-active') ||
               nav.querySelector('.nav-link[aria-current="page"]') ||
               links[0];
    }

    function place(el, instant) {
        if (!el) { ind.style.opacity = '0'; return; }
        var nb = nav.getBoundingClientRect();
        var b = el.getBoundingClientRect();
        if (!b.width || !nb.width) return;
        if (instant) ind.style.transition = 'none';
        ind.style.width = b.width + 'px';
        ind.style.transform = 'translate3d(' + (b.left - nb.left) + 'px,0,0)';
        ind.style.opacity = '1';
        ind.classList.add('is-ready');
        if (instant) { void ind.offsetWidth; ind.style.transition = ''; }
    }

    function sync(instant) { place(hovered || activeLink(), instant); }

    function markHover(el) {
        links.forEach(function (l) { l.classList.toggle('is-nav-hover', l === el); });
    }

    links.forEach(function (l) {
        l.addEventListener('mouseenter', function () { hovered = l; markHover(l); sync(false); });
        l.addEventListener('focus', function () { hovered = l; markHover(l); sync(false); });
    });
    nav.addEventListener('mouseleave', function () { hovered = null; markHover(null); sync(false); });
    nav.addEventListener('focusout', function (e) {
        if (!nav.contains(e.relatedTarget)) { hovered = null; markHover(null); sync(false); }
    });

    window.addEventListener('resize', function () { sync(true); }, { passive: true });
    window.addEventListener('load', function () { sync(true); });
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () { sync(true); });
    }
    requestAnimationFrame(function () { sync(true); });
})();

(function () {
    function hide(el) {
        if (String(el.getAttribute('src') || '').indexOf('data:') === 0) return;
        el.style.visibility = 'hidden';
        el.setAttribute('aria-hidden', 'true');
    }
    function sweep() {
        document.querySelectorAll('img').forEach(function (img) {
            if (img.src.indexOf('data:') !== 0 && img.complete && img.naturalWidth === 0) hide(img);
        });
    }
    document.addEventListener('error', function (e) {
        if (e.target && e.target.tagName === 'IMG') {
            e.target.setAttribute('data-img-broken', '1');
            hide(e.target);
        }
    }, true);
    document.addEventListener('DOMContentLoaded', sweep);
    window.addEventListener('load', sweep);

    const hashSelector = 'a[href="' + String.fromCharCode(35) + '"]';
    document.addEventListener('click', function (e) {
        const a = e.target && e.target.closest ? e.target.closest(hashSelector) : null;
        if (a) e.preventDefault();
    }, false);
})();
