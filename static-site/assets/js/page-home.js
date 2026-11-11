(function () {
    'use strict';

    /* 1. Active Section Highlighting */
    var sections = document.querySelectorAll('section[id]');
    var navLinks = document.querySelectorAll('.nav-link[href^="#"], .mobile-nav-link[href^="#"]');
    if (sections.length && navLinks.length && 'IntersectionObserver' in window) {
        var secObserver = new IntersectionObserver(function (entries) {
            var changed = false;
            for (var i = 0; i < entries.length; i++) {
                if (entries[i].isIntersecting) {
                    var id = '#' + entries[i].target.id;
                    for (var j = 0; j < navLinks.length; j++) {
                        var active = navLinks[j].getAttribute('href') === id;
                        navLinks[j].classList.toggle('is-active', active);
                    }
                    changed = true;
                }
            }
            if (changed && typeof window.__mmSyncNavIndicator === 'function') {
                window.__mmSyncNavIndicator(false);
            }
        }, { rootMargin: '-35% 0px -55% 0px', threshold: 0 });
        for (var s = 0; s < sections.length; s++) secObserver.observe(sections[s]);
    }

    /* 2. Animated Number Counters */
    var statsSection = document.getElementById('stats-container');
    var counters = document.querySelectorAll('.counter');
    if (statsSection && counters.length && 'IntersectionObserver' in window) {
        var counted = false;
        var statsObserver = new IntersectionObserver(function (entries) {
            if (entries[0].isIntersecting && !counted) {
                counted = true;
                statsObserver.disconnect();
                counters.forEach(function (counter) {
                    var target = +(counter.getAttribute('data-target') || 0);
                    var start = performance.now();
                    var duration = 1400;
                    var tick = function (now) {
                        var p = Math.min(1, (now - start) / duration);
                        var eased = 1 - Math.pow(1 - p, 3);
                        counter.textContent = String(Math.round(target * eased));
                        if (p < 1) requestAnimationFrame(tick);
                        else counter.textContent = String(target);
                    };
                    requestAnimationFrame(tick);
                });
            }
        }, { threshold: 0.35 });
        statsObserver.observe(statsSection);
    }

    /* 3. Portfolio Category Tabs */
    var tabVideos = document.getElementById('tab-videos');
    var tabShorts = document.getElementById('tab-shorts');
    var gridVideos = document.getElementById('grid-videos');
    var gridShorts = document.getElementById('grid-shorts');

    function activatePortfolioTab(type) {
        if (!tabVideos || !tabShorts || !gridVideos || !gridShorts) return;
        var isVideos = type === 'videos';
        tabVideos.classList.toggle('is-active', isVideos);
        tabVideos.setAttribute('aria-selected', isVideos ? 'true' : 'false');
        tabShorts.classList.toggle('is-active', !isVideos);
        tabShorts.setAttribute('aria-selected', !isVideos ? 'true' : 'false');
        gridVideos.classList.toggle('hidden', !isVideos);
        gridShorts.classList.toggle('hidden', isVideos);
    }
    if (tabVideos && tabShorts) {
        tabVideos.addEventListener('click', function () { activatePortfolioTab('videos'); });
        tabShorts.addEventListener('click', function () { activatePortfolioTab('shorts'); });
    }

    /* 4. FAQ Accordion */
    var faqBtns = document.querySelectorAll('.faq-btn');
    faqBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            var content = btn.nextElementSibling;
            var icon = btn.querySelector('i');
            var isOpen = content && !content.classList.contains('hidden');
            document.querySelectorAll('.faq-content').forEach(function (c) { c.classList.add('hidden'); });
            document.querySelectorAll('.faq-btn i').forEach(function (ic) { ic.classList.remove('rotate-180'); });
            if (!isOpen && content) {
                content.classList.remove('hidden');
                if (icon) icon.classList.add('rotate-180');
            }
        });
    });

    /* 5. Hero Character Touch Feedback */
    var heroChar = document.getElementById('hero-character');
    if (heroChar) {
        var hcTimer = null;
        heroChar.addEventListener('touchstart', function () {
            heroChar.classList.add('is-lifted');
            if (hcTimer) clearTimeout(hcTimer);
            hcTimer = setTimeout(function () { heroChar.classList.remove('is-lifted'); }, 650);
        }, { passive: true });
    }

    /* 6. Zero-Layout-Thrash Client Reviews Auto-Glide (pauses automatically during vertical page scroll!) */
    var section = document.getElementById('reviews');
    var track = section ? section.querySelector('.reviews-container') : null;
    if (!track) return;

    var reducedMotion = false;
    try {
        reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (_) {}
    if (reducedMotion) return;

    var originals = Array.prototype.slice.call(track.children);
    if (originals.length >= 2 && !track.dataset.cloned) {
        track.dataset.cloned = '1';
        var frag = document.createDocumentFragment();
        originals.forEach(function (card) {
            var clone = card.cloneNode(true);
            clone.setAttribute('aria-hidden', 'true');
            clone.dataset.rvClone = '1';
            clone.querySelectorAll('a, button, input, [tabindex]').forEach(function (el) {
                el.setAttribute('tabindex', '-1');
            });
            frag.appendChild(clone);
        });
        track.appendChild(frag);
    }

    var halfWidth = 0;
    var pos = 0;
    var appliedInt = 0;
    var lastTs = 0;
    var rafId = 0;
    var inView = false;
    var hovered = false;
    var pointerActive = false;
    var focused = false;
    var pageScrolling = false;
    var userHoldUntil = 0;
    var pageScrollTimer = 0;
    var SPEED = 34;

    function measure() {
        halfWidth = originals.length >= 2
            ? Math.floor(track.scrollWidth / 2)
            : Math.max(0, track.scrollWidth - track.clientWidth);
    }

    function canAnimate(now) {
        return inView &&
            !document.hidden &&
            !hovered &&
            !pointerActive &&
            !focused &&
            !pageScrolling &&
            halfWidth > 20 &&
            now >= userHoldUntil;
    }

    function step(ts) {
        if (!canAnimate(ts)) {
            rafId = 0;
            lastTs = 0;
            return;
        }
        if (!lastTs) lastTs = ts;
        var dt = Math.min(48, ts - lastTs);
        lastTs = ts;

        pos += (SPEED * dt) / 1000;
        if (pos >= halfWidth) pos -= halfWidth;

        var nextInt = Math.round(pos);
        if (nextInt !== appliedInt) {
            appliedInt = nextInt;
            track.scrollLeft = nextInt;
        }
        rafId = requestAnimationFrame(step);
    }

    function startLoop() {
        if (!rafId && canAnimate(performance.now())) {
            lastTs = 0;
            rafId = requestAnimationFrame(step);
        }
    }

    function stopLoop() {
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = 0;
        }
        lastTs = 0;
    }

    function holdAfterManualInteraction(ms) {
        userHoldUntil = performance.now() + (ms || 1600);
        stopLoop();
        setTimeout(function () {
            pos = track.scrollLeft;
            appliedInt = Math.round(pos);
            startLoop();
        }, (ms || 1600) + 20);
    }

    /* Pause horizontal scroll mutations whenever the user is scrolling the page vertically */
    window.addEventListener('scroll', function () {
        pageScrolling = true;
        stopLoop();
        clearTimeout(pageScrollTimer);
        pageScrollTimer = setTimeout(function () {
            pageScrolling = false;
            startLoop();
        }, 150);
    }, { passive: true });

    track.addEventListener('mouseenter', function () { hovered = true; stopLoop(); });
    track.addEventListener('mouseleave', function () { hovered = false; startLoop(); });
    track.addEventListener('pointerdown', function () { pointerActive = true; stopLoop(); }, { passive: true });

    function endPointer() {
        if (!pointerActive) return;
        pointerActive = false;
        pos = track.scrollLeft;
        appliedInt = Math.round(pos);
        holdAfterManualInteraction(1400);
    }
    window.addEventListener('pointerup', endPointer, { passive: true });
    window.addEventListener('pointercancel', endPointer, { passive: true });
    track.addEventListener('touchstart', function () { pointerActive = true; stopLoop(); }, { passive: true });
    track.addEventListener('touchend', function () {
        pointerActive = false;
        pos = track.scrollLeft;
        appliedInt = Math.round(pos);
        holdAfterManualInteraction(1500);
    }, { passive: true });
    track.addEventListener('wheel', function (e) {
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
            holdAfterManualInteraction(1400);
        }
    }, { passive: true });
    track.addEventListener('focusin', function () { focused = true; stopLoop(); });
    track.addEventListener('focusout', function () { focused = false; startLoop(); });

    document.addEventListener('visibilitychange', function () {
        if (document.hidden) stopLoop(); else startLoop();
    });

    if ('IntersectionObserver' in window) {
        var rvIo = new IntersectionObserver(function (entries) {
            inView = entries[0].isIntersecting;
            if (inView) {
                if (!halfWidth) measure();
                startLoop();
            } else {
                stopLoop();
            }
        }, { threshold: 0.05 });
        rvIo.observe(section);
    } else {
        inView = true;
    }

    window.addEventListener('resize', measure, { passive: true });
    window.addEventListener('load', function () {
        measure();
        startLoop();
    }, { once: true });
    measure();
})();
