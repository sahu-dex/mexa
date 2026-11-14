document.addEventListener('DOMContentLoaded', () => {
    if (window.AOS) {
        AOS.init({ duration: 800, once: true, offset: 50, throttleDelay: 100, debounceDelay: 50, disableMutationObserver: true });
    }

    /*
     * The drawer slides out from under the header and back into it.
     *
     * It is hidden by translating it by exactly its own height, not by `-100%`
     * of itself: with `top` set to the bar's bottom edge, a `-100%` shift makes
     * the element's *own box* overlap the header band, and because the menu root
     * ties the header's z-index and comes later in the DOM, the closed sheet was
     * painting over the header — its bottom 54px (the blue action button) showed
     * up where the logo should be. Shifting by (height + resting offset) instead
     * puts the closed box entirely above the viewport, so it cannot cover
     * anything, and the transition only ever moves it to and from that offset.
     *
     * The height is measured in JS because the sheet is `height: auto`: its real
     * height depends on how many page cards exist and on the text size.
     */
    const menuHeight = drawer => Math.ceil(drawer.getBoundingClientRect().height) || 0;

    // How far above its resting place the closed sheet has to sit: its own
    // height plus its resting offset under the bar (top: 62px). That puts the
    // closed sheet's bottom edge at y=0, entirely above the viewport, so at no
    // point does any part of it sit in the header's band. Measured height is
    // written as a custom property; the open position stays a plain 0, which is
    // what the CSS transition interpolates between.
    function parkDrawer(drawer) {
        var shift = menuHeight(drawer) + 62;
        drawer.style.setProperty('--mm-closed-shift', 'translateY(-' + shift + 'px)');
    }

    // Measure whenever the geometry that decides the height could have changed.
    function syncDrawerHeight() {
        const drawer = document.getElementById('mobile-menu-drawer');
        if (drawer) parkDrawer(drawer);
    }
    syncDrawerHeight();
    window.addEventListener('resize', syncDrawerHeight, { passive: true });
    window.addEventListener('orientationchange', syncDrawerHeight, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncDrawerHeight);

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
            // Park the sheet above the bar, then slide it down from there. The
            // resting offset under the bar is the sheet's own (top: 62px).
            parkDrawer(drawer);
            document.documentElement.style.overflow = 'hidden';
            document.body.style.overflow = 'hidden';
            document.body.classList.add('mm-open');
            menu.classList.remove('pointer-events-none');
            requestAnimationFrame(() => {
                backdrop.classList.remove('opacity-0');
                drawer.classList.remove('-translate-y-full');
            });
        } else {
            // Same measured distance on the way out, so the sheet cannot creep
            // back over the header while it animates.
            parkDrawer(drawer);
            backdrop.classList.add('opacity-0');
            drawer.classList.add('-translate-y-full');
            document.documentElement.style.overflow = '';
            document.body.style.overflow = '';
            document.body.classList.remove('mm-open');
            setTimeout(() => {
                menu.classList.add('pointer-events-none');
                // Hand the page back: the flag above already covers the slide,
                // this covers the moment the sheet is finally invisible.
                document.body.classList.remove('mm-open');
            }, 350);
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
        // Passive: these only stop the event bubbling to the page. A non-passive
        // touchmove/wheel listener forces the browser to wait for JavaScript
        // before it can start scrolling — the main reason a sheet felt "stuck".
        mobileDrawer.addEventListener('touchmove', (e) => { e.stopPropagation(); }, { passive: true });
        mobileDrawer.addEventListener('wheel', (e) => { e.stopPropagation(); }, { passive: true });
    }

    document.addEventListener('keydown', (ev) => {
        if (ev.key !== 'Escape') return;
        const menu = document.getElementById('mobile-menu');
        if (menu && !menu.classList.contains('pointer-events-none')) window.toggleMobileMenu();
    });

    // The "Our Services" action is not a `.mobile-nav-item`, so it does not run
    // the handler below. Close on it as well — otherwise tapping it while
    // already on the service page navigates to the same URL and the open menu
    // is still sitting there afterwards.
    document.querySelectorAll('.mm-action-button').forEach(action => {
        action.addEventListener('click', () => {
            const menu = document.getElementById('mobile-menu');
            if (menu && !menu.classList.contains('pointer-events-none')) window.toggleMobileMenu();
        });
    });

    // Tapping a menu card closes the menu. The card is still a normal link, so
    // the page navigates — the close only has to run first so the menu never
    // stays open across the navigation, and so a same-page (hash) jump is
    // visible rather than hidden behind the sheet.
    document.querySelectorAll('.mobile-nav-item').forEach(link => {
        link.addEventListener('click', (e) => {
            document.querySelectorAll('.mm-item, .mobile-nav-item').forEach(l => {
                l.classList.remove('is-active');
                l.classList.remove('active');
            });
            link.classList.add('is-active');
            link.setAttribute('aria-current', 'page');

            const menu = document.getElementById('mobile-menu');
            const isOpen = menu && !menu.classList.contains('pointer-events-none');

            const href = link.getAttribute('href');
            const hashChar = String.fromCharCode(35);
            const isHashJump = href && href.startsWith(hashChar);

            if (!isHashJump) {
                // A real navigation: close now, let the browser follow the link.
                if (isOpen) window.toggleMobileMenu();
                return;
            }

            e.preventDefault();
            if (isOpen) window.toggleMobileMenu();
            const targetEl = document.querySelector(href);
            if (targetEl) {
                // Wait for the sheet to clear before scrolling, so the jump does
                // not happen behind the closing panel.
                setTimeout(() => {
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 260);
            }
        });
    });

    // One coalesced resize pass for the whole file: resizing a window fires tens
    // of events per drag, and this handler touches the DOM each time.
    let menuResizeRaf = 0;
    window.addEventListener('resize', () => {
        if (menuResizeRaf) return;
        menuResizeRaf = requestAnimationFrame(() => {
            menuResizeRaf = 0;
            const menu = document.getElementById('mobile-menu');
            if (!menu) return;
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
        });
    }, { passive: true });

    const counters = document.querySelectorAll('.counter');
    let hasCounted = false;
    if ('IntersectionObserver' in window && counters.length) {
        const counterObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !hasCounted) {
                    hasCounted = true;
                    // One rAF loop for all four counters instead of one each, and
                    // textContent instead of innerText (innerText forces the browser
                    // to lay out the element to measure the rendered text).
                    const items = Array.from(counters).map(counter => ({
                        el: counter,
                        target: +counter.getAttribute('data-target') || 0,
                        shown: -1
                    }));
                    const duration = 1600;
                    const startTime = performance.now();
                    function updateCount(now) {
                        const progress = Math.min((now - startTime) / duration, 1);
                        const ease = 1 - Math.pow(1 - progress, 3);
                        for (const item of items) {
                            const current = progress < 1 ? Math.floor(ease * item.target) : item.target;
                            if (current === item.shown) continue;
                            item.shown = current;
                            item.el.textContent = current;
                        }
                        if (progress < 1) requestAnimationFrame(updateCount);
                    }
                    requestAnimationFrame(updateCount);
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
    // The showreel is played by the shared site-wide video player so every
    // video on the site shares one modal, one close button and one control bar.
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
        if (window.MexaVideoPlayer) {
            window.MexaVideoPlayer.open({ src: rawUrl, title: 'Showreel' });
        }
    };

    window.closeShowreel = function () {
        if (window.MexaVideoPlayer) window.MexaVideoPlayer.close();
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

    let dragStartX = 0, dragStartScroll = 0, dragRaf = 0, dragX = 0;
    // Pointer events cover mouse, pen and touch in one path, and the move sample
    // is coalesced into one write per frame: the old mousemove handler wrote
    // scrollLeft (and read it back through sync()) on every single event, which
    // is a forced layout per move. One read/write per frame instead.
    track.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch') return;          // touch pans natively
        dragStartX = e.clientX; dragStartScroll = track.scrollLeft;
        dragging = true; track.classList.add('is-dragging'); sync();
    });
    window.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        dragX = e.clientX;
        if (dragRaf) return;
        dragRaf = requestAnimationFrame(() => {
            dragRaf = 0;
            const dx = dragX - dragStartX;
            if (Math.abs(dx) > 3) { track.scrollLeft = dragStartScroll - dx; sync(); }
        });
    }, { passive: true });
    const endDrag = () => {
        if (!dragging) return;
        dragging = false; track.classList.remove('is-dragging'); sync();
    };
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    window.addEventListener('blur', endDrag);
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
    // The error listener catches images that fail from now on, so a full sweep is
    // only needed for ones that failed before it was attached. Two sweeps
    // (DOMContentLoaded + load) each walked every image on the page; one cheap
    // pass that skips already-resolved images is enough.
    function sweep() {
        var imgs = document.querySelectorAll('img');
        for (var i = 0; i < imgs.length; i++) {
            var img = imgs[i];
            if (img.getAttribute('data-img-broken')) continue;
            if (String(img.getAttribute('src') || '').indexOf('data:') === 0) continue;
            if (img.complete && img.naturalWidth === 0) hide(img);
        }
    }
    document.addEventListener('error', function (e) {
        if (e.target && e.target.tagName === 'IMG') {
            e.target.setAttribute('data-img-broken', '1');
            hide(e.target);
        }
    }, true);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', sweep);
    } else {
        sweep();
    }
    window.addEventListener('load', sweep);

    const hashSelector = 'a[href="' + String.fromCharCode(35) + '"]';
    document.addEventListener('click', function (e) {
        const a = e.target && e.target.closest ? e.target.closest(hashSelector) : null;
        if (a) e.preventDefault();
    }, false);
})();
