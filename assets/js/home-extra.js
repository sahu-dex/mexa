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
