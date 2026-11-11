(function () {
        'use strict';
        function el(id) { return document.getElementById(id); }
        function esc(v) {
            return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) {
                return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
            });
        }
        var PAGE = 20;
        var state = { offset: 0, total: 0, loading: false, rating: 0, photo: '', photoError: '' };

        function stars(n, cls) {
            var out = '';
            for (var i = 1; i <= 5; i++) out += '<i class="fa-solid fa-star' + (i > n ? ' off' : '') + '"></i>';
            return out;
        }
        function initials(name) {
            return String(name || '?').trim().split(/\s+/).slice(0, 2).map(function (w) {
                return w.charAt(0).toUpperCase();
            }).join('');
        }
        function dateLabel(iso) {
            var d = new Date(iso);
            if (isNaN(d)) return '';
            return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        }

        /* ============================================================================
           REVIEW SECTION LOGIC (redesigned)
           · reads the existing public API when a backend is present
           · falls back to a curated 40-review demo set in the offline build
           · 20 reviews first, “See more” reveals the rest
           · submissions are validated, stored as PENDING, and shown in a popup
           ============================================================================ */
        var RVPAGE = 20;

        /* Curated demo set — used by the offline/static build (no review API).
           Shape matches the API payload: {name, role, rating, body, created_at, photo_url}. */
        var SAMPLE_REVIEWS = [
            { name: 'Arif Rahman', role: 'Founder · Dcast Media', rating: 5, body: 'Six hours of raw footage came back as a two-minute film that actually converts. Clear communication, on-time delivery and zero drama — that is rare.', created_at: '2026-10-28T09:10:00.000Z' },
            { name: 'Sanjida Parvin', role: 'Beauty brand owner', rating: 5, body: 'Our skincare demo videos finally look lit and clean. The calls to action are placed exactly where they should be, and the first drop sold out in four days.', created_at: '2026-10-21T11:25:00.000Z' },
            { name: 'Hasibul Alam', role: 'Fitness coach', rating: 5, body: 'Form-check reels with proper text overlays and one consistent look across the whole week. My clients stopped asking which clip was new.', created_at: '2026-10-16T08:40:00.000Z' },
            { name: 'Nabila Islam', role: 'Event organiser', rating: 5, body: 'They captured an entire conference day in ninety seconds without losing the atmosphere. Exactly the recap we briefed, delivered a day early.', created_at: '2026-10-09T15:05:00.000Z' },
            { name: 'Md. Arif Hossain', role: 'Facebook ads buyer', rating: 4, body: 'Four creative variations for testing, all delivered in one batch with different hooks. One revision round was needed, but the turnaround was quick.', created_at: '2026-10-02T10:15:00.000Z' },
            { name: 'Sabrina Haque', role: 'Marketing lead', rating: 5, body: 'We hand over messy brand assets and get back something that looks like a real campaign. The team asks the right questions before they start cutting.', created_at: '2026-09-27T13:30:00.000Z' },
            { name: 'Sakib Mahmud', role: 'Podcast host', rating: 5, body: 'My podcast clips were cut from the genuinely interesting moments, not random highlights. Watch time on the shorts went up almost immediately.', created_at: '2026-09-20T09:55:00.000Z' },
            { name: 'Anika Tabassum', role: 'Educator', rating: 5, body: 'Screen recordings with clean zooms and on-screen highlighting. Students stopped asking the same questions because the explanations finally land.', created_at: '2026-09-12T16:20:00.000Z' },
            { name: 'Rifat Hossain', role: 'E-commerce seller', rating: 5, body: 'The product video explained everything without a single line of on-screen text. Our sales page conversion improved within two weeks of publishing.', created_at: '2026-09-05T12:10:00.000Z' },
            { name: 'Tisha Sarker', role: 'Lifestyle blogger', rating: 5, body: 'Vertical edits for Instagram and TikTok from the same footage, with captions timed properly. I can post daily now without extra shooting.', created_at: '2026-08-29T10:45:00.000Z' },
            { name: 'Rezaul Karim', role: 'Small business owner', rating: 5, body: 'Professional work at a price a small shop can actually afford. They explained every step and never made me feel like a small client.', created_at: '2026-08-22T14:35:00.000Z' },
            { name: 'Fahim Shahriar', role: 'Agency creative', rating: 5, body: 'Reliable partner for overflow work. Files are organised, exports are labelled cleanly, and the project handover takes two minutes instead of an hour.', created_at: '2026-08-15T09:05:00.000Z' },
            { name: 'Mehjabin Chowdhury', role: 'Restaurant owner', rating: 5, body: 'Food videos that actually make people hungry. Colour grading on the dishes is superb and the pacing matches how reels should feel in 2026.', created_at: '2026-08-08T18:15:00.000Z' },
            { name: 'Tanvir Ahmed', role: 'YouTube creator · 180K', rating: 5, body: 'My retention curve changed after three videos. They cut to a rhythm instead of cutting to a beat sheet, and the pacing pass is what sold me.', created_at: '2026-08-01T11:50:00.000Z' },
            { name: 'Farhana Akter', role: 'Online course creator', rating: 4, body: 'Forty lessons edited to one clean template, chapters and lower thirds included. A couple of naming mistakes slipped through, fixed the same day.', created_at: '2026-07-25T10:20:00.000Z' },
            { name: 'Imran Kabir', role: 'Startup co-founder', rating: 5, body: 'Our investor deck video was assembled from a rough script in three days. It looked expensive — which is exactly what we needed before the raise.', created_at: '2026-07-18T13:05:00.000Z' },
            { name: 'Nusrat Jahan', role: 'Fashion brand', rating: 5, body: 'Lookbook edits that match the brand mood instead of fighting it. They asked for the colour references and used them for the whole grading pass.', created_at: '2026-07-11T15:40:00.000Z' },
            { name: 'Shahriar Kabir', role: 'Real estate marketer', rating: 5, body: 'Property walkthroughs with smooth speed ramps and readable price overlays. Enquiries doubled the month we started using these videos in ads.', created_at: '2026-07-04T09:35:00.000Z' },
            { name: 'Rumana Islam', role: 'NGO communications', rating: 5, body: 'Field footage from three districts, edited into one eight-minute documentary with subtitles. Sensitive content handled with real care and respect.', created_at: '2026-06-26T12:00:00.000Z' },
            { name: 'Ashiqur Rahman', role: 'Tech reviewer', rating: 5, body: 'B-roll, spec callouts and clean transitions — the whole package. They send a watermarked review link first, which saves a lot of back-and-forth.', created_at: '2026-06-19T17:25:00.000Z' },
            { name: 'Sumaiya Siddiqui', role: 'Wedding filmmaker', rating: 5, body: 'I outsource all my colour work to them now. Consistent skin tones across four cameras and a turnaround that keeps my own delivery promises.', created_at: '2026-06-12T10:30:00.000Z' },
            { name: 'Jahid Hasan', role: 'Gaming creator', rating: 5, body: 'Good pacing on the montage and strong sound design. I asked for a slightly longer intro on the second pass and it came back exactly as described.', created_at: '2026-06-05T19:45:00.000Z' },
            { name: 'Tahmid Chowdhury', role: 'Music producer', rating: 5, body: 'Visualisers for an album rollout in eleven days. Each track had its own mood but the whole set still looked like one release.', created_at: '2026-05-28T08:55:00.000Z' },
            { name: 'Sadia Afrin', role: 'Beauty educator', rating: 5, body: 'Tutorial edits that keep the useful parts and cut the rest. My average view duration went from forty seconds to nearly two minutes.', created_at: '2026-05-21T14:10:00.000Z' },
            { name: 'Rakibul Islam', role: 'Automobile dealer', rating: 5, body: 'Car review videos shot on a phone, edited like a commercial. The before-and-after difference convinced two of my partners to sign up.', created_at: '2026-05-14T11:05:00.000Z' },
            { name: 'Mitu Barua', role: 'Travel creator', rating: 5, body: 'A week of travel footage became four platform-ready cuts. Music licensing and aspect ratios were handled without me asking.', created_at: '2026-05-07T16:50:00.000Z' },
            { name: 'Zahidul Islam', role: 'Head of growth · SaaS', rating: 5, body: 'Product explainer in three languages, same edit template. Legal changes were applied across all versions in under a day.', created_at: '2026-04-29T09:20:00.000Z' },
            { name: 'Farzana Yasmin', role: 'Boutique owner', rating: 5, body: 'Eid campaign videos that felt premium without a big budget. The team handled everything from the storyboard to the final export.', created_at: '2026-04-22T13:45:00.000Z' },
            { name: 'Nazmul Huda', role: 'Documentary producer', rating: 5, body: 'Long-form assembly edit with a clean paper trail for every revision. That level of organisation is what makes them easy to hire again.', created_at: '2026-04-15T10:40:00.000Z' },
            { name: 'Sohana Rahman', role: 'Kids clothing brand', rating: 5, body: 'Playful edits that still look clean and premium. The first reel went past two hundred thousand views organically — a first for our page.', created_at: '2026-04-08T15:15:00.000Z' },
            { name: 'Mahmudul Hasan', role: 'Sports content page', rating: 4, body: 'Fast cuts with the right highlights, delivered within a day of each match. Occasionally the caption font is small on mobile, but they adjust on request.', created_at: '2026-03-31T20:05:00.000Z' },
            { name: 'Ishrat Jahan', role: 'Food blogger', rating: 5, body: 'Recipe shorts that are easy to follow and beautiful to watch. The recipe card overlay they designed is now part of my channel identity.', created_at: '2026-03-24T11:35:00.000Z' },
            { name: 'Sohel Rana', role: 'Furniture brand', rating: 5, body: 'Product catalogue reels with consistent lighting treatment across forty pieces. It saved us two studio days and looked better than the originals.', created_at: '2026-03-17T09:50:00.000Z' },
            { name: 'Afia Chowdhury', role: 'Legal consultant', rating: 5, body: 'Explainer videos for complicated documents, made genuinely watchable. They translated a dense brief into something my clients actually sit through.', created_at: '2026-03-10T14:20:00.000Z' },
            { name: 'Shuvo Das', role: 'Event photographer', rating: 5, body: 'Same-day recap edits that turn around while the event is still trending. Communication is quick and the pricing is honest and predictable.', created_at: '2026-03-03T18:30:00.000Z' },
            { name: 'Lamia Sultana', role: 'Handmade jewellery', rating: 5, body: 'Macro product clips with a soft luxury finish. It finally looks like the pieces cost what they cost — customers noticed immediately.', created_at: '2026-02-24T10:25:00.000Z' },
            { name: 'Rashed Khan', role: 'Digital marketing agency', rating: 5, body: 'We white-label all video work to them. Client feedback comes back handled, not forwarded, and deadlines have not slipped once in a year.', created_at: '2026-02-17T12:15:00.000Z' },
            { name: 'Tania Hossain', role: 'Yoga instructor', rating: 4, body: 'Calm, well-paced class trailers with subtle background music. Would love a faster first draft, but the final quality is worth the extra day.', created_at: '2026-02-10T08:45:00.000Z' },
            { name: 'Kamrul Islam', role: 'Electronics retailer', rating: 5, body: 'Ad creatives built for testing — different hooks, same brand feel. Our cost per purchase dropped by a third in the first campaign.', created_at: '2026-02-03T16:05:00.000Z' },
            { name: 'Priya Sharma', role: 'International client · India', rating: 5, body: 'Working across time zones was easier than with local vendors. Clear updates, tidy files, and no surprise invoices at the end.', created_at: '2026-01-27T13:55:00.000Z' }
        ];

        var rvState = {
            mode: 'demo',        /* 'demo' | 'api' */
            items: [],           /* everything loaded so far */
            shown: 0,
            total: 0,
            nextOffset: 0,
            loading: false,
            rating: 0,
            photo: '',
            photoError: ''
        };

        function rvTrimSkeletons() {
            document.querySelectorAll('#rvx-grid .rvx-skel').forEach(function (n) { n.remove(); });
        }

        function isPublicReview(review) {
            if (!review) return false;
            if (review.is_approved === 0 || review.is_approved === false || review.is_approved === '0') return false;
            var status = String(review.status || '').toLowerCase();
            return ['pending', 'rejected', 'draft', 'hidden'].indexOf(status) === -1;
        }

        function rvCardHTML(r, isNew) {
            var photo = r.photo_url
                ? '<span class="rvx-avatar"><img src="' + esc(r.photo_url) + '" alt="' + esc(r.name || 'Client') + '" loading="lazy"></span>'
                : '<span class="rvx-avatar" aria-hidden="true">' + esc(initials(r.name)) + '</span>';
            return '<article class="rvx-card' + (isNew ? ' is-new' : '') + '">' +
                '<div class="rvx-card-top">' + photo +
                    '<div class="rvx-card-id"><b>' + esc(r.name) + '</b>' +
                        (r.role ? '<small>' + esc(r.role) + '</small>' : '') + '</div>' +
                    '<span class="rvx-stars" aria-label="' + Number(r.rating || 0) + ' out of 5">' + stars(r.rating) + '</span>' +
                '</div>' +
                '<p class="rvx-card-text">' + esc(r.body) + '</p>' +
                '</article>';
        }

        function rvPaintSummary(items, stats) {
            var total = Number((stats && stats.count) || items.length) || 0;
            var sum = items.reduce(function (a, r) { return a + (Number(r.rating) || 0); }, 0);
            var five = items.filter(function (r) { return Number(r.rating) === 5; }).length;
            var avg = stats && stats.average ? Number(stats.average) : (items.length ? sum / items.length : 0);
            if (stats && typeof stats.five !== 'undefined') five = Number(stats.five) || five;

            el('rvx-avg').textContent = avg ? avg.toFixed(1) : '—';
            el('rvx-hero-stars').innerHTML = stars(Math.round(avg));
            el('rvx-five').textContent = five;
            el('rvx-count').textContent = total + ' review' + (total === 1 ? '' : 's');
            if (el('rvx-count-hero')) el('rvx-count-hero').textContent = total;
            el('rvx-meta').textContent = 'Based on ' + total + ' verified review' + (total === 1 ? '' : 's');
            ['rvx-stat-total'].forEach(function (id) { if (el(id)) el(id).textContent = total; });
            ['rvx-stat-avg'].forEach(function (id) { if (el(id)) el(id).textContent = avg ? avg.toFixed(1) : '—'; });
            ['rvx-stat-five'].forEach(function (id) { if (el(id)) el(id).textContent = five; });
        }

        function rvRender(items, append) {
            var grid = el('rvx-grid');
            rvTrimSkeletons();
            if (!append) grid.innerHTML = '';
            if (!items.length) {
                if (!append) grid.innerHTML = '<div class="rvx-empty">No reviews published yet — be the first to write one.</div>';
                return;
            }
            grid.insertAdjacentHTML('beforeend', items.map(function (r) {
                return rvCardHTML(r, append);
            }).join(''));
            rvState.shown += items.length;
        }

        function rvUpdateMore() {
            var wrap = el('rvx-more-wrap');
            var left = Math.max(0, rvState.total - rvState.shown);
            var btn = el('rvx-more');
            if (left <= 0) { wrap.hidden = true; }
            else {
                wrap.hidden = false;
                btn.disabled = false;
                btn.innerHTML = 'See more reviews <i class="fa-solid fa-chevron-down"></i>';
                el('rvx-more-note').textContent = rvState.shown + ' of ' + rvState.total + ' shown · ' + left + ' more';
            }
        }

        function rvLoadMore() {
            if (rvState.loading) return;
            var left = rvState.total - rvState.shown;
            if (left <= 0) return;
            var chunk = rvState.items.slice(rvState.shown, rvState.shown + RVPAGE);
            rvRender(chunk, true);
            rvUpdateMore();
        }

        function rvBoot() {
            /* Static demo: the curated review set is rendered locally. */
            rvState.mode = 'demo';
            rvState.items = SAMPLE_REVIEWS.slice();
            rvState.total = rvState.items.length;
            rvRender(rvState.items.slice(0, RVPAGE), false);
            rvPaintSummary(rvState.items, null);
            rvUpdateMore();
        }

        el('rvx-more').addEventListener('click', rvLoadMore);

        /* ---------- star picker ---------- */
        var RATE_LABELS = { 0: 'Choose a rating', 1: '1 star', 2: '2 stars', 3: '3 stars', 4: '4 stars', 5: '5 stars' };
        function rvPaintStars(n) {
            n = Math.max(0, Math.min(5, Number(n) || 0));
            rvState.rating = n;
            document.querySelectorAll('#rvx-rate button').forEach(function (b) {
                var value = Number(b.getAttribute('data-star'));
                b.classList.toggle('on', value <= n);
                b.setAttribute('aria-checked', value === n ? 'true' : 'false');
                b.tabIndex = (value === n || (n === 0 && value === 1)) ? 0 : -1;
            });
            el('rvx-rate-label').textContent = RATE_LABELS[n];
        }
        el('rvx-rate').addEventListener('click', function (e) {
            var b = e.target.closest('[data-star]');
            if (b) rvPaintStars(Number(b.getAttribute('data-star')));
        });
        el('rvx-rate').addEventListener('keydown', function (e) {
            var next = rvState.rating || 1;
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(5, next + 1);
            else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(1, next - 1);
            else if (e.key === 'Home') next = 1;
            else if (e.key === 'End') next = 5;
            else return;
            e.preventDefault();
            rvPaintStars(next);
            el('rvx-rate').querySelector('[data-star="' + next + '"]').focus();
        });
        rvPaintStars(0);

        /* ---------- body counter ---------- */
        el('rvx-body').addEventListener('input', function () {
            el('rvx-body-count').textContent = this.value.length + ' / 900';
        });

        /* ---------- photo: upload · live preview · change · remove ---------- */
        var photoInput = el('rvx-photo');
        function rvPhotoResetUI(hadPhoto) {
            el('rvx-photo-prev').innerHTML = '<i class="fa-solid fa-user"></i>';
            el('rvx-photo-pick').hidden = !!hadPhoto ? false : false;
            el('rvx-photo-change').hidden = true;
            el('rvx-photo-remove').hidden = true;
            el('rvx-photo-pick').innerHTML = '<i class="fa-solid fa-arrow-up-from-bracket"></i> Upload photo';
        }
        function rvPhotoShow(dataUrl) {
            el('rvx-photo-prev').innerHTML = '<img src="' + dataUrl + '" alt="Your photo preview" loading="lazy" decoding="async">';
            el('rvx-photo-pick').hidden = true;
            el('rvx-photo-change').hidden = false;
            el('rvx-photo-remove').hidden = false;
        }
        el('rvx-photo-pick').addEventListener('click', function () { photoInput.click(); });
        el('rvx-photo-change').addEventListener('click', function () { photoInput.click(); });
        el('rvx-photo-remove').addEventListener('click', function () {
            rvState.photo = '';
            rvState.photoError = '';
            photoInput.value = '';
            rvPhotoResetUI(false);
            el('rvx-err').hidden = true;
        });
        photoInput.addEventListener('change', function (e) {
            var f = e.target.files && e.target.files[0];
            var err = el('rvx-err');
            rvState.photo = '';
            rvState.photoError = '';
            if (!f) { rvPhotoResetUI(false); return; }
            var allowed = ['image/jpeg', 'image/png', 'image/webp'];
            var ext = String(f.name || '').split('.').pop().toLowerCase();
            var validMime = allowed.indexOf(f.type) !== -1 || (!f.type && ['jpg', 'jpeg', 'png', 'webp'].indexOf(ext) !== -1);
            function fail(message) {
                rvState.photoError = message;
                e.target.value = '';
                rvPhotoResetUI(false);
                err.textContent = message;
                err.hidden = false;
            }
            if (!validMime) { fail('Please choose a JPG, PNG, or WebP image.'); return; }
            if (f.size > 2 * 1024 * 1024) { fail('The photo must be 2 MB or smaller.'); return; }
            err.hidden = true;
            var reader = new FileReader();
            reader.onload = function () {
                var img = new Image();
                img.onload = function () {
                    var size = 240;
                    var c = document.createElement('canvas');
                    c.width = size; c.height = size;
                    var ctx = c.getContext('2d');
                    var side = Math.min(img.width, img.height);
                    if (!ctx || !side) { fail('That image could not be previewed. Please choose another file.'); return; }
                    ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
                    rvState.photo = c.toDataURL('image/jpeg', 0.82);
                    rvState.photoError = '';
                    rvPhotoShow(rvState.photo);
                };
                img.onerror = function () { fail('That image could not be opened. Please choose another file.'); };
                img.src = reader.result;
            };
            reader.onerror = function () { fail('The photo could not be read. Please choose another file.'); };
            reader.readAsDataURL(f);
        });

        /* ---------- pending queue (used when no backend is connected) ---------- */
        var PENDING_KEY = 'mm-pending-reviews';
        function rvSavePending(payload) { /* static demo: nothing is stored */ }

        /* ---------- submit ---------- */
        el('rvx-form').addEventListener('submit', async function (e) {
            e.preventDefault();
            var err = el('rvx-err'), btn = el('rvx-send');
            err.hidden = true;
            var payload = {
                name: el('rvx-name').value.trim(),
                role: el('rvx-role').value.trim(),
                rating: rvState.rating,
                body: el('rvx-body').value.trim(),
                photo_url: rvState.photo
            };
            function showError(msg) { err.textContent = msg; err.hidden = false; err.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
            if (!payload.rating || payload.rating < 1 || payload.rating > 5) return showError('Please select a star rating from 1 to 5.');
            if (!payload.name) return showError('Please enter your name.');
            if (payload.body.length < 15) return showError('Please write at least 15 characters so your review is useful to others.');

            btn.disabled = true;
            /* Static demo: the review is not sent and not stored anywhere. */

            el('rvx-form').reset();
            rvState.photo = '';
            rvState.photoError = '';
            rvPhotoResetUI(false);
            rvPaintStars(0);
            el('rvx-body-count').textContent = '0 / 900';
            btn.disabled = false;

            el('rvx-modal-name').textContent = payload.name.split(' ')[0] || 'there';
            el('rvx-modal').hidden = false;
            if (typeof window.__mmSetScrollLocked === 'function') window.__mmSetScrollLocked(true);
            el('rvx-modal-done').focus();
        });

        /* ---------- modal ---------- */
        function rvCloseModal() {
            el('rvx-modal').hidden = true;
            if (typeof window.__mmSetScrollLocked === 'function') window.__mmSetScrollLocked(false);
        }
        document.addEventListener('click', function (e) {
            if (e.target.closest('[data-rvx-close]')) rvCloseModal();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !el('rvx-modal').hidden) rvCloseModal();
        });

        /* ---------- boot ---------- */
        rvBoot();


    })();
