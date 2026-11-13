'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const player = require('../assets/js/mm-video-player.js');
const { clamp, formatTime, safeUrl, youtubeId, youtubeStart, vimeoRef, isFacebookUrl, isImageUrl, withParams, youtubeEmbedUrl, vimeoEmbedUrl, facebookEmbedUrl, resolveSource } = player;

test('time read-out is formatted like a video player', () => {
    assert.equal(formatTime(0), '0:00');
    assert.equal(formatTime(5), '0:05');
    assert.equal(formatTime(59.9), '0:59');
    assert.equal(formatTime(65), '1:05');
    assert.equal(formatTime(600), '10:00');
    assert.equal(formatTime(3599), '59:59');
    assert.equal(formatTime(3600), '1:00:00');
    assert.equal(formatTime(3725), '1:02:05');
    assert.equal(formatTime('75'), '1:15');
    for (const bad of [NaN, -4, Infinity, null, undefined, 'abc']) assert.equal(formatTime(bad), '0:00');
});

test('clamp keeps seek and volume values inside their range', () => {
    assert.equal(clamp(5, 0, 10), 5);
    assert.equal(clamp(-1, 0, 10), 0);
    assert.equal(clamp(11, 0, 10), 10);
    assert.equal(clamp('7', 0, 10), 7);
    assert.equal(clamp(NaN, 0, 10), 0);
    assert.equal(clamp(Infinity, 0, 10), 0);
});

test('only http(s) and site-relative addresses are ever used', () => {
    for (const ok of ['uploads/videos/a.mp4', '/uploads/a.mp4', '../a.mp4', '//cdn.example.com/a.mp4', 'https://a/b', 'HTTP://A/B', 'watch?v=1&t=1:30']) {
        assert.equal(safeUrl(ok), ok);
    }
    assert.equal(safeUrl('  https://a/b  '), 'https://a/b');
    for (const bad of ['javascript:alert(1)', ' JaVaScRiPt:alert(1)', 'java\tscript:alert(1)', 'java\nscript:alert(1)', '\u0001javascript:alert(1)', 'data:text/html,<b>x</b>', 'vbscript:x', 'blob:https://a/1', 'file:///etc/passwd', 'mailto:a@b.c']) {
        assert.equal(safeUrl(bad), '', JSON.stringify(bad));
    }
    assert.equal(safeUrl(null), '');
    assert.equal(safeUrl(undefined), '');

    // An unsafe address never becomes something to play, embed or link to.
    for (const item of [
        { src: 'javascript:alert(1)' },
        { embed: 'javascript:alert(1)', type: 'iframe' },
        { src: 'java\tscript:alert(1)', type: 'link' },
        { src: 'data:text/html,x', kind: 'image' },
    ]) {
        const resolved = resolveSource(item);
        assert.equal(resolved.provider, 'none', JSON.stringify(item));
        assert.equal(resolved.url, '');
        assert.equal(resolved.externalUrl, '');
    }
    assert.equal(resolveSource({ src: 'a.mp4', poster: 'javascript:alert(1)' }).poster, '');
});

test('YouTube links of every shape are recognised', () => {
    const id = 'aqz-KE-bpKQ';
    for (const url of [
        `https://www.youtube.com/watch?v=${id}`,
        `https://www.youtube.com/watch?feature=share&v=${id}&t=10`,
        `https://m.youtube.com/watch?v=${id}`,
        `https://music.youtube.com/watch?v=${id}`,
        `https://youtu.be/${id}?t=42`,
        `https://www.youtube.com/shorts/${id}`,
        `https://www.youtube.com/embed/${id}?rel=0`,
        `https://www.youtube-nocookie.com/embed/${id}`,
        `https://www.youtube.com/live/${id}?feature=share`,
    ]) {
        assert.equal(youtubeId(url), id, url);
    }
    for (const url of ['https://www.youtube.com/embed/videoseries?list=PL123', 'https://www.youtube.com/@channel', 'https://vimeo.com/76979871', 'uploads/videos/a.mp4', '', null]) {
        assert.equal(youtubeId(url), '', String(url));
    }

    assert.equal(youtubeStart('https://youtu.be/abcdefghijk?t=90'), 90);
    assert.equal(youtubeStart('https://youtu.be/abcdefghijk?t=1m30s'), 90);
    assert.equal(youtubeStart('https://youtu.be/abcdefghijk?list=1&t=15s'), 15);
    assert.equal(youtubeStart('https://www.youtube.com/watch?v=abcdefghijk&start=45'), 45);
    assert.equal(youtubeStart('https://www.youtube.com/watch?v=abcdefghijk#t=2h3m4s'), 7384);
    assert.equal(youtubeStart('https://www.youtube.com/watch?v=abcdefghijk'), 0);
    assert.equal(youtubeStart('https://youtu.be/abcdefghijk?t=abc'), 0);
});

test('Vimeo, Facebook and image addresses are recognised', () => {
    assert.deepEqual(vimeoRef('https://vimeo.com/76979871'), { id: '76979871', hash: '' });
    assert.deepEqual(vimeoRef('https://player.vimeo.com/video/76979871?h=abc123'), { id: '76979871', hash: 'abc123' });
    assert.deepEqual(vimeoRef('https://vimeo.com/76979871/abc123def'), { id: '76979871', hash: 'abc123def' });
    assert.deepEqual(vimeoRef('https://vimeo.com/channels/staffpicks/76979871'), { id: '76979871', hash: '' });
    assert.deepEqual(vimeoRef('https://vimeo.com/groups/name/videos/76979871'), { id: '76979871', hash: '' });
    for (const url of ['https://vimeo.com/user123', 'https://example.com/vimeo.com', 'https://www.youtube.com/watch?v=x', '']) {
        assert.equal(vimeoRef(url), null, url);
    }

    for (const url of ['https://www.facebook.com/facebook/videos/10153231379946729/', 'https://fb.watch/abc123/', 'https://m.facebook.com/watch/?v=1', '//www.facebook.com/x/videos/1', 'facebook.com/x/videos/1']) {
        assert.equal(isFacebookUrl(url), true, url);
    }
    for (const url of ['https://notfacebook.com/videos/1', 'https://example.com/?u=facebook.com', 'uploads/videos/facebook.com.mp4', '']) {
        assert.equal(isFacebookUrl(url), false, url);
    }

    for (const url of ['uploads/images/a.jpg', 'a.JPEG?x=1', 'a.png#frag', 'a.webp', 'a.gif', 'a.avif']) assert.equal(isImageUrl(url), true, url);
    for (const url of ['a.mp4', 'a.jpg.mp4', 'https://x/y.webm', '', null]) assert.equal(isImageUrl(url), false, String(url));
});

test('embed addresses are built for each provider', () => {
    assert.equal(withParams('https://a/b', { autoplay: 1 }), 'https://a/b?autoplay=1');
    assert.equal(withParams('https://a/b?x=1', { autoplay: 1 }), 'https://a/b?x=1&autoplay=1');
    assert.equal(withParams('https://a/b?autoplay=0&x=1#t=5', { autoplay: 1 }), 'https://a/b?autoplay=1&x=1#t=5');
    assert.equal(withParams('https://a/b', { title: 'a b&c' }), 'https://a/b?title=a%20b%26c');
    assert.equal(withParams('', { autoplay: 1 }), '');

    // Fallback embed: YouTube keeps its own controls.
    const plain = new URL(youtubeEmbedUrl('aqz-KE-bpKQ', { start: 42 }));
    assert.equal(plain.origin + plain.pathname, 'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ');
    assert.equal(plain.searchParams.get('autoplay'), '1');
    assert.equal(plain.searchParams.get('playsinline'), '1');
    assert.equal(plain.searchParams.get('start'), '42');
    assert.equal(plain.searchParams.has('controls'), false);
    assert.equal(plain.searchParams.has('enablejsapi'), false);

    // API embed: YouTube's bar is switched off and ours drives the video.
    const api = new URL(youtubeEmbedUrl('aqz-KE-bpKQ', { api: true, origin: 'https://mexa.example' }));
    assert.equal(api.origin + api.pathname, 'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ');
    assert.equal(api.searchParams.get('controls'), '0');
    assert.equal(api.searchParams.get('enablejsapi'), '1');
    assert.equal(api.searchParams.get('origin'), 'https://mexa.example');
    assert.equal(api.searchParams.get('autoplay'), '1');
    assert.equal(api.searchParams.get('playsinline'), '1');
    assert.ok(api.searchParams.get('widgetid'));
    assert.equal(new URL(youtubeEmbedUrl('aqz-KE-bpKQ', { api: true })).searchParams.has('origin'), false);

    const vimeo = new URL(vimeoEmbedUrl({ id: '76979871', hash: 'abc123' }));
    assert.equal(vimeo.origin + vimeo.pathname, 'https://player.vimeo.com/video/76979871');
    assert.equal(vimeo.searchParams.get('autoplay'), '1');
    assert.equal(vimeo.searchParams.get('playsinline'), '1');
    assert.equal(vimeo.searchParams.get('h'), 'abc123');
    // No title / author overlay inside the frame.
    assert.equal(vimeo.searchParams.get('title'), '0');
    assert.equal(vimeo.searchParams.get('byline'), '0');
    assert.equal(vimeo.searchParams.get('portrait'), '0');
    assert.equal(new URL(vimeoEmbedUrl({ id: '76979871', hash: '' })).searchParams.has('h'), false);

    const facebook = new URL(facebookEmbedUrl('https://www.facebook.com/facebook/videos/10153231379946729/'));
    assert.equal(facebook.origin + facebook.pathname, 'https://www.facebook.com/plugins/video.php');
    assert.equal(facebook.searchParams.get('href'), 'https://www.facebook.com/facebook/videos/10153231379946729/');
    assert.equal(facebook.searchParams.get('show_text'), 'false');
});

test('every kind of work item is routed to the right player mode', () => {
    const mode = item => resolveSource(item).provider;

    // Uploaded files → our own controls.
    assert.deepEqual(resolveSource({ src: 'uploads/videos/a.mp4', poster: 'p.jpg', title: 'T' }), {
        provider: 'file', url: 'uploads/videos/a.mp4', externalUrl: 'uploads/videos/a.mp4', vertical: false, poster: 'p.jpg', title: 'T',
    });
    assert.equal(mode({ src: 'uploads/videos/a.webm' }), 'file');
    assert.equal(mode({ src: 'https://cdn.example.com/clip.mov?token=1' }), 'file');
    assert.equal(resolveSource({ src: 'uploads/videos/a.mp4', vertical: true }).vertical, true);

    // YouTube in any form; Shorts are always vertical.
    const watch = resolveSource({ src: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=30' });
    assert.equal(watch.provider, 'youtube');
    assert.equal(watch.id, 'aqz-KE-bpKQ');
    assert.equal(watch.start, 30);
    assert.equal(watch.vertical, false);
    assert.equal(watch.externalUrl, 'https://www.youtube.com/watch?v=aqz-KE-bpKQ');
    const short = resolveSource({ src: 'https://www.youtube.com/shorts/ZZ5LpwO-An4' });
    assert.equal(short.provider, 'youtube');
    assert.equal(short.vertical, true);
    assert.equal(resolveSource({ src: 'https://youtu.be/dQw4w9WgXcQ', vertical: true }).vertical, true);

    // A stored embed address wins over the plain link.
    const stored = resolveSource({ src: 'https://www.youtube.com/watch?v=yWyI9QjGmrs', embed: 'https://www.youtube-nocookie.com/embed/yWyI9QjGmrs', type: 'iframe' });
    assert.equal(stored.provider, 'youtube');
    assert.equal(stored.id, 'yWyI9QjGmrs');
    assert.equal(resolveSource({ src: 'uploads/videos/a.mp4', embed: 'https://vimeo.com/76979871' }).provider, 'vimeo');

    const vimeo = resolveSource({ src: 'https://vimeo.com/76979871' });
    assert.equal(vimeo.provider, 'vimeo');
    assert.equal(vimeo.id, '76979871');
    assert.equal(mode({ src: 'https://www.facebook.com/facebook/videos/10153231379946729/' }), 'facebook');

    const frame = resolveSource({ embed: 'https://player.example.com/embed/9', type: 'iframe' });
    assert.equal(frame.provider, 'iframe');
    assert.equal(frame.url, 'https://player.example.com/embed/9');
    assert.equal(mode({ embed: 'https://player.example.com/embed/9' }), 'iframe');

    // Image-only items open as a still, whatever the address looks like.
    assert.equal(mode({ src: 'uploads/images/a.jpg', kind: 'image' }), 'image');
    assert.equal(mode({ src: 'uploads/images/a.webp' }), 'image');
    assert.equal(mode({ src: 'https://youtu.be/dQw4w9WgXcQ', kind: 'image' }), 'image');
    assert.equal(resolveSource({ kind: 'image', poster: 'uploads/images/p.jpg' }).url, 'uploads/images/p.jpg');

    // External "link" items show a button instead of trying to embed the page.
    const link = resolveSource({ src: 'https://example.com/watch/42', type: 'link', provider: 'Example Host' });
    assert.equal(link.provider, 'link');
    assert.equal(link.url, 'https://example.com/watch/42');
    assert.equal(link.label, 'Example Host');

    // Nothing attached → a message, never a broken player.
    for (const empty of [{}, undefined, null, { src: '   ' }, { kind: 'image' }, { type: 'link' }]) {
        assert.equal(mode(empty), 'none', JSON.stringify(empty));
    }
});
