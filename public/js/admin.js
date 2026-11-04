(() => {
  'use strict';

  const base = document.querySelector('meta[name="admin-base"]')?.content || '/';
  const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
  const api = (path) => new URL(path, base).toString();
  const role = document.querySelector('meta[name="admin-role"]')?.content || 'owner';
  const isOwner = role === 'owner';
  const state = { sections: {}, images: [], videos: [], videoPlacements: [], videoPage: 1, moderators: [], selected: null, editing: null, focusedUrl: null, previewPage: 'home' };
  const panelNames = { overview: 'Overview', home: 'Home Page Management', services: 'Services', packages: 'Packages', team: 'Team & founder', portfolio: 'Work & videos', 'video-library': 'Video library', reviews: 'Client reviews', approvals: 'Approvals', bookings: 'Booking tickets', settings: 'Site settings', access: 'Access & roles', 'page-editor': 'Visual page editor', media: 'Media library' };
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function toast(message, error = false) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.toggle('error', error);
    el.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('show'), 2900);
  }

  async function request(path, options = {}) {
    const response = await fetch(api(path), {
      credentials: 'same-origin',
      ...options,
      headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrf, ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(options.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `Request failed (${response.status}).`);
    return data;
  }

  async function loadState() {
    try {
      const result = await request('api/admin/state');
      state.sections = result.sections || {};
      state.images = result.images || [];
      if (isOwner) {
        const videos = await request('api/admin/videos');
        state.videos = videos.videos || [];
      }
      renderAll();
      if (!isOwner) {
        $$('.nav-item').forEach((item) => { item.hidden = !['approvals'].includes(item.dataset.view); });
        openPanel('approvals');
        loadApprovals();
      }
    } catch (error) {
      toast(error.message, true);
    }
  }

  async function saveSection(section, message = 'Changes saved and published.') {
    try {
      await request(`api/admin/state/${encodeURIComponent(section)}`, { method: 'PUT', body: JSON.stringify({ payload: state.sections[section] }) });
      toast(message);
      renderOverview();
    } catch (error) {
      toast(error.message, true);
    }
  }

  function openPanel(name) {
    $$('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === name));
    $$('.view-panel').forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === name));
    $('#page-title').textContent = panelNames[name] || name;
    $('#sidebar').classList.remove('open');
    if (name === 'page-editor') loadPreview();
    if (name === 'media') loadImages();
    if (name === 'video-library') loadVideos();
    if (name === 'approvals') loadApprovals();
    if (name === 'access') renderModerators();
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  function titleOf(row, index) {
    return row?.name || row?.title || row?.serviceName || row?.packageName || row?.ref || `Content item ${index + 1}`;
  }

  function subtitleOf(row) {
    const parts = [];
    if (row?.role || row?.designation) parts.push(row.role || row.designation);
    if (row?.category) parts.push(row.category);
    if (row?.quality) parts.push(`${row.quality} quality`);
    if (row?.price !== undefined && row?.price !== '') parts.push(`${row.currency || 'USD'} ${row.price}`);
    if (row?.status) parts.push(row.status.replaceAll('_', ' '));
    if (row?.url || row?.video_url) parts.push(row.url || row.video_url);
    return parts.join(' · ') || row?.description || row?.body || 'Content item';
  }

  function statusClass(value) {
    const normalized = String(value || '').toLowerCase().replaceAll(' ', '_');
    if (['approved', 'completed', 'done', 'active'].includes(normalized)) return 'approved';
    if (['rejected', 'cancelled', 'inactive'].includes(normalized)) return 'rejected';
    if (['pending', 'confirmed', 'in_progress'].includes(normalized)) return 'pending';
    return '';
  }

  function renderRecords(target, section, path, options = {}) {
    const host = $(target);
    if (!host) return;
    const rows = path.length ? path.reduce((object, key) => object?.[key], state.sections[section]) : state.sections[section];
    let tools = host._recordTools;
    if (!tools) {
      const toolbar = document.createElement('div'); toolbar.className = 'record-toolbar';
      const search = document.createElement('input'); search.type = 'search'; search.placeholder = 'Search records…'; search.setAttribute('aria-label', 'Search records');
      const filter = document.createElement('select'); filter.setAttribute('aria-label', 'Filter by status');
      [['', 'All statuses'], ['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['published', 'Published'], ['draft', 'Draft']].forEach(([value, label]) => { const option = document.createElement('option'); option.value = value; option.textContent = label; filter.append(option); });
      const count = document.createElement('span'); count.className = 'record-count';
      const previous = document.createElement('button'); previous.type = 'button'; previous.textContent = 'Previous';
      const next = document.createElement('button'); next.type = 'button'; next.textContent = 'Next';
      const pages = document.createElement('span'); pages.className = 'record-page-count';
      toolbar.append(search, filter, count, previous, pages, next);
      host.before(toolbar);
      tools = host._recordTools = { toolbar, search, filter, count, previous, next, pages, render: () => {} };
      search.addEventListener('input', () => { host.dataset.page = '1'; tools.render(); });
      filter.addEventListener('change', () => { host.dataset.page = '1'; tools.render(); });
      previous.addEventListener('click', () => { host.dataset.page = String(Math.max(1, Number(host.dataset.page || 1) - 1)); tools.render(); });
      next.addEventListener('click', () => { host.dataset.page = String(Number(host.dataset.page || 1) + 1); tools.render(); });
    }
    tools.render = () => renderRecords(target, section, path, options);
    host.replaceChildren();
    const allRows = Array.isArray(rows) ? rows : [];
    const query = tools.search.value.trim().toLowerCase();
    const status = tools.filter.value;
    const filtered = allRows.map((row, index) => ({ row, index })).filter(({ row }) => {
      const text = `${titleOf(row, 0)} ${subtitleOf(row)} ${JSON.stringify(row)}`.toLowerCase();
      if (query && !text.includes(query)) return false;
      if (!status) return true;
      if (status === 'published') return !['draft', 'unpublished', 'disabled', 'rejected'].includes(String(row.status || '').toLowerCase()) && row.is_enabled !== false && row.is_enabled !== 0 && row.is_active !== false && row.is_active !== 0;
      return String(row.status || '').toLowerCase() === status;
    });
    const pageSize = 8;
    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    const page = Math.min(pageCount, Math.max(1, Number(host.dataset.page || 1)));
    host.dataset.page = String(page);
    const start = (page - 1) * pageSize;
    const visible = filtered.slice(start, start + pageSize);
    tools.toolbar.hidden = allRows.length === 0;
    tools.count.textContent = filtered.length ? `Showing ${start + 1}–${Math.min(start + pageSize, filtered.length)} of ${filtered.length}` : '0 records';
    tools.pages.textContent = `Page ${page} of ${pageCount}`;
    tools.previous.disabled = page <= 1;
    tools.next.disabled = page >= pageCount;
    if (!filtered.length) {
      host.innerHTML = `<div class="empty-state">${allRows.length ? 'No records match these filters.' : esc(options.empty || 'Nothing here yet. Add your first content item to get started.')}</div>`;
      return;
    }
    visible.forEach(({ row, index }) => {
      const card = document.createElement('article');
      card.className = 'record-card';
      const image = row?.photo_url || row?.image_url || row?.thumbnail_url || row?.video_thumbnail || row?.media?.imageUrl || '';
      const icon = section === 'reviews' ? '☆' : section === 'bookings' ? '▤' : '▣';
      const reviewActions = section === 'reviews' && row?.status === 'pending' ? '<button type="button" class="approve-button" data-approve>Approve</button><button type="button" class="delete-button" data-reject>Reject</button>' : '';
      const profileAction = section === 'team' ? `<button type="button" data-profile-link="${esc(row?.id)}">Create profile update link</button>` : '';
      card.innerHTML = `<div class="record-info">${image ? `<img class="record-thumb" src="${esc(image)}" alt="" loading="lazy">` : `<span class="record-placeholder">${icon}</span>`}<div class="record-copy"><h3>${esc(titleOf(row, index))}</h3><p>${esc(subtitleOf(row))}</p></div></div><div class="record-actions"><span class="pill ${statusClass(row?.status)}">${esc(String(row?.status || 'Active').replaceAll('_', ' '))}</span>${reviewActions}${profileAction}<button type="button" data-edit="${index}">Edit</button><button type="button" class="delete-button" data-delete="${index}">Delete</button></div>`;
      card.querySelector('[data-edit]').addEventListener('click', () => openRecord(section, path, index));
      card.querySelector('[data-delete]').addEventListener('click', () => deleteRecord(section, path, index));
      card.querySelector('[data-approve]')?.addEventListener('click', () => decideReview(row.id, 'approve'));
      card.querySelector('[data-reject]')?.addEventListener('click', () => decideReview(row.id, 'reject'));
      card.querySelector('[data-profile-link]')?.addEventListener('click', async () => {
        try {
          const result = await request(`api/admin/team/${encodeURIComponent(row.id)}/profile-link`, { method: 'POST', body: '{}' });
          try { await navigator.clipboard.writeText(result.url); toast('Secure profile update link created and copied. Share it directly with this team member.'); }
          catch { window.prompt('Copy and share this private profile update link', result.url); }
        } catch (error) { toast(error.message, true); }
      });
      host.append(card);
    });
  }

  function schemaFor(section, path) {
    if (section === 'services') return { id: Date.now(), name: 'New service', slug: 'new-service', description: '', subtitle: '', long_description: '', category: 'Editing', icon: 'fa-solid fa-video', image_url: '', price_from: 40, main_video_url: '', video_thumbnail: '', features: [], bullet_points: '', deliverables: '', active: true, sort_order: 99 };
    if (section === 'packages') return { id: `new:${Date.now()}`, serviceId: state.sections.services?.[0]?.id || '', quality: 'normal', name: 'Normal Quality', price: 40, currency: 'USD', prices: { USD: 40 }, is_enabled: true, description: '', features: [], delivery: '', revisions: '', badge: '', highlight: false, display_order: 99 };
    if (section === 'team') return { id: Date.now(), name: '', role: '', designation: '', photo_url: '', bio: '', description: '', skills: [], responsibilities: [], whatsapp: '', telegram: '', phone: '', email: '', is_founder: 0, is_active: 1, sort_order: 99 };
    if (section === 'reviews') return { id: `review-${Date.now()}`, name: '', role: '', rating: 5, body: '', photo_url: '', status: 'approved', created_at: new Date().toISOString(), display_order: 99 };
    if (section === 'bookings') return { id: `ticket-${Date.now()}`, ref: '', serviceName: '', packageName: '', quality: 'normal', price: 0, currency: 'USD', message: '', status: 'pending', createdAt: new Date().toISOString() };
    const kind = $('#portfolio-kind')?.value || 'recent';
    return { id: Date.now(), title: '', description: '', url: '', thumbnail_url: '', kind: kind === 'shorts' ? 'short' : 'video', platform: '', category: '', status: 'published', is_enabled: true, is_featured: false, sort_order: 99, display_order: 99, section: kind };
  }

  function displayValue(key, value) {
    if (Array.isArray(value) || (value && typeof value === 'object')) return JSON.stringify(value, null, 2);
    return value ?? '';
  }

  function openRecord(section, path, index) {
    const rows = path.length ? path.reduce((object, key) => object?.[key], state.sections[section]) : state.sections[section];
    const row = JSON.parse(JSON.stringify(rows[index] || {}));
    state.editing = { section, path, index, row };
    $('#drawer-title').textContent = `Edit ${titleOf(row, index)}`;
    renderRecordFields(row);
    $('#editor-drawer').hidden = false;
  }

  function renderRecordFields(row) {
    const host = $('#drawer-fields');
    host.replaceChildren();
    if (state.editing.section === 'packages') {
      if (!row.prices) row.prices = { [row.currency || 'USD']: row.price ?? 0 };
      if (row.display_order === undefined) row.display_order = state.editing.index;
    }
    Object.entries(row).forEach(([key, value]) => {
      const label = document.createElement('label');
      label.textContent = state.editing.section === 'packages' && key === 'price' ? 'Selected currency price' : key.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      let input;
      if (state.editing.section === 'packages' && key === 'currency') {
        input = document.createElement('select');
        ['USD', 'USDT', 'BDT'].forEach((currency) => {
          const option = document.createElement('option');
          option.value = currency;
          option.textContent = currency;
          option.selected = String(value || 'USD').toUpperCase() === currency;
          input.append(option);
        });
        input.dataset.key = key;
        input.dataset.packageCurrency = '1';
      } else if (state.editing.section === 'packages' && key === 'price') {
        input = document.createElement('input');
        input.type = 'number'; input.min = '0'; input.step = '0.01';
        input.value = row.prices?.[row.currency || 'USD'] ?? value ?? '';
        input.dataset.key = key; input.dataset.packagePrice = '1';
      } else if (state.editing.section === 'packages' && key === 'prices') {
        input = document.createElement('div');
        input.className = 'currency-price-grid';
        input.dataset.type = 'prices';
        input.dataset.key = key;
        ['USD', 'USDT', 'BDT'].forEach((currency) => {
          const field = document.createElement('label');
          field.textContent = `${currency} amount`;
          const amount = document.createElement('input');
          amount.type = 'number';
          amount.min = '0';
          amount.step = '0.01';
          amount.placeholder = 'Not set';
          amount.value = value?.[currency] ?? '';
          amount.dataset.currency = currency;
          field.append(amount);
          input.append(field);
        });
      } else if (key === 'category' && state.editing.section === 'portfolio') {
        input = document.createElement('select');
        const categories = state.sections.portfolio?.categories || [];
        [...new Set(['Uncategorized', ...categories, value || ''])].filter(Boolean).forEach((category) => {
          const option = document.createElement('option');
          option.value = category === 'Uncategorized' ? '' : category;
          option.textContent = category;
          option.selected = String(value || '') === option.value;
          input.append(option);
        });
        input.dataset.key = key;
      } else if (key === 'quality' && state.editing.section === 'packages') {
        input = document.createElement('select');
        [['premium', 'Premium Quality'], ['high', 'High Quality'], ['normal', 'Normal Quality']].forEach(([id, title]) => {
          const option = document.createElement('option'); option.value = id; option.textContent = title; option.selected = value === id; input.append(option);
        });
        input.dataset.key = key;
      } else if (key === 'status' && state.editing.section === 'reviews') {
        input = document.createElement('select');
        [['pending', 'Pending approval'], ['approved', 'Published'], ['rejected', 'Rejected']].forEach(([id, title]) => {
          const option = document.createElement('option'); option.value = id; option.textContent = title; option.selected = value === id; input.append(option);
        });
        input.dataset.key = key;
      } else if (key === 'status' && state.editing.section === 'portfolio') {
        input = document.createElement('select');
        [...new Set(['published', 'draft', 'done', 'completed', value].filter(Boolean))].forEach((status) => {
          const option = document.createElement('option'); option.value = status; option.textContent = status.replaceAll('_', ' '); option.selected = value === status; input.append(option);
        });
        input.dataset.key = key;
      } else if (typeof value === 'boolean') {
        label.classList.add('checkbox-field');
        input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = value;
        input.dataset.key = key;
      } else if (typeof value === 'number') {
        input = document.createElement('input');
        input.type = 'number';
        input.step = Number.isInteger(value) ? '1' : '0.01';
        input.value = value;
        input.dataset.key = key;
      } else if (Array.isArray(value) || (value && typeof value === 'object')) {
        input = document.createElement('textarea');
        input.value = displayValue(key, value);
        input.className = 'json-field';
        input.rows = Math.min(10, Math.max(3, input.value.split('\n').length));
        input.dataset.type = 'json';
        input.dataset.key = key;
      } else if (typeof value === 'string' && (value.length > 100 || /description|message|deliver|bio|body|caption|intro|feature|responsib|skill/i.test(key))) {
        input = document.createElement('textarea');
        input.value = value;
        input.rows = Math.min(8, Math.max(3, Math.ceil(value.length / 90)));
        input.dataset.key = key;
      } else {
        input = document.createElement('input');
        input.type = /url|photo|image|thumbnail|video/i.test(key) ? 'url' : 'text';
        input.value = value ?? '';
        input.dataset.key = key;
      }
      label.append(input);
      host.append(label);
    });
    if (state.editing.section === 'packages') {
      const currency = $('[data-package-currency]', host); const price = $('[data-package-price]', host);
      currency?.addEventListener('change', () => { price.value = $(`[data-currency="${currency.value}"]`, host)?.value ?? ''; });
      price?.addEventListener('input', () => {
        const matching = $(`[data-currency="${currency?.value || 'USD'}"]`, host);
        if (matching) matching.value = price.value;
      });
      $$('[data-currency]', host).forEach((amount) => amount.addEventListener('input', () => {
        if (amount.dataset.currency === currency?.value) price.value = amount.value;
      }));
    }
  }

  function readRecordFields() {
    const row = { ...state.editing.row };
    $$('#drawer-fields [data-key]').forEach((input) => {
      const key = input.dataset.key;
      if (input.dataset.type === 'prices') {
        const amounts = {};
        $$('[data-currency]', input).forEach((field) => { if (field.value !== '') amounts[field.dataset.currency] = Number(field.value); });
        row[key] = amounts;
      } else if (input.type === 'checkbox') row[key] = input.checked;
      else if (input.type === 'number') row[key] = input.value === '' ? 0 : Number(input.value);
      else if (input.dataset.type === 'json') {
        try { row[key] = JSON.parse(input.value || 'null'); }
        catch { throw new Error(`“${key}” must contain valid JSON.`); }
      } else row[key] = input.value.trim();
    });
    return row;
  }

  async function saveRecord() {
    if (!state.editing) return;
    try {
      const row = readRecordFields();
      const { section, path, index } = state.editing;
      if (section === 'packages' && row.prices && row.prices[row.currency]) row.price = Number(row.prices[row.currency]);
      const rows = path.length ? path.reduce((object, key) => object[key], state.sections[section]) : state.sections[section];
      rows[index] = row;
      $('#editor-drawer').hidden = true;
      await saveSection(section, 'Content updated and published.');
      renderAll();
    } catch (error) { toast(error.message, true); }
  }

  async function deleteRecord(section, path, index) {
    if (!window.confirm('Delete this item? This change will be published immediately.')) return;
    const rows = path.length ? path.reduce((object, key) => object[key], state.sections[section]) : state.sections[section];
    rows.splice(index, 1);
    await saveSection(section, 'Item deleted.');
    renderAll();
  }

  async function addRecord(target) {
    let section = target;
    let path = [];
    if (target === 'team.members') { section = 'team'; path = ['members']; }
    else if (target === 'portfolio') { section = 'portfolio'; path = [$('#portfolio-kind').value || 'recent']; }
    const rows = path.length ? path.reduce((object, key) => object[key], state.sections[section]) : state.sections[section];
    rows.push(schemaFor(section, path));
    state.editing = { section, path, index: rows.length - 1, row: rows[rows.length - 1] };
    $('#drawer-title').textContent = `New ${section === 'team' ? 'team member' : section === 'portfolio' ? 'video' : section.slice(0, -1)}`;
    renderRecordFields(state.editing.row);
    $('#editor-drawer').hidden = false;
  }

  function renderTeam() {
    const team = state.sections.team || (state.sections.team = { heading: 'Our Team', intro: '', members: [], fallback_contact: {} });
    const host = $('#team-fields');
    host.innerHTML = `<h3>Team page introduction</h3><div class="inline-form-grid"><label>Section heading<input id="team-heading" value="${esc(team.heading || '')}"></label><label>Introduction<textarea id="team-intro" rows="2">${esc(team.intro || '')}</textarea></label><button id="save-team-intro" class="secondary-button">Save intro</button></div>`;
    $('#save-team-intro').addEventListener('click', async () => {
      team.heading = $('#team-heading').value.trim();
      team.intro = $('#team-intro').value.trim();
      await saveSection('team', 'Team introduction published.');
    });
    renderRecords('#records-team', 'team', ['members'], { empty: 'No team members added yet.' });
  }

  function placementOptions() {
    const options = [
      ['home|showreel|', 'Home · Showreel'],
      ['service|overview|', 'Service · Overview'],
      ['work|recent|', 'Work · Recent videos'],
      ['work|items|', 'Work · Portfolio'],
      ['work|demos|', 'Work · Demo videos'],
      ['work|shorts|', 'Work · Shorts'],
    ];
    (state.sections.services || []).forEach((service) => {
      const id = String(service.id ?? '');
      if (!id) return;
      const name = service.name || `Service ${id}`;
      options.push([`service|service-card|${id}`, `Service · ${name} card`]);
      options.push([`service|service-demo|${id}`, `Service · ${name} demos`]);
    });
    return options;
  }

  function placementKey(placement) {
    return `${placement.page}|${placement.section}|${placement.service_id || ''}`;
  }

  function renderPlacementOptions(selected = []) {
    const selectedKeys = new Set(selected.map(placementKey));
    const host = $('#video-placement-options');
    host.replaceChildren();
    placementOptions().forEach(([value, label]) => {
      const option = document.createElement('label');
      option.className = 'video-place-option';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = value;
      checkbox.checked = selectedKeys.has(value);
      const text = document.createElement('span');
      text.textContent = label;
      option.append(checkbox, text);
      host.append(option);
    });
  }

  function renderVideoLibrary() {
    const host = $('#video-library-records');
    if (!host) return;
    host.replaceChildren();
    const query = $('#video-library-search')?.value.trim().toLowerCase() || '';
    const filter = $('#video-library-filter')?.value || '';
    const filtered = state.videos.filter((video) => {
      const content = `${video.title} ${video.description || ''} ${video.url} ${video.category || ''} ${video.provider || ''}`.toLowerCase();
      if (query && !content.includes(query)) return false;
      if (filter === 'published' && !video.is_enabled) return false;
      if (filter === 'disabled' && video.is_enabled) return false;
      if (filter === 'featured' && !video.is_featured) return false;
      return true;
    });
    const pageSize = 8; const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    state.videoPage = Math.min(pageCount, Math.max(1, state.videoPage));
    const first = (state.videoPage - 1) * pageSize;
    $('#video-library-count').textContent = `${filtered.length} videos`;
    $('#video-library-page').textContent = `Page ${state.videoPage} of ${pageCount}`;
    $('#video-library-prev').disabled = state.videoPage <= 1;
    $('#video-library-next').disabled = state.videoPage >= pageCount;
    if (!filtered.length) {
      host.innerHTML = '<div class="empty-state">No videos in the central library yet. Add a video and choose where it should appear.</div>';
      return;
    }
    filtered.slice(first, first + pageSize).forEach((video) => {
      const card = document.createElement('article');
      card.className = 'video-library-card';
      const thumbnail = video.thumbnail_url
        ? `<img src="${esc(video.thumbnail_url)}" alt="" loading="lazy" decoding="async">`
        : '<span class="video-library-placeholder" aria-hidden="true">▶</span>';
      const placements = (video.placements || []).map((placement) => {
        const base = `${placement.page} · ${placement.section.replaceAll('-', ' ')}`;
        if (placement.service_id) {
          const service = (state.sections.services || []).find((row) => String(row.id) === String(placement.service_id));
          return `${base} · ${service?.name || `service ${placement.service_id}`}`;
        }
        return base;
      });
      card.innerHTML = `<div class="video-library-card-main">${thumbnail}<div class="video-library-card-copy"><div class="video-library-title-row"><h3>${esc(video.title)}</h3><span class="pill ${video.is_enabled ? 'approved' : 'rejected'}">${video.is_enabled ? 'Published' : 'Disabled'}</span></div><p>${esc(video.provider || video.source_type || 'Video')} · Order ${esc(video.display_order)}</p><p class="video-library-url">${esc(video.url)}</p><div class="video-placement-tags">${placements.map((item) => `<span>${esc(item)}</span>`).join('') || '<span>Not assigned</span>'}</div></div></div><div class="video-library-card-actions"><button type="button" data-video-action="preview" data-video-id="${esc(video.id)}">Preview</button><button type="button" data-video-action="edit" data-video-id="${esc(video.id)}">Edit</button><button type="button" data-video-action="delete" data-video-id="${esc(video.id)}" class="delete-button">Remove</button></div>`;
      host.append(card);
    });
  }

  async function loadVideos() {
    try {
      const result = await request('api/admin/videos');
      state.videos = result.videos || [];
      renderVideoLibrary();
    } catch (error) { toast(error.message, true); }
  }

  function openVideoEditor(video = null) {
    const form = $('#video-library-form');
    form.reset();
    state.videoPlacements = video?.placements ? JSON.parse(JSON.stringify(video.placements)) : [];
    $('#video-record-id').value = video?.id || '';
    $('#video-title').value = video?.title || '';
    $('#video-url').value = video?.url || '';
    $('#video-thumbnail-url').value = video?.thumbnail_url || '';
    $('#video-thumbnail-file').value = '';
    $('#video-description').value = video?.description || '';
    $('#video-category').value = video?.category || '';
    $('#video-order').value = Number(video?.display_order || 0);
    $('#video-featured').checked = Boolean(video?.is_featured);
    $('#video-enabled').checked = video ? Boolean(video.is_enabled) : true;
    $('#video-source-status').textContent = video ? `${video.provider || 'Video'} · ${video.is_enabled ? 'Published' : 'Disabled'}` : 'Paste a supported link and preview it before publishing.';
    $('#video-library-message').textContent = '';
    renderPlacementOptions(state.videoPlacements);
    form.hidden = false;
    $('#video-title').focus({ preventScroll: true });
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function previewLibraryVideo() {
    const url = $('#video-url').value.trim();
    if (!url) { toast('Add a video URL first.', true); return; }
    const status = $('#video-source-status');
    status.textContent = 'Checking video source…';
    try {
      const result = await request(`api/admin/video-preview?url=${encodeURIComponent(url)}`);
      if (!['iframe', 'video'].includes(result.type)) throw new Error('This link does not have a supported embedded player.');
      status.textContent = `Detected ${result.provider} · ${result.type === 'iframe' ? 'platform player' : 'HTML5 video'}`;
      if (!$('#video-thumbnail-url').value.trim() && result.thumbnail_url) $('#video-thumbnail-url').value = result.thumbnail_url;
      window.MexaVideoPreview?.open({ ...result, url: result.url || url, title: $('#video-title').value.trim(), thumbnail_url: $('#video-thumbnail-url').value.trim() });
    } catch (error) {
      status.textContent = error.message;
      toast(error.message, true);
    }
  }

  async function saveVideoLibrary(event) {
    event.preventDefault();
    const id = $('#video-record-id').value;
    const selected = $$('#video-placement-options input:checked').map((input) => {
      const [page, section, serviceId] = input.value.split('|');
      const previous = state.videoPlacements.find((row) => row.page === page && row.section === section && String(row.service_id || '') === serviceId);
      return { page, section, service_id: serviceId || null, item_key: previous?.item_key || '' };
    });
    if (!selected.length) { toast('Choose at least one page or section for this video.', true); return; }

    const message = $('#video-library-message');
    message.textContent = 'Saving video…';
    let thumbnailUrl = $('#video-thumbnail-url').value.trim();
    const file = $('#video-thumbnail-file').files[0];
    try {
      if (file) {
        const body = new FormData();
        body.append('image', file);
        message.textContent = 'Uploading thumbnail to ImgBB…';
        const uploaded = await request('api/admin/images', { method: 'POST', body });
        thumbnailUrl = uploaded.image.url;
        $('#video-thumbnail-url').value = thumbnailUrl;
      }
      const payload = {
        title: $('#video-title').value.trim(),
        description: $('#video-description').value.trim(),
        url: $('#video-url').value.trim(),
        thumbnail_url: thumbnailUrl,
        category: $('#video-category').value.trim(),
        is_featured: $('#video-featured').checked,
        is_enabled: $('#video-enabled').checked,
        display_order: Number($('#video-order').value || 0),
        placements: selected,
      };
      const result = await request(id ? `api/admin/videos/${encodeURIComponent(id)}` : 'api/admin/videos', {
        method: id ? 'PUT' : 'POST', body: JSON.stringify(payload),
      });
      $('#video-library-form').hidden = true;
      message.textContent = '';
      await loadVideos();
      toast(result.reused ? 'This video already existed; its new placements were added.' : 'Video saved and published.');
    } catch (error) {
      message.textContent = error.message;
      toast(error.message, true);
    }
  }

  async function handleVideoLibraryAction(event) {
    const button = event.target.closest('[data-video-action]');
    if (!button) return;
    const video = state.videos.find((row) => String(row.id) === button.dataset.videoId);
    if (!video) return;
    if (button.dataset.videoAction === 'preview') {
      window.MexaVideoPreview?.open(video);
      return;
    }
    if (button.dataset.videoAction === 'edit') {
      openVideoEditor(video);
      return;
    }
    if (button.dataset.videoAction === 'delete') {
      if (!window.confirm(`Remove “${video.title}” from the video library and its page placements?`)) return;
      try {
        await request(`api/admin/videos/${encodeURIComponent(video.id)}`, { method: 'DELETE' });
        await loadVideos();
        toast('Video and its page placements were removed.');
      } catch (error) { toast(error.message, true); }
    }
  }

  function renderSettings() {
    const settings = state.sections.settings || (state.sections.settings = { content: {}, contact: {}, page_content: {} });
    const host = $('#settings-forms');
    host.replaceChildren();
    settings.seo ||= { title: '', description: '' };
    settings.social ||= { facebook: '', instagram: '', youtube: '', linkedin: '', telegram: '', whatsapp: '' };
    settings.footer ||= { text: '', copyright: '' };
    settings.purchase ||= { heading: '', description: '', instructions: '', whatsapp: '', telegram: '', email: '', phone: '', button_text: '', button_link: '' };
    settings.branding = { logo_url: settings.logo_url || '', favicon_url: settings.favicon_url || '' };
    [['content', 'Page content'], ['contact', 'Global contact information'], ['purchase', 'Package order instructions'], ['seo', 'SEO metadata'], ['social', 'Social links'], ['footer', 'Footer content'], ['branding', 'Logo & favicon']].forEach(([key, heading]) => {
      const values = settings[key] || (settings[key] = {});
      const card = document.createElement('article');
      card.className = 'surface-card settings-card';
      const title = document.createElement('h3');
      title.textContent = heading;
      card.append(title);
      Object.entries(values).forEach(([field, value]) => {
        const label = document.createElement('label');
        label.className = 'field-label';
        label.textContent = field.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        const isJson = typeof value === 'object' && value !== null;
        const input = isJson || (typeof value === 'string' && (value.length > 90 || /description|instruction|copyright|footer|welcome|message/i.test(field))) ? document.createElement('textarea') : document.createElement('input');
        if (isJson) {
          input.value = JSON.stringify(value, null, 2);
          input.dataset.settingType = 'json';
          input.rows = 5;
        } else {
          input.value = value ?? '';
          if (/url|link|logo|favicon|whatsapp|telegram|facebook|instagram|youtube|linkedin/i.test(field)) input.type = 'url';
        }
        input.dataset.settingGroup = key;
        input.dataset.settingKey = field;
        label.append(input);
        card.append(label);
      });
      const actions = document.createElement('div');
      actions.className = 'settings-actions';
      actions.innerHTML = '<button type="button" class="secondary-button">Save section</button>';
      actions.querySelector('button').addEventListener('click', async () => {
        try {
          $$('[data-setting-group]', card).forEach((input) => {
            const group = input.dataset.settingGroup;
            const key = input.dataset.settingKey;
            const value = input.dataset.settingType === 'json' ? JSON.parse(input.value || 'null') : input.value.trim();
            settings[group][key] = value;
          });
        } catch { toast('Check the JSON value in this section and try again.', true); return; }
        if (key === 'branding') {
          settings.logo_url = settings.branding.logo_url || '';
          settings.favicon_url = settings.branding.favicon_url || '';
        }
        delete settings.branding;
        await saveSection('settings', `${heading} updated.`);
      });
      card.append(actions);
      host.append(card);
    });
  }

  const homeTextFields = [
    ['hero_small_heading', 'Small hero heading', '.hero-line-1', 'text'],
    ['hero_heading', 'Main hero heading', '.hero-line-2', 'text'],
    ['hero_description', 'Hero description', '.hero-grid > div p', 'replace'],
    ['hero_button_text', 'Primary button text', '.hero-cta > a', 'label'],
    ['hero_button_link', 'Primary button link', '.hero-cta > a', 'href'],
    ['showreel_button_text', 'Showreel button text', '.hero-cta > button', 'label'],
    ['solutions_heading', 'Solutions section heading', '#services .svc-title > span:first-child', 'text'],
    ['services_intro', 'Solutions section description', '#services .svc-sub', 'content'],
    ['about_heading', 'About heading', '#about h2', 'replace'],
    ['about_description', 'About description', '#about p', 'replace'],
    ['contact_heading', 'Contact heading', '#contact h2', 'replace'],
    ['contact_description', 'Contact description', '#contact p', 'replace'],
  ];
  const defaultHomeSections = [
    ['hero', 'Hero'], ['services', 'Services'], ['work', 'Featured work'], ['process', 'Our process'], ['reviews', 'Reviews'], ['team', 'Team'], ['about', 'About'], ['contact', 'Contact'],
  ];

  function renderHomeManagement() {
    const settings = state.sections.settings;
    const fieldsHost = $('#home-fields');
    if (!settings || !fieldsHost) return;
    const overrides = settings.page_content?.home || {};
    fieldsHost.replaceChildren();
    const card = document.createElement('article');
    card.className = 'surface-card home-copy-card';
    card.innerHTML = '<h3>Homepage copy</h3><p class="muted">Leave a field blank to keep the current copy. Use Page editor for other page elements.</p>';
    homeTextFields.forEach(([key, label, selector, kind]) => {
      const wrapper = document.createElement('label');
      wrapper.className = 'field-label';
      wrapper.textContent = label;
      const current = overrides[selector] || {};
      const input = kind === 'replace' ? document.createElement('textarea') : document.createElement('input');
      input.value = key === 'services_intro' ? (settings.content?.services_intro || current.text || '') : kind === 'label' ? (current.label || '') : kind === 'href' ? (current.href || '') : (current.text || '');
      input.placeholder = kind === 'href' ? '/service or https://…' : 'Leave blank to keep current live copy';
      if (kind === 'href') input.type = 'text';
      input.dataset.homeKey = key;
      input.dataset.selector = selector;
      input.dataset.homeKind = kind;
      wrapper.append(input);
      card.append(wrapper);
    });
    const save = document.createElement('button');
    save.type = 'button'; save.className = 'primary-button'; save.textContent = 'Save homepage copy';
    save.addEventListener('click', saveHomeCopy);
    card.append(save);
    fieldsHost.append(card);

    const media = settings.home_media || {};
    $('#home-bg-image').value = media.image || '';
    $('#home-bg-video').value = media.video || '';
    const layoutHost = $('#home-sections-fields');
    if (!layoutHost) return;
    const sections = settings.home_sections || defaultHomeSections.map(([key, label], index) => ({ key, label, enabled: true, order: index + 1 }));
    layoutHost.replaceChildren();
    sections.forEach((section, index) => {
      const row = document.createElement('div'); row.className = 'home-section-row';
      const label = document.createElement('label'); label.className = 'home-section-enabled';
      const toggle = document.createElement('input'); toggle.type = 'checkbox'; toggle.checked = section.enabled !== false; toggle.dataset.homeSection = index;
      const title = document.createElement('span'); title.textContent = section.label || section.key;
      label.append(toggle, title);
      const orderLabel = document.createElement('label'); orderLabel.textContent = 'Order';
      const order = document.createElement('input'); order.type = 'number'; order.min = '1'; order.max = '99'; order.value = section.order || index + 1; order.dataset.homeOrder = index;
      orderLabel.append(order);
      row.append(label, orderLabel); layoutHost.append(row);
    });
  }

  async function saveHomeCopy() {
    const settings = state.sections.settings;
    settings.page_content ||= {}; settings.page_content.home ||= {};
    const overrides = settings.page_content.home;
    $$('[data-home-key]').forEach((input) => {
      const selector = input.dataset.selector;
      const kind = input.dataset.homeKind;
      const value = input.value.trim();
      if (key === 'services_intro' && value) settings.content.services_intro = value;
      if (!value) { if (overrides[selector]) delete overrides[selector][kind === 'label' ? 'label' : kind === 'href' ? 'href' : 'text']; return; }
      overrides[selector] ||= {};
      if (kind === 'label') overrides[selector].label = value;
      else if (kind === 'href') overrides[selector].href = value;
      else { overrides[selector].text = value; if (kind === 'replace' || kind === 'content') overrides[selector].replace = true; }
    });
    if (!Object.keys(overrides).length) delete settings.page_content.home;
    await saveSection('settings', 'Homepage copy updated.');
  }

  async function saveHomeMedia(event) {
    event.preventDefault();
    const image = $('#home-bg-image').value.trim();
    const video = $('#home-bg-video').value.trim();
    if (video && !/\.(mp4|webm|ogg)(?:[?#].*)?$/i.test(video)) { toast('Use a direct MP4, WebM, or Ogg video URL for the hero background.', true); return; }
    state.sections.settings.home_media = { image, video };
    await saveSection('settings', 'Homepage hero media updated.');
  }

  async function saveHomeSections() {
    const current = state.sections.settings.home_sections || defaultHomeSections.map(([key, label], index) => ({ key, label, enabled: true, order: index + 1 }));
    const sections = current.map((section, index) => ({ ...section,
      enabled: $(`[data-home-section="${index}"]`)?.checked ?? true,
      order: Number($(`[data-home-order="${index}"]`)?.value || index + 1),
    })).sort((a, b) => a.order - b.order).map((section, index) => ({ ...section, order: index + 1 }));
    state.sections.settings.home_sections = sections;
    await saveSection('settings', 'Homepage section layout updated.');
  }

  function renderWorkCategories() {
    const input = $('#work-categories');
    if (input) input.value = (state.sections.portfolio?.categories || []).join(', ');
  }

  async function saveWorkCategories(event) {
    event.preventDefault();
    const portfolio = state.sections.portfolio;
    portfolio.categories = [...new Set($('#work-categories').value.split(',').map((item) => item.trim()).filter(Boolean))].slice(0, 60);
    await saveSection('portfolio', 'Work categories updated.');
    renderPortfolio();
  }

  function renderApprovals(data) {
    const reviews = $('#pending-reviews'); const profiles = $('#pending-team-profiles');
    if (reviews) reviews.innerHTML = data.reviews?.length ? data.reviews.map((item) => `<article class="approval-record"><div><strong>${esc(item.name)}</strong><span>${esc(item.role || 'Client')} · ${esc(item.rating || 5)} ★</span><p>${esc(item.body)}</p></div><div class="approval-actions"><button class="approve-button" data-review-action="approve" data-id="${esc(item.id)}">Approve</button><button class="secondary-button small" data-review-action="reject" data-id="${esc(item.id)}">Reject</button><button class="delete-button" data-review-action="delete" data-id="${esc(item.id)}">Delete</button></div></article>`).join('') : '<div class="empty-state">No visitor reviews are waiting for approval.</div>';
    if (profiles) profiles.innerHTML = data.team_submissions?.length ? data.team_submissions.map((item) => `<article class="approval-record"><div><strong>${esc(item.member_name)} · profile update</strong><span>Submitted ${esc(new Date(item.submitted_at).toLocaleString())}</span><dl>${Object.entries(item.payload || {}).map(([key, value]) => `<div><dt>${esc(key.replaceAll('_', ' '))}</dt><dd>${esc(Array.isArray(value) ? value.join(', ') : value)}</dd></div>`).join('')}</dl></div><div class="approval-actions"><button class="approve-button" data-profile-action="approve" data-id="${esc(item.id)}">Approve update</button><button class="secondary-button small" data-profile-action="reject" data-id="${esc(item.id)}">Reject</button><button class="delete-button" data-profile-action="delete" data-id="${esc(item.id)}">Delete</button></div></article>`).join('') : '<div class="empty-state">No team profile changes are waiting for approval.</div>';
  }

  async function loadApprovals() {
    try { renderApprovals(await request('api/admin/approvals')); }
    catch (error) { toast(error.message, true); }
  }

  async function decideReview(id, decision) {
    if (decision === 'delete' && !window.confirm('Delete this submitted review permanently?')) return;
    try { await request(`api/admin/reviews/${encodeURIComponent(id)}/${decision}`, { method: 'POST', body: '{}' }); await loadApprovals(); if (isOwner) await loadState(); toast(`Review ${decision === 'approve' ? 'approved and published' : decision === 'reject' ? 'rejected' : 'deleted'}.`); }
    catch (error) { toast(error.message, true); }
  }

  async function decideTeamProfile(id, decision) {
    if (decision === 'delete' && !window.confirm('Delete this profile proposal permanently?')) return;
    try {
      if (decision === 'delete') await request(`api/admin/team-submissions/${encodeURIComponent(id)}`, { method: 'DELETE' });
      else await request(`api/admin/team-submissions/${encodeURIComponent(id)}/${decision}`, { method: 'POST', body: '{}' });
      await loadApprovals(); if (isOwner) await loadState(); toast(`Team profile update ${decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'deleted'}.`);
    } catch (error) { toast(error.message, true); }
  }

  async function renderModerators() {
    if (!isOwner) return;
    try {
      const result = await request('api/admin/moderators'); state.moderators = result.users || [];
      const host = $('#moderators-list');
      host.innerHTML = state.moderators.length ? state.moderators.map((user) => `<article class="record-card"><div class="record-copy"><h3>${esc(user.name)}</h3><p>${esc(user.email)} · ${user.is_active ? 'Active moderator' : 'Deactivated'}</p></div><div class="record-actions">${user.is_active ? `<button class="delete-button" data-disable-moderator="${esc(user.id)}">Deactivate</button>` : '<span class="pill rejected">Deactivated</span>'}</div></article>`).join('') : '<div class="empty-state">No moderators have been added.</div>';
    } catch (error) { toast(error.message, true); }
  }

  async function saveModerator(event) {
    event.preventDefault();
    const form = event.currentTarget;
    try { await request('api/admin/moderators', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) }); form.reset(); await renderModerators(); toast('Moderator account created.'); }
    catch (error) { toast(error.message, true); }
  }

  function renderPortfolio() {
    const portfolio = state.sections.portfolio || (state.sections.portfolio = { items: [], recent: [], demos: [], shorts: [] });
    renderWorkCategories();
    const kind = $('#portfolio-kind').value || 'recent';
    if (!Array.isArray(portfolio[kind])) portfolio[kind] = [];
    renderRecords('#records-portfolio', 'portfolio', [kind], { empty: `No ${kind} videos yet.` });
  }

  function renderOverview() {
    const services = state.sections.services || [];
    const team = state.sections.team?.members || [];
    const reviews = state.sections.reviews || [];
    const bookings = state.sections.bookings || [];
    const pendingReviews = reviews.filter((row) => row.status === 'pending').length;
    const pendingBookings = bookings.filter((row) => row.status === 'pending').length;
    $('#overview-stats').innerHTML = [
      ['Services', services.length, 'In the public catalogue'],
      ['Team members', team.length, 'Founder and contributors'],
      ['Portfolio videos', (state.sections.portfolio?.items || []).length, 'Projects on your site'],
      ['Pending requests', pendingBookings + pendingReviews, `${pendingBookings} bookings · ${pendingReviews} reviews`],
    ].map(([title, value, note]) => `<article class="stat-card"><span>${esc(title)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></article>`).join('');
    $('#content-health').innerHTML = [
      ['Website pages', 'Connected'], ['Database content', 'Saved'], ['Image host', 'ImgBB ready when configured'], ['Admin account', 'Password protected'],
    ].map(([title, value]) => `<div class="health-row"><span>${esc(title)}</span><b>${esc(value)}</b></div>`).join('');
    $('#pending-bookings').textContent = `${pendingBookings} pending`;
  }

  function renderAll() {
    renderOverview();
    if (!isOwner) {
      renderRecords('#records-reviews', 'reviews', []);
      return;
    }
    renderRecords('#records-services', 'services', []);
    renderRecords('#records-packages', 'packages', []);
    renderTeam();
    renderPortfolio();
    renderVideoLibrary();
    renderRecords('#records-reviews', 'reviews', []);
    renderRecords('#records-bookings', 'bookings', []);
    renderSettings();
    renderHomeManagement();
    renderImages();
  }

  function loadPreview() {
    const page = $('#editor-page').value;
    const paths = { home: '', service: 'service', work: 'work', reviews: 'reviews', team: 'team', booking: 'book' };
    state.previewPage = page;
    $('#preview-label').textContent = `${panelNames[page === 'home' ? 'overview' : page] || page} page · click a text item, image or link to select it`;
    $('#page-preview').src = `${api(paths[page] || '')}?cms_preview=1`;
    const current = state.sections.settings?.page_content?.[page] || {};
    state.selected = null;
    $('#inspector-form').hidden = true;
    $('#inspector-title').textContent = 'Choose an item in the preview';
    $('#inspector-hint').textContent = 'Click a text line, image, or link on the left. Your changes are saved to the database.';
    void current;
  }

  function receiveSelection(event) {
    if (event.origin !== new URL(base).origin || event.data?.type !== 'mexa-cms-select') return;
    state.selected = event.data;
    $('#inspector-title').textContent = `${event.data.tag.toLowerCase()} selected`;
    $('#inspector-hint').textContent = 'Edit the fields you need. Only the selected page element will change.';
    $('#inspector-form').hidden = false;
    $('#edit-text').value = event.data.text || '';
    $('#edit-href').value = event.data.href || '';
    $('#edit-src').value = event.data.src || '';
    $('#edit-alt').value = event.data.alt || '';
    $('#edit-title').value = event.data.title || '';
    $('#selector-note').textContent = `${event.data.page} · ${event.data.selector}`;
  }

  async function savePageOverride(event) {
    event.preventDefault();
    if (!state.selected) return;
    const settings = state.sections.settings;
    settings.page_content ||= {};
    settings.page_content[state.selected.page] ||= {};
    const value = { text: $('#edit-text').value };
    if (state.selected.tag === 'A') value.href = $('#edit-href').value.trim();
    if (state.selected.tag === 'IMG') {
      value.src = $('#edit-src').value.trim();
      value.alt = $('#edit-alt').value.trim();
    }
    if ($('#edit-title').value.trim()) value.title = $('#edit-title').value.trim();
    settings.page_content[state.selected.page][state.selected.selector] = value;
    await saveSection('settings', 'Page change published.');
    $('#page-preview').contentWindow?.location.reload();
  }

  async function loadImages() {
    try {
      const result = await request('api/admin/images');
      state.images = result.images || [];
      renderImages();
    } catch (error) { toast(error.message, true); }
  }

  function renderImages() {
    const host = $('#image-gallery');
    if (!host) return;
    host.replaceChildren();
    if (!state.images.length) {
      host.innerHTML = '<div class="empty-state">Uploaded images will appear here.</div>';
      return;
    }
    state.images.forEach((image) => {
      const tile = document.createElement('div');
      tile.className = 'image-tile';
      tile.innerHTML = `<img src="${esc(image.thumbnail_url || image.url)}" alt="${esc(image.name || 'Uploaded image')}" loading="lazy"><button type="button" title="Copy image URL">Copy image URL</button>`;
      tile.querySelector('button').addEventListener('click', async () => {
        const target = state.focusedUrl;
        if (target && target.isConnected) {
          target.value = image.url;
          target.dispatchEvent(new Event('input', { bubbles: true }));
          toast('Image URL added to the selected field. Save the content item to publish it.');
        } else {
          try { await navigator.clipboard.writeText(image.url); toast('Image URL copied.'); }
          catch { window.prompt('Copy this ImgBB URL', image.url); }
        }
      });
      host.append(tile);
    });
  }

  async function uploadImage(event) {
    event.preventDefault();
    const file = $('#image-file').files[0];
    if (!file) return;
    const status = $('#upload-status');
    status.textContent = 'Uploading to ImgBB…';
    const body = new FormData();
    body.append('image', file);
    try {
      const result = await request('api/admin/images', { method: 'POST', body });
      state.images.unshift({ ...result.image, name: file.name });
      renderImages();
      status.textContent = 'Upload complete. Image URL saved in your media library.';
      $('#upload-form').reset();
      $('#upload-preview').hidden = true;
      toast('Image uploaded and saved.');
      const target = state.focusedUrl;
      if (target && target.isConnected) target.value = result.image.url;
    } catch (error) { status.textContent = error.message; toast(error.message, true); }
  }

  async function previewVideo(event) {
    event.preventDefault();
    try {
      const result = await request(`api/admin/video-preview?url=${encodeURIComponent($('#video-url').value.trim())}`);
      if (!['iframe', 'video'].includes(result.type)) throw new Error('This link does not have a supported embedded player.');
      window.MexaVideoPreview?.open(result);
    } catch (error) { toast(error.message, true); }
  }

  async function changePassword(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    try {
      await request('api/admin/password', { method: 'POST', body: JSON.stringify(values) });
      form.reset();
      toast('Admin password updated.');
    } catch (error) { toast(error.message, true); }
  }

  document.addEventListener('click', (event) => {
    handleVideoLibraryAction(event);
    const reviewAction = event.target.closest('[data-review-action]');
    if (reviewAction) { decideReview(reviewAction.dataset.id, reviewAction.dataset.reviewAction); return; }
    const profileAction = event.target.closest('[data-profile-action]');
    if (profileAction) { decideTeamProfile(profileAction.dataset.id, profileAction.dataset.profileAction); return; }
    const moderatorAction = event.target.closest('[data-disable-moderator]');
    if (moderatorAction) {
      if (!window.confirm('Deactivate this moderator account? They will be signed out on the next request.')) return;
      request(`api/admin/moderators/${encodeURIComponent(moderatorAction.dataset.disableModerator)}`, { method: 'DELETE' }).then(renderModerators).then(() => toast('Moderator deactivated.')).catch((error) => toast(error.message, true));
      return;
    }
    const nav = event.target.closest('[data-view]');
    if (nav) openPanel(nav.dataset.view);
    const jump = event.target.closest('[data-jump]');
    if (jump) openPanel(jump.dataset.jump);
    const add = event.target.closest('[data-add]');
    if (add) addRecord(add.dataset.add);
    if (event.target.closest('[data-close]')) $('#editor-drawer').hidden = true;
  });
  $('#mobile-menu').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
  $('#portfolio-kind').addEventListener('change', renderPortfolio);
  $('#editor-page').addEventListener('change', loadPreview);
  $('#inspector-form').addEventListener('submit', savePageOverride);
  $('#save-record').addEventListener('click', saveRecord);
  $('#upload-form').addEventListener('submit', uploadImage);
  $('#refresh-images').addEventListener('click', loadImages);
  $('#video-form').addEventListener('submit', previewVideo);
  $('#add-video-record').addEventListener('click', () => openVideoEditor());
  $('#cancel-video-record').addEventListener('click', () => { $('#video-library-form').hidden = true; });
  $('#video-library-form').addEventListener('submit', saveVideoLibrary);
  $('#video-library-search').addEventListener('input', () => { state.videoPage = 1; renderVideoLibrary(); });
  $('#video-library-filter').addEventListener('change', () => { state.videoPage = 1; renderVideoLibrary(); });
  $('#video-library-prev').addEventListener('click', () => { state.videoPage = Math.max(1, state.videoPage - 1); renderVideoLibrary(); });
  $('#video-library-next').addEventListener('click', () => { state.videoPage += 1; renderVideoLibrary(); });
  $('#preview-video-record').addEventListener('click', previewLibraryVideo);
  $('#password-form').addEventListener('submit', changePassword);
  $('#home-media-form').addEventListener('submit', saveHomeMedia);
  $('#save-home-sections').addEventListener('click', saveHomeSections);
  $('#work-categories-form').addEventListener('submit', saveWorkCategories);
  $('#moderator-form').addEventListener('submit', saveModerator);
  $('#refresh-approvals').addEventListener('click', loadApprovals);
  window.addEventListener('message', receiveSelection);
  document.addEventListener('focusin', (event) => { if (/url|image|photo|thumbnail|video|logo|favicon/i.test(event.target.id || event.target.name || event.target.dataset?.settingKey || event.target.dataset?.key || '')) state.focusedUrl = event.target; });
  $('#image-file').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const preview = $('#upload-preview');
    preview.hidden = false;
    preview.querySelector('img').src = URL.createObjectURL(file);
    preview.querySelector('span').textContent = file.name;
  });
  loadState();
})();
