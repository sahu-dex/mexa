(function () {
    'use strict';
    var DATA = window.__MM_DEMO_DATA__ || {};
    function money(price, currency) {
        var cur = String(currency || 'USD').toUpperCase();
        var sym = cur === 'USD' ? '$' : cur === 'BDT' ? '৳' : cur === 'EUR' ? '€' : cur + ' ';
        var n = Number(price);
        if (!isFinite(n)) return '—';
        return sym + (n % 1 === 0 ? String(n) : n.toFixed(2));
    }
    function normalizeService(raw) {
        if (!raw) return null;
        if (raw.media && raw.features && raw.label) return raw;
        var fileUrl = raw.file_path || raw.main_video_url || raw.image_url || '';
        var thumbUrl = raw.thumbnail_path || raw.video_thumbnail || '';
        var isImage = /\.(jpe?g|png|webp|gif)(\?|$)/i.test(fileUrl) || raw.embed_type === 'image';
        var feats = Array.isArray(raw.features)
            ? raw.features
            : String(raw.bullet_points || '').split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
        return Object.assign({}, raw, {
            label: raw.label || raw.category || 'Editing',
            description: raw.long_description || raw.description || '',
            shortDescription: raw.description || '',
            features: feats,
            media: isImage
                ? { type: 'image', imageUrl: fileUrl || thumbUrl, thumbnail: thumbUrl }
                : {
                    type: fileUrl ? 'video' : (thumbUrl ? 'image' : 'none'),
                    videoUrl: fileUrl,
                    imageUrl: thumbUrl,
                    thumbnail: thumbUrl,
                    embedType: raw.embed_type || raw.main_video_embed_type || 'video',
                    embedUrl: raw.main_video_embed_url || fileUrl,
                    provider: raw.embed_provider || raw.main_video_provider || ''
                }
        });
    }
    function services() {
        return (DATA.services || []).map(normalizeService).filter(Boolean);
    }
    function packagesFor(serviceId) {
        var rows = (DATA.packages || []).filter(function (p) {
            return String(p.serviceId) === String(serviceId);
        });
        var rank = { premium: 1, high: 2, normal: 3 };
        return rows.sort(function (a, b) { return (rank[a.quality] || 9) - (rank[b.quality] || 9); });
    }
    function packageOf(serviceId, quality) {
        var rows = packagesFor(serviceId);
        for (var i = 0; i < rows.length; i++) if (rows[i].quality === quality) return rows[i];
        return rows[0] || null;
    }
    window.MMStore = {
        money: money,
        QUALITIES: [
            { key: 'premium', name: 'Premium Quality' },
            { key: 'high', name: 'High Quality' },
            { key: 'normal', name: 'Normal Quality' }
        ],
        catalog: {
            ensure: function () { return { services: services(), packages: DATA.packages || [] }; },
            services: services,
            service: function (id) {
                var list = services();
                for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) return list[i];
                return list[0] || null;
            },
            packagesFor: packagesFor,
            package: packageOf
        }
    };
})();
