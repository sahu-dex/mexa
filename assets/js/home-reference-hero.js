(function () {
    const banner = document.querySelector('#home .ref-hero-image img');
    if (banner) {
        function useFallback() {
            const fallback = banner.dataset.fallback;
            if (!fallback) return;
            delete banner.dataset.fallback;
            banner.addEventListener('load', function restore() {
                banner.style.visibility = '';
                banner.removeAttribute('aria-hidden');
                banner.removeEventListener('load', restore);
            });
            banner.src = fallback;
        }
        banner.addEventListener('error', useFallback);
        if (banner.complete && !banner.naturalWidth) useFallback();
    }
    const text = document.getElementById('ref-hero-typed');
    if (!text || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const phrases = [text.dataset.initial || 'THAT GROW YOUR BRAND', 'THAT GO VIRAL', 'THAT ENGAGE VIEWERS', 'THAT TELL STORIES'];
    let index = 0, length = phrases[0].length, erasing = true;
    function tick() {
        const phrase = phrases[index];
        if (erasing) {
            length--;
            text.textContent = phrase.slice(0, length);
            if (length <= 0) { erasing = false; index = (index + 1) % phrases.length; setTimeout(tick, 600); return; }
            setTimeout(tick, 50);
        } else {
            length++;
            text.textContent = phrases[index].slice(0, length);
            if (length >= phrases[index].length) { erasing = true; setTimeout(tick, 2000); return; }
            setTimeout(tick, 100);
        }
    }
    setTimeout(tick, 3500);
})();
