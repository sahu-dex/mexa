(() => {
  'use strict';

  const base = window.__MM_VIDEO_API_BASE__ || document.querySelector('meta[name="admin-base"]')?.content || `${location.origin}/`;
  const api = (path) => new URL(path, base).toString();
  let overlay;
  let stage;
  let loading;
  let errorBox;
  let lastFocus;
  let currentUrl = '';
  let currentMedia = null;
  let hlsPlayer = null;
  let hlsPromise = null;
  let savedOverflow = '';

  function ensureModal() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'mmvp';
    overlay.hidden = true;
    overlay.innerHTML = '<div class="mmvp-dialog" role="dialog" aria-modal="true" aria-label="Video preview"><button class="mmvp-close" type="button" aria-label="Close video">×</button><div class="mmvp-stage"><div class="mmvp-loading" hidden><span class="mmvp-spinner" aria-hidden="true"></span><span>Loading video…</span></div><div class="mmvp-error" role="alert" hidden></div><p class="mmvp-status" aria-live="polite"></p></div></div>';
    document.body.append(overlay);
    stage = overlay.querySelector('.mmvp-stage');
    loading = overlay.querySelector('.mmvp-loading');
    errorBox = overlay.querySelector('.mmvp-error');
    overlay.querySelector('.mmvp-close').addEventListener('click', close);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
  }

  function safeHttpUrl(value) {
    try {
      const url = new URL(String(value || ''), location.href);
      return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
  }

  function appendQuery(value, params) {
    const safe = safeHttpUrl(value);
    if (!safe) return '';
    const url = new URL(safe);
    Object.entries(params).forEach(([key, val]) => url.searchParams.set(key, String(val)));
    return url.href;
  }

  function setLoading(visible) {
    if (loading) loading.hidden = !visible;
  }

  function destroyPlayer() {
    if (hlsPlayer) {
      try { hlsPlayer.destroy(); } catch { /* Best-effort stream cleanup. */ }
      hlsPlayer = null;
    }
    if (stage) {
      stage.querySelectorAll('video').forEach((video) => {
        try { video.pause(); video.removeAttribute('src'); video.load(); } catch { /* Best-effort media cleanup. */ }
      });
      stage.querySelectorAll('iframe').forEach((frame) => frame.removeAttribute('src'));
    }
    stage?.querySelectorAll('video, iframe').forEach((node) => node.remove());
    errorBox?.replaceChildren();
    if (errorBox) errorBox.hidden = true;
    setLoading(false);
    stage?.style.removeProperty('aspect-ratio');
    overlay?.querySelector('.mmvp-dialog')?.style.removeProperty('width');
  }

  function close() {
    if (!overlay || overlay.hidden) return;
    destroyPlayer();
    overlay.hidden = true;
    document.body.classList.remove('mmvp-locked');
    document.body.style.overflow = savedOverflow;
    if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true });
  }

  function showError(message, url, retry) {
    setLoading(false);
    errorBox.replaceChildren();
    const text = document.createElement('span');
    text.textContent = message;
    errorBox.append(text);
    if (retry) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mmvp-retry';
      button.textContent = 'Retry';
      button.addEventListener('click', retry);
      errorBox.append(button);
    }
    const safe = safeHttpUrl(url);
    if (safe) {
      const link = document.createElement('a');
      link.className = 'mmvp-external';
      link.href = safe;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Open video on its host';
      errorBox.append(link);
    }
    errorBox.hidden = false;
  }

  async function loadHls() {
    if (window.Hls) return window.Hls;
    if (!hlsPromise) {
      hlsPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1';
        script.async = true;
        script.onload = () => window.Hls ? resolve(window.Hls) : reject(new Error('The streaming player did not initialize.'));
        script.onerror = () => reject(new Error('The HLS playback helper could not be loaded.'));
        document.head.append(script);
      });
    }
    return hlsPromise;
  }

  function startNativeVideo(media, source, token) {
    const video = document.createElement('video');
    video.controls = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.preload = 'metadata';
    video.controlsList = 'nodownload';
    const poster = safeHttpUrl(media.thumbnail_url);
    if (poster) video.poster = poster;
    video.addEventListener('loadedmetadata', () => {
      if (token !== currentUrl) return;
      if (video.videoWidth && video.videoHeight) {
        const ratio = video.videoWidth / video.videoHeight;
        stage.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
        if (ratio < 0.85) {
          const dialog = overlay.querySelector('.mmvp-dialog');
          const padding = parseFloat(getComputedStyle(overlay).paddingLeft) || 12;
          const maxWidth = Math.min(1180, window.innerWidth - padding * 2);
          const maxHeight = window.innerHeight - padding * 2;
          dialog.style.width = `${Math.max(220, Math.min(maxWidth, maxHeight * ratio))}px`;
        }
      }
    }, { once: true });
    video.addEventListener('canplay', () => setLoading(false), { once: true });
    video.addEventListener('waiting', () => setLoading(true));
    video.addEventListener('playing', () => setLoading(false));
    video.addEventListener('error', () => {
      if (token !== currentUrl) return;
      showError('This video could not be played. Check the link or try again.', source, () => open(media));
    });
    stage.append(video);

    if (/\.m3u8(?:$|[?#])/i.test(source) && !video.canPlayType('application/vnd.apple.mpegurl')) {
      setLoading(true);
      loadHls().then((Hls) => {
        if (token !== currentUrl || !video.isConnected) return;
        if (!Hls.isSupported()) throw new Error('This browser does not support HLS playback.');
        hlsPlayer = new Hls({ enableWorker: true });
        hlsPlayer.attachMedia(video);
        hlsPlayer.on(Hls.Events.MEDIA_ATTACHED, () => hlsPlayer?.loadSource(source));
        hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => setLoading(false));
        hlsPlayer.on(Hls.Events.ERROR, (_event, data) => {
          if (data?.fatal) showError('The HLS stream could not be loaded. Check the link and stream access, then retry.', source, () => open(media));
        });
      }).catch(() => showError('This browser could not load the HLS stream. Check the stream and try again.', source, () => open(media)));
      return;
    }

    video.src = source;
    setLoading(true);
    const play = video.play();
    if (play && typeof play.catch === 'function') play.catch(() => { /* Native controls remain available if autoplay is blocked. */ });
  }

  function safeEmbedUrl(media) {
    const embed = safeHttpUrl(media.embed_url);
    if (!embed) return '';
    const host = new URL(embed).hostname.toLowerCase();
    const allowed = ['www.youtube-nocookie.com', 'www.youtube.com', 'www.facebook.com', 'drive.google.com', 'player.vimeo.com', 'www.dailymotion.com', 'streamable.com'];
    return allowed.includes(host) ? appendQuery(embed, media.provider === 'youtube' ? { autoplay: 1, playsinline: 1, rel: 0 } : { autoplay: 1 }) : '';
  }

  function buildPlayer(media, token) {
    const original = safeHttpUrl(media.url || media.video_url);
    if (!original) {
      showError('The video link is invalid.', '', null);
      return;
    }
    const type = media.embed_type || media.embedType || media.type || '';
    const resolvedEmbed = media.embed_url || media.embedUrl || '';
    const normalized = { ...media, url: original, embed_type: type, embed_url: resolvedEmbed };
    if (type === 'iframe') {
      const source = safeEmbedUrl(normalized);
      if (!source) {
        showError('This provider cannot be embedded here. Open the video on its hosting site.', original, null);
        return;
      }
      const frame = document.createElement('iframe');
      frame.src = source;
      frame.title = 'Video player';
      frame.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen';
      frame.allowFullscreen = true;
      frame.loading = 'eager';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.addEventListener('load', () => { if (token === currentUrl) setLoading(false); }, { once: true });
      setLoading(true);
      stage.append(frame);
      return;
    }
    if (type === 'video') {
      startNativeVideo(normalized, original, token);
      return;
    }
    showError('This provider does not offer an embeddable player.', original, null);
  }

  async function resolveMedia(input) {
    if (input && typeof input === 'object' && (input.embed_type || input.embedType) && (input.embed_url || input.embedUrl || input.embed_type === 'video' || input.embedType === 'video')) {
      return input;
    }
    const source = typeof input === 'string' ? input : (input?.url || input?.video_url || '');
    const safe = safeHttpUrl(source);
    if (!safe) throw new Error('The video link is invalid.');
    const response = await fetch(api(`api/public/video-resolve?url=${encodeURIComponent(safe)}`), { headers: { Accept: 'application/json' } });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || 'This video source is not supported.');
    return { ...(typeof input === 'object' ? input : {}), ...result, url: result.url || safe };
  }

  async function open(input) {
    ensureModal();
    destroyPlayer();
    currentUrl = `open-${Date.now()}-${Math.random()}`;
    const token = currentUrl;
    currentMedia = typeof input === 'object' ? { ...input } : { url: input };
    lastFocus = document.activeElement;
    savedOverflow = document.body.style.overflow;
    overlay.hidden = false;
    document.body.classList.add('mmvp-locked');
    document.body.style.overflow = 'hidden';
    overlay.querySelector('.mmvp-close').focus({ preventScroll: true });
    setLoading(true);
    try {
      const media = await resolveMedia(currentMedia);
      if (overlay.hidden || token !== currentUrl) return;
      currentMedia = media;
      buildPlayer(media, token);
    } catch (error) {
      if (overlay.hidden || token !== currentUrl) return;
      showError(error.message || 'The video could not be loaded.', currentMedia.url || '', () => open(currentMedia));
    }
  }

  function dataMedia(trigger) {
    return {
      title: trigger.dataset.mmVideoTitle || trigger.getAttribute('aria-label') || '',
      description: '',
      url: trigger.dataset.mmVideoUrl || trigger.dataset.sv2Video || trigger.dataset.videoUrl || '',
      thumbnail_url: trigger.dataset.mmVideoPoster || trigger.dataset.videoPoster || '',
      embed_type: trigger.dataset.mmVideoType || '',
      embed_url: trigger.dataset.mmVideoEmbedUrl || '',
      provider: trigger.dataset.mmVideoProvider || '',
    };
  }

  function attachPageTriggers() {
    document.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-mm-video-url], [data-sv2-video], [data-video-url], .wk-rc, .wk-demo, .wk-short');
      if (!trigger) return;
      const media = dataMedia(trigger);
      if (!media.url && trigger.matches('.wk-rc, .wk-demo, .wk-short')) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      open(media);
    }, true);

    const openShowreel = window.openShowreel;
    window.openShowreel = function () {
      const record = (window.__MM_VIDEO_CATALOG__ || []).find((video) => (video.placements || []).some((placement) => placement.page === 'home' && placement.section === 'showreel'));
      if (record) open(record);
      else if (typeof openShowreel === 'function') openShowreel();
    };
    window.closeShowreel = function () { close(); };
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && overlay && !overlay.hidden) close();
    if (event.key === 'Tab' && overlay && !overlay.hidden) {
      const focusable = [...overlay.querySelectorAll('button:not([disabled]), a[href]')];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  });

  window.addEventListener('offline', () => {
    if (overlay && !overlay.hidden) showError('Network connection was lost. Reconnect and retry playback.', currentMedia?.url || '', () => open(currentMedia));
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attachPageTriggers, { once: true });
  else attachPageTriggers();

  window.MexaVideoPreview = { open, close, resolve: resolveMedia };
})();
