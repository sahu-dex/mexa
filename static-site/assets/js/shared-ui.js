(function () {
    'use strict';

    var root = document.documentElement;
    var reducedMotion = false;
    try {
        reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (_) {}

    /* 1. Scroll lock helper on single <html> scroll container */
    function setScrollLocked(locked) {
        root.classList.toggle('mm-scroll-locked', !!locked);
    }
    window.__mmSetScrollLocked = setScrollLocked;

    /* 2. Lightweight IntersectionObserver AOS replacement (zero window scroll listeners!) */
    var aosObserver = null;
    var AOS = {
        init: function (opts) {
            var nodes = document.querySelectorAll('[data-aos]');
            if (!nodes.length) return;
            var once = !opts || opts.once !== false;
            if (reducedMotion || !('IntersectionObserver' in window)) {
                for (var i = 0; i < nodes.length; i++) {
                    nodes[i].classList.add('aos-animate');
                }
                return;
            }
            root.classList.add('mm-aos-ready');
            if (aosObserver) aosObserver.disconnect();
            var vh = window.innerHeight || root.clientHeight || 800;
            aosObserver = new IntersectionObserver(function (entries) {
                for (var j = 0; j < entries.length; j++) {
                    var entry = entries[j];
                    if (entry.isIntersecting) {
                        entry.target.classList.add('aos-animate');
                        if (once && aosObserver) aosObserver.unobserve(entry.target);
                    } else if (!once) {
                        entry.target.classList.remove('aos-animate');
                    }
                }
            }, { rootMargin: '0px 0px -40px 0px', threshold: 0.04 });

            for (var k = 0; k < nodes.length; k++) {
                var el = nodes[k];
                if (el.closest && el.closest('#home')) {
                    el.classList.add('aos-animate');
                    continue;
                }
                var delayAttr = parseInt(el.getAttribute('data-aos-delay') || '0', 10);
                if (delayAttr > 0) {
                    el.style.setProperty('--aos-delay', Math.min(delayAttr, 220) + 'ms');
                }
                var rect = el.getBoundingClientRect();
                if (rect.top < vh * 0.94 && rect.bottom > 0) {
                    el.classList.add('aos-animate');
                } else {
                    aosObserver.observe(el);
                }
            }
        },
        refresh: function () {},
        refreshHard: function () { AOS.init({ once: true }); }
    };
    window.AOS = AOS;
    AOS.init({ once: true });

    /* 3. Passive Header scroll state (writes DOM only when threshold state flips) */
    var header = document.getElementById('header');
    if (header) {
        var isScrolled = null;
        var syncHeader = function () {
            var next = (window.scrollY || window.pageYOffset || 0) > 8;
            if (next !== isScrolled) {
                isScrolled = next;
                header.classList.toggle('scrolled', next);
            }
        };
        window.addEventListener('scroll', syncHeader, { passive: true });
        syncHeader();
    }

    /* 4. Smooth same-page #anchor navigation without global CSS scroll-smooth lag */
    document.addEventListener('click', function (e) {
        var link = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
        if (!link) return;
        var href = link.getAttribute('href') || '';
        if (href === '#' || href.length < 2) {
            e.preventDefault();
            return;
        }
        var target = null;
        try { target = document.getElementById(decodeURIComponent(href.slice(1))); } catch (_) {}
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
        try { history.pushState(null, '', href); } catch (_) {}
    });

    /* 5. Language Switcher (EN / BN) */
    var i18n = {
        en: {
            'brand.tagline': 'Video Editing Agency',
            'nav.home': 'Home',
            'nav.about': 'About',
            'nav.service': 'Service',
            'nav.services': 'Services',
            'nav.work': 'Work',
            'nav.portfolio': 'Portfolio',
            'nav.review': 'Review',
            'nav.reviews': 'Reviews',
            'nav.headerTeam': 'Team',
            'nav.team': 'Our Team',
            'nav.contact': 'Contact',
            'cta.quote': 'Get a Quote',
            'menu.title': 'Navigation',
            'svc.video': 'Video Editing',
            'svc.motion': 'Motion Graphics',
            'svc.shorts': 'Reels & Shorts',
            'svc.thumb': 'Thumbnail Design',
            'svc.color': 'Color Grading'
        },
        bn: {
            'brand.tagline': 'ভিডিও এডিটিং এজেন্সি',
            'nav.home': 'হোম',
            'nav.about': 'আমাদের সম্পর্কে',
            'nav.service': 'সার্ভিস',
            'nav.services': 'সার্ভিসসমূহ',
            'nav.work': 'কাজসমূহ',
            'nav.portfolio': 'পোর্টফোলিও',
            'nav.review': 'রিভিউ',
            'nav.reviews': 'ক্লায়েন্ট রিভিউ',
            'nav.headerTeam': 'টিম',
            'nav.team': 'আমাদের টিম',
            'nav.contact': 'যোগাযোগ',
            'cta.quote': 'কোটেশন নিন',
            'menu.title': 'মেনু',
            'svc.video': 'ভিডিও এডিটিং',
            'svc.motion': 'মোশন গ্রাফিক্স',
            'svc.shorts': 'রিলস ও শর্টস',
            'svc.thumb': 'থাম্বনেইল ডিজাইন',
            'svc.color': 'কালার গ্রেডিং'
        }
    };

    function applyLanguage(lang) {
        var code = i18n[lang] ? lang : 'en';
        var dict = i18n[code];
        var items = document.querySelectorAll('[data-i18n]');
        for (var i = 0; i < items.length; i++) {
            var key = items[i].getAttribute('data-i18n');
            if (dict[key]) items[i].textContent = dict[key];
        }
        var btns = document.querySelectorAll('.lang-btn[data-lang]');
        for (var j = 0; j < btns.length; j++) {
            var active = btns[j].getAttribute('data-lang') === code;
            btns[j].classList.toggle('is-active', active);
            btns[j].setAttribute('aria-pressed', active ? 'true' : 'false');
        }
        root.setAttribute('data-ui-lang', code);
        window.__MM_LANG__ = code;
        if (typeof window.__mmSyncNavIndicator === 'function') {
            window.__mmSyncNavIndicator(true);
        }
    }

    var langBtns = document.querySelectorAll('.lang-btn[data-lang]');
    for (var lb = 0; lb < langBtns.length; lb++) {
        langBtns[lb].addEventListener('click', function () {
            applyLanguage(this.getAttribute('data-lang'));
        });
    }
    applyLanguage(window.__MM_LANG__ || 'en');

    /* 6. Mobile Menu Drawer (100% passive listeners + visibility toggle when closed) */
    var mobileMenu = document.getElementById('mobile-menu');
    var mobileDrawer = document.getElementById('mobile-menu-drawer');
    var mobileBackdrop = document.getElementById('mobile-menu-backdrop');
    var mobileToggleBtn = document.getElementById('mobile-menu-btn');
    var mobileCloseBtn = document.getElementById('mobile-menu-close');
    var isMenuOpen = false;
    var closeMenuTimer = null;

    function openMobileMenu() {
        if (!mobileMenu || !mobileDrawer || isMenuOpen) return;
        isMenuOpen = true;
        if (closeMenuTimer) { clearTimeout(closeMenuTimer); closeMenuTimer = null; }
        mobileMenu.style.visibility = 'visible';
        mobileMenu.classList.remove('pointer-events-none', 'opacity-0');
        mobileMenu.classList.add('pointer-events-auto', 'opacity-100');
        mobileMenu.setAttribute('aria-hidden', 'false');
        requestAnimationFrame(function () {
            mobileDrawer.classList.remove('translate-x-full');
            mobileDrawer.classList.add('translate-x-0');
        });
        if (mobileToggleBtn) {
            mobileToggleBtn.classList.add('is-open');
            mobileToggleBtn.setAttribute('aria-expanded', 'true');
            mobileToggleBtn.setAttribute('aria-label', 'Close Menu');
        }
        document.body.classList.add('mm-open');
        setScrollLocked(true);
    }

    function closeMobileMenu() {
        if (!mobileMenu || !mobileDrawer || !isMenuOpen) return;
        isMenuOpen = false;
        mobileDrawer.classList.remove('translate-x-0');
        mobileDrawer.classList.add('translate-x-full');
        mobileMenu.classList.remove('opacity-100');
        mobileMenu.classList.add('opacity-0');
        mobileMenu.setAttribute('aria-hidden', 'true');
        if (mobileToggleBtn) {
            mobileToggleBtn.classList.remove('is-open');
            mobileToggleBtn.setAttribute('aria-expanded', 'false');
            mobileToggleBtn.setAttribute('aria-label', 'Open Menu');
        }
        document.body.classList.remove('mm-open');
        setScrollLocked(false);
        closeMenuTimer = setTimeout(function () {
            if (!isMenuOpen && mobileMenu) {
                mobileMenu.classList.remove('pointer-events-auto');
                mobileMenu.classList.add('pointer-events-none');
                mobileMenu.style.visibility = 'hidden';
            }
        }, 320);
    }

    window.toggleMobileMenu = function () {
        if (isMenuOpen) closeMobileMenu(); else openMobileMenu();
    };

    if (mobileCloseBtn) mobileCloseBtn.addEventListener('click', closeMobileMenu);
    if (mobileBackdrop) mobileBackdrop.addEventListener('click', closeMobileMenu);
    if (mobileDrawer) {
        mobileDrawer.addEventListener('touchmove', function (e) { e.stopPropagation(); }, { passive: true });
        mobileDrawer.addEventListener('wheel', function (e) { e.stopPropagation(); }, { passive: true });
    }
    var mobileNavLinks = document.querySelectorAll('.mobile-nav-link');
    for (var mn = 0; mn < mobileNavLinks.length; mn++) {
        mobileNavLinks[mn].addEventListener('click', function () {
            var item = this;
            item.classList.add('is-tapped');
            setTimeout(function () { item.classList.remove('is-tapped'); }, 260);
            closeMobileMenu();
        });
    }
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            if (isMenuOpen) closeMobileMenu();
            if (typeof window.closeShowreel === 'function') window.closeShowreel();
        }
    });
    window.addEventListener('resize', function () {
        if (window.innerWidth >= 1024 && isMenuOpen) closeMobileMenu();
    }, { passive: true });

    /* 7. Desktop Navigation Sliding Underline Indicator */
    var nav = document.querySelector('.nav-desk');
    if (nav) {
        var ind = document.createElement('span');
        ind.className = 'nav-ind';
        ind.setAttribute('aria-hidden', 'true');
        nav.appendChild(ind);

        var navLinks = Array.prototype.slice.call(nav.querySelectorAll('.nav-link'));
        var hoveredLink = null;

        var activeNavLink = function () {
            return nav.querySelector('.nav-link.is-active') ||
                   nav.querySelector('.nav-link[aria-current="page"]') ||
                   navLinks[0];
        };

        var placeIndicator = function (el, instant) {
            if (!el) { ind.style.opacity = '0'; return; }
            var nb = nav.getBoundingClientRect();
            var b = el.getBoundingClientRect();
            if (!b.width || !nb.width) return;
            if (instant) ind.style.transition = 'none';
            ind.style.width = b.width + 'px';
            ind.style.transform = 'translate3d(' + (b.left - nb.left) + 'px,0,0)';
            ind.style.opacity = '1';
            ind.classList.add('is-ready');
            if (instant) {
                requestAnimationFrame(function () { ind.style.transition = ''; });
            }
        };

        var syncIndicator = function (instant) {
            placeIndicator(hoveredLink || activeNavLink(), instant);
        };
        window.__mmSyncNavIndicator = syncIndicator;

        var markHover = function (el) {
            for (var i = 0; i < navLinks.length; i++) {
                navLinks[i].classList.toggle('is-nav-hover', navLinks[i] === el);
            }
        };

        navLinks.forEach(function (l) {
            l.addEventListener('mouseenter', function () { hoveredLink = l; markHover(l); placeIndicator(l, false); });
            l.addEventListener('focus', function () { hoveredLink = l; markHover(l); placeIndicator(l, false); });
            l.addEventListener('blur', function () {
                if (hoveredLink === l) { hoveredLink = null; markHover(null); placeIndicator(activeNavLink(), false); }
            });
        });
        nav.addEventListener('mouseleave', function () {
            hoveredLink = null; markHover(null); placeIndicator(activeNavLink(), false);
        });
        window.addEventListener('resize', function () { syncIndicator(true); }, { passive: true });
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(function () { syncIndicator(true); });
        }
        syncIndicator(true);
    }

    /* 8. Showreel Modal & Toast Message */
    var showreelModal = document.getElementById('showreel-modal');
    var showreelContent = document.getElementById('showreel-content');
    var showreelFrame = document.getElementById('showreel-frame');

    window.openShowreel = function (videoUrl) {
        if (!showreelModal || !showreelFrame) return;
        var src = videoUrl || 'https://www.youtube.com/embed/ScMzIvxBSi4?autoplay=1&rel=0';
        showreelFrame.innerHTML = '<iframe class="w-full h-full border-0" src="' + src + '" title="MEXA MOTION Showreel" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
        showreelModal.classList.remove('pointer-events-none', 'opacity-0');
        showreelModal.classList.add('pointer-events-auto', 'opacity-100');
        if (showreelContent) {
            showreelContent.classList.remove('scale-95');
            showreelContent.classList.add('scale-100');
        }
        setScrollLocked(true);
    };

    window.closeShowreel = function () {
        if (!showreelModal || showreelModal.classList.contains('pointer-events-none')) return;
        showreelModal.classList.remove('opacity-100', 'pointer-events-auto');
        showreelModal.classList.add('opacity-0', 'pointer-events-none');
        if (showreelContent) {
            showreelContent.classList.remove('scale-100');
            showreelContent.classList.add('scale-95');
        }
        setScrollLocked(false);
        setTimeout(function () {
            if (showreelFrame) showreelFrame.innerHTML = '';
        }, 300);
    };

    var toastTimer = 0;
    window.showCustomMessage = function (msg) {
        var box = document.getElementById('custom-msg-box');
        var text = document.getElementById('custom-msg-text');
        if (!box || !text) return;
        text.innerText = msg;
        box.classList.remove('translate-x-[200%]');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
            box.classList.add('translate-x-[200%]');
        }, 4000);
    };

    var newsletterForm = document.getElementById('newsletter-form');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var emailInput = document.getElementById('newsletter-email');
            if (!emailInput || !emailInput.value.trim()) return;
            emailInput.value = '';
            window.showCustomMessage('Subscribed successfully! Welcome to MEXA MOTION.');
        });
    }

    /* 9. Static Demo Forms Notice */
    var demoTimer = 0;
    function notifyDemo(target) {
        var box = document.getElementById('custom-msg-box');
        var text = document.getElementById('custom-msg-text');
        if (box && text && target && target.closest && target.closest('footer')) {
            text.textContent = 'This is a static demo — the newsletter form is not connected.';
            box.classList.remove('translate-x-[200%]');
            clearTimeout(demoTimer);
            demoTimer = setTimeout(function () { box.classList.add('translate-x-[200%]'); }, 3200);
            return;
        }
        var note = document.getElementById('demo-notice');
        if (!note) {
            note = document.createElement('div');
            note.id = 'demo-notice';
            note.setAttribute('role', 'status');
            note.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(14px);' +
                'background:#013D73;color:#fff;font:500 13.5px/1.5 Poppins,sans-serif;padding:12px 20px;' +
                'border-radius:999px;box-shadow:0 12px 32px rgba(1,61,115,.28);z-index:100000;opacity:0;' +
                'pointer-events:none;transition:opacity .25s ease,transform .25s ease;max-width:calc(100% - 32px);text-align:center';
            document.body.appendChild(note);
        }
        note.textContent = 'This is a static demo — form submissions are disabled.';
        note.style.opacity = '1';
        note.style.transform = 'translateX(-50%) translateY(0)';
        clearTimeout(demoTimer);
        demoTimer = setTimeout(function () {
            note.style.opacity = '0';
            note.style.transform = 'translateX(-50%) translateY(14px)';
        }, 3400);
    }

    function handledInPage(form) {
        if (!form) return false;
        if (form.id === 'rvx-form' || form.id === 'tk-form' || form.id === 'newsletter-form') return true;
        var inline = form.getAttribute('onsubmit') || '';
        return /showCustomMessage|preventDefault/.test(inline);
    }

    document.addEventListener('submit', function (event) {
        event.preventDefault();
        if (handledInPage(event.target)) return;
        event.stopImmediatePropagation();
        notifyDemo(event.target);
    }, true);

    document.addEventListener('click', function (event) {
        var button = event.target && event.target.closest ? event.target.closest('[data-demo-only]') : null;
        if (!button) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        notifyDemo(button);
    }, true);

    /* 10. Social Links & Event-Driven Broken Image Guard (zero setInterval polling!) */
    var SOCIAL = {
        'fa-telegram': 'https://t.me/mexamotion',
        'fa-telegram-plane': 'https://t.me/mexamotion',
        'fa-whatsapp': 'https://wa.me/8801700000000'
    };
    var socialIcons = document.querySelectorAll('.fa-telegram, .fa-telegram-plane, .fa-whatsapp');
    for (var s = 0; s < socialIcons.length; s++) {
        var ic = socialIcons[s];
        var sKey = ic.classList.contains('fa-whatsapp') ? 'fa-whatsapp' : 'fa-telegram';
        var sLink = ic.closest ? ic.closest('a') : null;
        if (sLink && (!sLink.getAttribute('href') || sLink.getAttribute('href') === '#')) {
            sLink.setAttribute('href', SOCIAL[sKey]);
            sLink.setAttribute('target', '_blank');
            sLink.setAttribute('rel', 'noopener');
        }
    }

    function markBrokenImg(img) {
        var src = String(img.getAttribute('src') || '');
        if (!src || src.indexOf('data:') === 0) return;
        if (img.dataset && img.dataset.fallbackHandled) return;
        img.setAttribute('data-img-broken', '1');
        img.style.visibility = 'hidden';
        img.setAttribute('aria-hidden', 'true');
    }

    document.addEventListener('error', function (e) {
        var target = e.target;
        if (!target || target.tagName !== 'IMG') return;
        if (target.dataset && target.dataset.wkCardImg) return;
        markBrokenImg(target);
    }, true);

    var allImgs = document.images;
    for (var im = 0; im < allImgs.length; im++) {
        var curImg = allImgs[im];
        if (curImg.complete && curImg.naturalWidth === 0 && curImg.getAttribute('src')) {
            if (!(curImg.dataset && curImg.dataset.wkCardImg)) markBrokenImg(curImg);
        }
    }
})();
