(function () {
    var el = document.getElementById('hero-character');
    if (!el) return;
    function block(e) { e.preventDefault(); }
    el.addEventListener('contextmenu', block);
    el.addEventListener('dragstart', block);
    el.addEventListener('selectstart', block);
    function release() { el.classList.remove('is-touch'); }
    el.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'touch' || e.pointerType === 'pen') el.classList.add('is-touch');
    }, { passive: true });
    el.addEventListener('pointerup', release, { passive: true });
    el.addEventListener('pointercancel', release, { passive: true });
    el.addEventListener('pointerleave', release, { passive: true });
    window.addEventListener('blur', release, { passive: true });
})();

/* Client photos can be remote URLs. If one cannot load, fall back to the
   reviewer's initial so the review card never shows an empty avatar. */
(function () {
    var avatars = document.querySelectorAll('#reviews .rv-avatar');
    if (!avatars.length) return;
    function swapToInitial(img) {
        if (!img || img.tagName !== 'IMG' || !img.parentNode) return;
        var name = (img.getAttribute('alt') || '?').trim();
        var initial = name.charAt(0).toUpperCase() || '?';
        var fallback = document.createElement('div');
        fallback.className = img.className;
        fallback.textContent = initial;
        fallback.setAttribute('aria-hidden', 'true');
        img.parentNode.replaceChild(fallback, img);
    }
    avatars.forEach(function (img) {
        if (img.tagName !== 'IMG') return;
        if (img.complete && img.naturalWidth === 0) {
            swapToInitial(img);
            return;
        }
        img.addEventListener('error', function () { swapToInitial(img); }, { once: true });
    });
})();
