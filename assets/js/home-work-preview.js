/**
 * MEXA MOTION — Homepage Work / Shorts cards.
 *
 * Cards with a real media source open in the shared site player
 * (assets/js/mm-video-player.js). This file only maps a card to the player:
 * the player itself — close button, controls, playback — lives in one place
 * for the whole site.
 */
(function () {
    'use strict';

    // One delegated listener, even if the script is ever included twice.
    if (window.__mmHomeWorkPreview) return;
    window.__mmHomeWorkPreview = true;

    document.addEventListener('click', function (event) {
        var card = event.target && event.target.closest ? event.target.closest('.pf-card') : null;
        if (!card || !card.hasAttribute('data-mm-media')) return;

        // Keep normal browser link behaviour for new-tab / download gestures.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;

        // Without the player the card stays a normal link to its source.
        if (!window.MMPlayer) return;

        event.preventDefault();
        window.MMPlayer.open({
            kind: card.getAttribute('data-mm-kind') || 'video',
            src: card.getAttribute('data-mm-src') || '',
            embed: card.getAttribute('data-mm-embed') || '',
            type: card.getAttribute('data-mm-type') || '',
            poster: card.getAttribute('data-mm-poster') || '',
            title: card.getAttribute('data-mm-title') || '',
            vertical: card.getAttribute('data-mm-vertical') === '1',
            trigger: card
        });
    });
})();
