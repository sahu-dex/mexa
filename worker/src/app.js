// Native Cloudflare Durable Object SQLite application engine for MEXA MOTION.
// Implements the full Laravel 12 route, session, CSRF, validation, media, video
// catalog, approval, and Blade rendering contract directly on Durable Object SQLite.

import {
  SECTIONS,
  WORK_SECTIONS,
  buildBridgeScript,
  buildPageLayoutScript,
  containsInlineMedia,
  decorateServices,
  decorateVideoItem,
  defaultHomeSections,
  extensionForMime,
  filterPublishedPackages,
  filterPublishedPortfolio,
  getRawSnapshot,
  getSiteDefaults,
  hashPassword,
  isActiveFlag,
  isHttpUrl,
  isSafeFilename,
  isSafeLink,
  isSafeMediaUrl,
  jsonForScript,
  randomToken,
  resolveVideoEmbed,
  sha256Hex,
  sortRecords,
  verifyPassword,
} from "./support.js";
import {
  makeUrlBuilder,
  renderAdminDashboard,
  renderAdminLogin,
  renderAdminSetup,
  renderError404,
  renderPublicPage,
  renderTeamProfile,
} from "./views.js";

const SESSION_COOKIE = "mexa_session";
const CHUNK_SIZE = 512 * 1024; // 512 KiB per SQLite BLOB chunk (well under DO SQLite's 2 MiB row limit)
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

class HttpException extends Error {
  constructor(status, message, errors = null) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function nowSqlTimestamp() {
  return new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
}

function parseCookies(cookieHeader) {
  const map = {};
  if (!cookieHeader) return map;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    try {
      map[k] = decodeURIComponent(v);
    } catch {
      map[k] = v;
    }
  }
  return map;
}

function expectsJson(request, pathname) {
  if (pathname.startsWith("/api/")) return true;
  const accept = (request.headers.get("accept") || "").toLowerCase();
  return accept.includes("application/json");
}

function publicOrigin(request, env) {
  if (typeof env?.APP_URL === "string" && isHttpUrl(env.APP_URL)) {
    return env.APP_URL.trim().replace(/\/+$/, "");
  }
  const u = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto") || u.protocol.replace(":", "") || "https";
  const host = request.headers.get("x-forwarded-host") || u.host;
  return `${proto}://${host}`;
}

function clientIp(request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "0.0.0.0"
  );
}

export class MexaEdgeApp {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.sql = ctx.storage.sql;
    this.env = env;
    this.schemaReady = false;
  }

  ensureSchema() {
    if (this.schemaReady) return;
    this.sql.exec(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        email_verified_at TEXT,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'moderator',
        is_active INTEGER NOT NULL DEFAULT 1,
        remember_token TEXT,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS site_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        section TEXT NOT NULL UNIQUE,
        payload TEXT NOT NULL,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS media_assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT UNIQUE,
        url TEXT NOT NULL,
        thumbnail_url TEXT,
        provider TEXT NOT NULL DEFAULT 'local',
        name TEXT,
        mime_type TEXT,
        size_bytes INTEGER,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS media_chunks (
        asset_id INTEGER NOT NULL,
        chunk_index INTEGER NOT NULL,
        data BLOB NOT NULL,
        PRIMARY KEY (asset_id, chunk_index),
        FOREIGN KEY (asset_id) REFERENCES media_assets(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS video_library (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url_hash TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        description TEXT,
        url TEXT NOT NULL,
        provider TEXT NOT NULL,
        embed_type TEXT NOT NULL,
        embed_url TEXT,
        thumbnail_url TEXT,
        category TEXT,
        is_featured INTEGER NOT NULL DEFAULT 0,
        is_enabled INTEGER NOT NULL DEFAULT 1,
        display_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS video_placements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id INTEGER NOT NULL,
        page TEXT NOT NULL,
        section TEXT NOT NULL,
        item_key TEXT NOT NULL DEFAULT '',
        service_id TEXT,
        created_at TEXT,
        updated_at TEXT,
        UNIQUE (video_id, page, section, item_key),
        FOREIGN KEY (video_id) REFERENCES video_library(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS video_placement_lookup
        ON video_placements (page, section, service_id);

      CREATE TABLE IF NOT EXISTS team_profile_access (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id TEXT NOT NULL UNIQUE,
        token_hash TEXT NOT NULL UNIQUE,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS team_profile_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        submitted_at TEXT NOT NULL,
        reviewed_by INTEGER,
        reviewed_at TEXT,
        created_at TEXT,
        updated_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_team_submissions_status
        ON team_profile_submissions (status);

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER,
        ip_address TEXT,
        user_agent TEXT,
        payload TEXT NOT NULL,
        last_activity INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_activity
        ON sessions (last_activity);

      CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        hits INTEGER NOT NULL DEFAULT 0,
        reset_at INTEGER NOT NULL
      );
    `);
    this.schemaReady = true;
  }

  // --- Session & Rate Limiting ----------------------------------------------

  sessionLifetimeSec() {
    const mins = Number.parseInt(this.env?.SESSION_LIFETIME ?? "120", 10);
    return (Number.isInteger(mins) && mins > 0 ? mins : 120) * 60;
  }

  loadSession(request) {
    const nowSec = Math.floor(Date.now() / 1000);
    const lifetime = this.sessionLifetimeSec();
    if (Math.random() < 0.05) {
      this.sql.exec("DELETE FROM sessions WHERE last_activity < ?", nowSec - lifetime);
      this.sql.exec("DELETE FROM rate_limits WHERE reset_at < ?", nowSec);
    }

    const cookies = parseCookies(request.headers.get("cookie"));
    const incomingId = cookies[SESSION_COOKIE];
    if (incomingId && /^[A-Za-z0-9]{32,80}$/.test(incomingId)) {
      const rows = this.sql
        .exec("SELECT id, payload, last_activity FROM sessions WHERE id = ?", incomingId)
        .toArray();
      if (rows.length > 0 && rows[0].last_activity >= nowSec - lifetime) {
        let data = {};
        try {
          data = JSON.parse(rows[0].payload) || {};
        } catch {
          data = {};
        }
        if (!data.csrf_token) {
          data.csrf_token = randomToken(40);
        }
        return {
          id: incomingId,
          data,
          dirty: false,
          isNew: false,
          cookieChanged: false,
        };
      }
    }

    const newId = randomToken(48);
    return {
      id: newId,
      data: { csrf_token: randomToken(40) },
      dirty: true,
      isNew: true,
      cookieChanged: true,
    };
  }

  regenerateSession(session, preserveToken = false) {
    const oldId = session.id;
    this.sql.exec("DELETE FROM sessions WHERE id = ?", oldId);
    session.id = randomToken(48);
    if (!preserveToken) {
      session.data.csrf_token = randomToken(40);
    }
    session.dirty = true;
    session.cookieChanged = true;
  }

  invalidateSession(session) {
    this.sql.exec("DELETE FROM sessions WHERE id = ?", session.id);
    session.id = randomToken(48);
    session.data = { csrf_token: randomToken(40) };
    session.dirty = true;
    session.cookieChanged = true;
  }

  persistSession(request, session) {
    if (!session.dirty && !session.isNew) {
      return null;
    }
    const nowSec = Math.floor(Date.now() / 1000);
    const userId = session.data.admin_user_id ?? null;
    const ip = clientIp(request);
    const ua = (request.headers.get("user-agent") || "").slice(0, 500);
    const payload = JSON.stringify(session.data);
    this.sql.exec(
      `INSERT INTO sessions (id, user_id, ip_address, user_agent, payload, last_activity)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         user_id = excluded.user_id,
         ip_address = excluded.ip_address,
         user_agent = excluded.user_agent,
         payload = excluded.payload,
         last_activity = excluded.last_activity`,
      session.id,
      userId,
      ip,
      ua,
      payload,
      nowSec,
    );

    if (!session.cookieChanged && !session.isNew) {
      return null;
    }

    const proto =
      request.headers.get("x-forwarded-proto") ||
      new URL(request.url).protocol.replace(":", "");
    const secure = proto === "https" && this.env?.SESSION_SECURE_COOKIE !== "false";
    const parts = [
      `${SESSION_COOKIE}=${encodeURIComponent(session.id)}`,
      "Path=/",
      `Max-Age=${this.sessionLifetimeSec()}`,
      "HttpOnly",
      "SameSite=Lax",
    ];
    if (secure) parts.push("Secure");
    return parts.join("; ");
  }

  checkRateLimit(key, maxAttempts, windowSec = 60) {
    const nowSec = Math.floor(Date.now() / 1000);
    const rows = this.sql
      .exec("SELECT hits, reset_at FROM rate_limits WHERE key = ?", key)
      .toArray();
    if (rows.length === 0 || rows[0].reset_at <= nowSec) {
      this.sql.exec(
        `INSERT INTO rate_limits (key, hits, reset_at) VALUES (?, 1, ?)
         ON CONFLICT(key) DO UPDATE SET hits = 1, reset_at = excluded.reset_at`,
        key,
        nowSec + windowSec,
      );
      return true;
    }
    if (rows[0].hits >= maxAttempts) {
      return false;
    }
    this.sql.exec("UPDATE rate_limits SET hits = hits + 1 WHERE key = ?", key);
    return true;
  }

  tooManyAttempts(key, maxAttempts) {
    const nowSec = Math.floor(Date.now() / 1000);
    const rows = this.sql
      .exec("SELECT hits, reset_at FROM rate_limits WHERE key = ?", key)
      .toArray();
    return rows.length > 0 && rows[0].reset_at > nowSec && rows[0].hits >= maxAttempts;
  }

  hitRateLimit(key, windowSec = 60) {
    const nowSec = Math.floor(Date.now() / 1000);
    const rows = this.sql
      .exec("SELECT hits, reset_at FROM rate_limits WHERE key = ?", key)
      .toArray();
    if (rows.length === 0 || rows[0].reset_at <= nowSec) {
      this.sql.exec(
        `INSERT INTO rate_limits (key, hits, reset_at) VALUES (?, 1, ?)
         ON CONFLICT(key) DO UPDATE SET hits = 1, reset_at = excluded.reset_at`,
        key,
        nowSec + windowSec,
      );
    } else {
      this.sql.exec("UPDATE rate_limits SET hits = hits + 1 WHERE key = ?", key);
    }
  }

  clearRateLimit(key) {
    this.sql.exec("DELETE FROM rate_limits WHERE key = ?", key);
  }

  // --- SiteData & VideoCatalog ----------------------------------------------

  siteDataAll() {
    const defaults = getSiteDefaults();
    const rows = this.sql.exec("SELECT section, payload FROM site_data").toArray();
    for (const row of rows) {
      defaults[row.section] = JSON.parse(row.payload);
    }
    return defaults;
  }

  siteDataGet(section) {
    const rows = this.sql
      .exec("SELECT payload FROM site_data WHERE section = ?", section)
      .toArray();
    if (rows.length === 0) {
      return getSiteDefaults()[section] ?? [];
    }
    return JSON.parse(rows[0].payload);
  }

  siteDataPut(section, payload) {
    const json = JSON.stringify(payload);
    const ts = nowSqlTimestamp();
    this.sql.exec(
      `INSERT INTO site_data (section, payload, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(section) DO UPDATE SET
         payload = excluded.payload,
         updated_at = excluded.updated_at`,
      section,
      json,
      ts,
      ts,
    );
  }

  attachVideoPlacement(videoId, page, section, itemKey = "", serviceId = null) {
    let key = String(itemKey ?? "");
    if (serviceId !== null && serviceId !== undefined && key === "") {
      key = String(serviceId);
    }
    key = key.slice(0, 60);
    const svc = serviceId === null || serviceId === undefined || serviceId === "" ? null : String(serviceId);
    const ts = nowSqlTimestamp();
    this.sql.exec(
      `INSERT INTO video_placements (video_id, page, section, item_key, service_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(video_id, page, section, item_key) DO UPDATE SET
         service_id = excluded.service_id,
         updated_at = excluded.updated_at`,
      videoId,
      page,
      section,
      key,
      svc,
      ts,
      ts,
    );
  }

  validThumbnail(url) {
    const clean = String(url ?? "").trim();
    return isHttpUrl(clean) ? clean.slice(0, 2048) : null;
  }

  allVideoRowsWithPlacements(enabledOnly = false) {
    const sqlQuery = enabledOnly
      ? "SELECT * FROM video_library WHERE is_enabled = 1 ORDER BY display_order ASC, id ASC"
      : "SELECT * FROM video_library ORDER BY display_order ASC, id ASC";
    const rows = this.sql.exec(sqlQuery).toArray();
    if (rows.length === 0) return [];

    const allPlacements = this.sql
      .exec("SELECT * FROM video_placements ORDER BY page ASC, section ASC, id ASC")
      .toArray();
    const byVideo = new Map();
    for (const p of allPlacements) {
      const list = byVideo.get(p.video_id) || [];
      list.push({
        page: String(p.page),
        section: String(p.section),
        item_key: String(p.item_key ?? ""),
        service_id: p.service_id === null || p.service_id === undefined ? null : String(p.service_id),
      });
      byVideo.set(p.video_id, list);
    }

    return rows.map((row) => ({
      ...row,
      id: Number(row.id),
      url: String(row.url),
      is_enabled: Boolean(row.is_enabled),
      is_featured: Boolean(row.is_featured),
      display_order: Number(row.display_order || 0),
      placements: byVideo.get(row.id) || [],
    }));
  }

  videoRecords(enabledOnly = false) {
    return this.allVideoRowsWithPlacements(enabledOnly).map((row) => {
      const resolved = resolveVideoEmbed(row.url);
      return {
        id: row.id,
        title: String(row.title),
        description: String(row.description ?? ""),
        url: row.url,
        video_url: row.url,
        provider: resolved.provider,
        source_type: resolved.provider,
        embed_type: resolved.type,
        embed_url: resolved.embed_url,
        thumbnail_url: String(row.thumbnail_url || resolved.thumbnail_url || ""),
        category: String(row.category ?? ""),
        is_featured: row.is_featured,
        is_enabled: row.is_enabled,
        status: row.is_enabled ? "active" : "disabled",
        display_order: row.display_order,
        created_at: row.created_at,
        updated_at: row.updated_at,
        placements: row.placements,
      };
    });
  }

  async importLegacyVideos() {
    const entries = [];
    const portfolio = this.siteDataGet("portfolio");
    for (const section of WORK_SECTIONS) {
      const urlKey = section === "videos" ? "video_url" : "url";
      for (const item of portfolio?.[section] ?? []) {
        if (!item || typeof item !== "object" || (item.kind ?? "video") === "image" || !item[urlKey]) {
          continue;
        }
        entries.push({
          page: "work",
          section,
          item_key: String(item.id ?? ""),
          service_id: null,
          item,
          url: String(item[urlKey]),
        });
      }
    }

    const settings = this.siteDataGet("settings");
    const content = settings?.content ?? {};
    if (content.overview_video_url) {
      entries.push({
        page: "service",
        section: "overview",
        item_key: "",
        service_id: null,
        item: {
          title: "Services overview",
          thumbnail_url: content.overview_poster_url ?? "",
        },
        url: String(content.overview_video_url),
      });
    }

    for (const service of this.siteDataGet("services") ?? []) {
      if (!service || typeof service !== "object") continue;
      const serviceId = String(service.id ?? "");
      if (serviceId !== "" && service.main_video_url) {
        entries.push({
          page: "service",
          section: "service-card",
          item_key: serviceId,
          service_id: serviceId,
          item: {
            title: String(service.name ?? "Service video"),
            description: String(service.subtitle ?? service.description ?? ""),
            thumbnail_url: service.video_thumbnail ?? "",
            category: service.name ?? "",
          },
          url: String(service.main_video_url),
        });
      }
      for (const demo of service.demo_videos ?? []) {
        if (!demo || typeof demo !== "object" || !demo.video_url) continue;
        entries.push({
          page: "service",
          section: "service-demo",
          item_key: String(demo.id ?? ""),
          service_id: serviceId || null,
          item: { ...demo, category: service.name ?? "" },
          url: String(demo.video_url),
        });
      }
    }

    const prepared = [];
    for (const entry of entries) {
      const cleanUrl = entry.url.trim();
      const resolved = resolveVideoEmbed(cleanUrl);
      if (resolved.type !== "iframe" && resolved.type !== "video") continue;
      const hash = await sha256Hex(cleanUrl);
      prepared.push({ ...entry, cleanUrl, resolved, hash });
    }

    let created = 0;
    const ts = nowSqlTimestamp();
    this.ctx.storage.transactionSync(() => {
      for (const entry of prepared) {
        let existing = this.sql
          .exec("SELECT id FROM video_library WHERE url_hash = ?", entry.hash)
          .toArray()[0];
        if (!existing) {
          const item = entry.item;
          const fallbackTitle = `${entry.resolved.provider.charAt(0).toUpperCase()}${entry.resolved.provider.slice(1)} video`;
          const title = (String(item.title ?? item.name ?? fallbackTitle).trim() || fallbackTitle).slice(0, 180);
          const desc = String(item.description ?? "").trim().slice(0, 5000) || null;
          const thumb = this.validThumbnail(
            item.thumbnail_url ?? item.video_thumbnail ?? entry.resolved.thumbnail_url ?? "",
          );
          const cat = String(item.category ?? "").trim().slice(0, 120) || null;
          const featured = item.is_featured ? 1 : 0;
          const enabled = ["draft", "disabled", "inactive"].includes(String(item.status ?? "done")) ? 0 : 1;
          const order = Math.max(0, Number.parseInt(String(item.sort_order ?? 0), 10) || 0);

          const inserted = this.sql
            .exec(
              `INSERT INTO video_library
               (url_hash, title, description, url, provider, embed_type, embed_url, thumbnail_url, category, is_featured, is_enabled, display_order, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               RETURNING id`,
              entry.hash,
              title,
              desc,
              entry.cleanUrl,
              entry.resolved.provider,
              entry.resolved.type,
              entry.resolved.embed_url || null,
              thumb,
              cat,
              featured,
              enabled,
              order,
              ts,
              ts,
            )
            .toArray();
          existing = inserted[0];
          created++;
        }
        this.attachVideoPlacement(
          Number(existing.id),
          entry.page,
          entry.section,
          entry.item_key,
          entry.service_id,
        );
      }
    });

    return created;
  }

  findLegacyVideoRecord(records, page, section, itemKey, urlHash) {
    for (const record of records) {
      for (const placement of record.placements) {
        if (placement.page === page && placement.section === section && itemKey !== "" && placement.item_key === itemKey) {
          return record;
        }
      }
    }
    if (urlHash) {
      for (const record of records) {
        if ((record.url_hash ?? "") === urlHash) {
          return record;
        }
      }
    }
    return null;
  }

  legacyVideoFields(record, urlKey = "url") {
    return {
      title: String(record.title),
      description: String(record.description ?? ""),
      thumbnail_url: String(record.thumbnail_url ?? ""),
      kind: "video",
      platform: String(record.provider),
      category: String(record.category ?? ""),
      is_featured: Boolean(record.is_featured),
      status: "done",
      sort_order: Number(record.display_order || 0),
      embed_provider: String(record.provider),
      embed_type: String(record.embed_type),
      embed_url: String(record.embed_url ?? ""),
      [urlKey]: String(record.url),
      url: String(record.url),
    };
  }

  hydrateVideoCatalog(data) {
    const rows = this.allVideoRowsWithPlacements(false);
    if (rows.length === 0) {
      return data;
    }

    const urlToRecord = new Map(rows.map((r) => [r.url.trim(), r]));

    const work = { ...(data.portfolio ?? {}) };
    for (const section of WORK_SECTIONS) {
      const urlKey = section === "videos" ? "video_url" : "url";
      const items = [];
      const matched = new Set();
      for (const rawItem of work[section] ?? []) {
        if (!rawItem || typeof rawItem !== "object" || (rawItem.kind ?? "video") === "image") {
          items.push(rawItem);
          continue;
        }
        const itemUrl = String(rawItem[urlKey] ?? rawItem.url ?? "").trim();
        const urlMatch = urlToRecord.get(itemUrl);
        const record = this.findLegacyVideoRecord(
          rows,
          "work",
          section,
          String(rawItem.id ?? ""),
          urlMatch?.url_hash ?? "",
        );
        if (record && !record.is_enabled) {
          matched.add(record.id);
          continue;
        }
        let item = { ...rawItem };
        if (record) {
          matched.add(record.id);
          item = { ...item, ...this.legacyVideoFields(record, urlKey) };
        }
        items.push(item);
      }
      for (const record of rows) {
        if (!record.is_enabled || matched.has(record.id)) continue;
        for (const placement of record.placements) {
          if (placement.page === "work" && placement.section === section) {
            items.push(this.legacyVideoFields(record, urlKey));
            matched.add(record.id);
            break;
          }
        }
      }
      work[section] = items;
    }
    data.portfolio = work;

    const services = (data.services ?? []).map((rawSvc) => {
      if (!rawSvc || typeof rawSvc !== "object") return rawSvc;
      const service = { ...rawSvc };
      const serviceId = String(service.id ?? "");
      for (const record of rows) {
        for (const placement of record.placements) {
          if (placement.page !== "service" || String(placement.service_id ?? "") !== serviceId) {
            continue;
          }
          if (placement.section === "service-card") {
            if (!record.is_enabled) {
              service.main_video_url = "";
              service.video_thumbnail = "";
              service.media = {
                ...(service.media ?? {}),
                type: service.image_url ? "image" : "none",
                videoUrl: "",
                thumbnail: "",
              };
              continue;
            }
            service.main_video_url = record.url;
            service.video_thumbnail = record.thumbnail_url ?? "";
            service.media = {
              ...(service.media ?? {}),
              type: "video",
              videoUrl: record.url,
              thumbnail: record.thumbnail_url ?? "",
              embedType: record.embed_type,
              embedUrl: record.embed_url ?? "",
              provider: record.provider,
            };
          }
          if (placement.section === "service-demo") {
            const demos = Array.isArray(service.demo_videos) ? [...service.demo_videos] : [];
            let found = false;
            const nextDemos = [];
            for (const demo of demos) {
              if (
                String(demo?.id ?? "") === String(placement.item_key) ||
                (demo?.video_url ?? "") === record.url
              ) {
                found = true;
                if (record.is_enabled) {
                  nextDemos.push({ ...demo, ...this.legacyVideoFields(record, "video_url") });
                }
              } else {
                nextDemos.push(demo);
              }
            }
            if (!found && record.is_enabled) {
              nextDemos.push(this.legacyVideoFields(record, "video_url"));
            }
            service.demo_videos = nextDemos;
          }
        }
      }
      if (!service.main_video_url && service.image_url) {
        service.media = {
          ...(service.media ?? {}),
          type: "image",
          imageUrl: service.image_url,
        };
      }
      return service;
    });
    data.services = services;

    const settings = { ...(data.settings ?? {}) };
    const content = { ...(settings.content ?? {}) };
    for (const record of rows) {
      for (const placement of record.placements) {
        if (placement.page !== "service" || placement.section !== "overview") continue;
        if (record.is_enabled) {
          content.overview_video_url = record.url;
          content.overview_video_embed_type = record.embed_type;
          content.overview_video_embed_url = record.embed_url ?? "";
          content.overview_video_provider = record.provider;
          content.overview_poster_url = record.thumbnail_url || content.overview_poster_url || "";
        } else {
          content.overview_video_url = "";
          content.overview_video_embed_type = "";
          content.overview_video_embed_url = "";
          content.overview_video_provider = "";
        }
      }
    }
    settings.content = content;
    data.settings = settings;

    return data;
  }

  // --- Public Page Rendering (SitePageController) ---------------------------

  buildPageSnapshot(data) {
    const snapshot = getRawSnapshot();
    const settings = data.settings ?? {};
    const content = { ...(settings.content ?? {}) };
    if (content.overview_video_url) {
      const overview = resolveVideoEmbed(String(content.overview_video_url));
      content.overview_video_embed_type = overview.type;
      content.overview_video_embed_url = overview.embed_url;
      content.overview_video_provider = overview.provider;
    }

    const team = { ...(data.team ?? {}) };
    team.members = sortRecords(
      (team.members ?? []).filter((row) => isActiveFlag(row?.is_active, true)),
      "sort_order",
    );

    const work = filterPublishedPortfolio(data.portfolio ?? {});
    for (const key of WORK_SECTIONS) {
      const urlKey = key === "videos" ? "video_url" : "url";
      work[key] = (work[key] ?? []).map((item) => decorateVideoItem(item, urlKey));
    }

    const activeServices = sortRecords(
      (data.services ?? []).filter((row) => isActiveFlag(row?.active, true)),
      "display_order",
      "sort_order",
    );
    const services = decorateServices(activeServices);

    let approvedReviews = (data.reviews ?? []).filter(
      (row) => (row?.status ?? "pending") === "approved",
    );
    if (approvedReviews.some((row) => row && Object.prototype.hasOwnProperty.call(row, "display_order"))) {
      approvedReviews = sortRecords(approvedReviews, "display_order");
    }

    const ratings = approvedReviews.map((r) => Number.parseInt(String(r?.rating ?? 5), 10) || 5);
    const seedReviews = getSiteDefaults().reviews ?? [];
    const storedReviewStats = settings.review_stats ?? {};
    const isUnmodifiedSeed =
      approvedReviews.length === seedReviews.length &&
      approvedReviews.every((r) => String(r?.created_at ?? "").startsWith("2026-10-"));

    const reviewStats = isUnmodifiedSeed
      ? storedReviewStats
      : {
          count: approvedReviews.length,
          average: ratings.length
            ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
            : 0,
          five: ratings.filter((r) => r === 5).length,
        };

    content.purchase = settings.purchase ?? {};
    snapshot["/api/public/content"] = content;
    snapshot["/api/public/services"] = { services };
    snapshot["/api/public/packages"] = {
      packages: filterPublishedPackages(data.packages ?? []),
    };
    snapshot["/api/public/team"] = team;
    snapshot["/api/public/work"] = work;
    snapshot["/api/public/reviews"] = {
      items: approvedReviews,
      stats: reviewStats,
      settings: {
        review_heading: content.review_heading ?? "Client Reviews",
        review_hero_image: content.review_hero_image ?? "",
        review_hero_desc: content.review_hero_desc ?? "",
      },
      offset: 0,
      limit: 20,
    };
    snapshot["/api/public/contact"] = {
      ...(settings.contact ?? {}),
      purchase: settings.purchase ?? {},
      social: settings.social ?? {},
    };
    snapshot["/api/public/videos"] = { videos: this.videoRecords(true) };

    return snapshot;
  }

  buildServiceCatalog(data) {
    const packages = filterPublishedPackages(data.packages ?? []);
    const activeServices = (data.services ?? []).filter((row) => isActiveFlag(row?.active, true));
    const orderedServices = sortRecords(activeServices, "display_order", "sort_order");
    const services = [];

    for (const service of decorateServices(orderedServices)) {
      const features = Array.isArray(service.features)
        ? service.features
        : String(service.bullet_points ?? "")
            .split(/\r?\n/)
            .filter(Boolean);
      const serviceId = Number.parseInt(String(service.id ?? services.length + 1), 10) || services.length + 1;
      const base = Number(service.priceFrom ?? service.price_from ?? 40) || 40;
      const currency = service.currency ?? "USD";

      services.push({
        id: serviceId,
        name: service.name ?? "Service",
        label: service.label ?? service.category ?? "Service",
        subtitle: service.subtitle ?? service.description ?? "",
        description: service.longDescription ?? service.long_description ?? service.description ?? "",
        features: [...features],
        deliverables: service.deliverables ?? "",
        priceFrom: base,
        currency,
        icon: service.icon ?? "fa-solid fa-video",
        media: {
          type:
            service.media?.type ??
            service.media_type ??
            (service.image_url ? "image" : service.main_video_url ? "video" : "none"),
          imageUrl: service.media?.imageUrl ?? service.image_url ?? "",
          videoUrl: service.media?.videoUrl ?? service.main_video_url ?? "",
          thumbnail: service.media?.thumbnail ?? service.video_thumbnail ?? "",
          embedType: service.media?.embedType ?? service.main_video_embed_type ?? "",
          embedUrl: service.media?.embedUrl ?? service.main_video_embed_url ?? "",
          provider: service.media?.provider ?? service.main_video_provider ?? "",
        },
        active: isActiveFlag(service.active, true),
      });
    }

    return { version: 1, services, packages };
  }

  handlePublicPage(page, request, urlObj, origin, session) {
    const cmsPreview = urlObj.searchParams.get("cms_preview");
    if (cmsPreview === "1" || cmsPreview === "true") {
      const adminUser = this.currentAdminUser(session);
      if (!adminUser) {
        throw new HttpException(403, "Forbidden.");
      }
    }

    const data = this.hydrateVideoCatalog(this.siteDataAll());
    const snapshot = this.buildPageSnapshot(data);
    const snapshotJson = jsonForScript(snapshot);
    const bootstrap = {
      mm_svc_catalog_v1: this.buildServiceCatalog(data),
      mm_team_db_v1: snapshot["/api/public/team"] ?? data.team,
      mm_bookings_v1: data.bookings,
    };
    const bootstrapJson = jsonForScript(bootstrap);
    const settings = data.settings ?? {};
    const pageContentJson = jsonForScript(settings.page_content?.[page] ?? {});
    const baseJson = jsonForScript(origin);
    const publicVideosJson = jsonForScript(this.videoRecords(true));
    const purchaseInfo = settings.purchase ?? {};
    const homeSections = settings.home_sections ?? defaultHomeSections();
    const homeSectionsJson = jsonForScript(homeSections);
    const homeMediaJson = jsonForScript(settings.home_media ?? {});
    const siteSettingsJson = jsonForScript({
      seo: settings.seo ?? {},
      logo_url: settings.logo_url ?? "",
      favicon_url: settings.favicon_url ?? "",
      footer: settings.footer ?? {},
      social: settings.social ?? {},
    });
    const bridgeScript =
      buildBridgeScript(
        bootstrapJson,
        page,
        pageContentJson,
        baseJson,
        homeSectionsJson,
        homeMediaJson,
        siteSettingsJson,
      ) + buildPageLayoutScript(pageContentJson);
    const serviceIntro = String(
      settings.content?.services_intro ??
        "Explore the MEXA MOTION service catalogue and choose the editing package that fits your project.",
    );

    const html = renderPublicPage({
      page,
      origin,
      csrfToken: session.data.csrf_token,
      snapshotJson,
      bridgeScript,
      publicVideosJson,
      serviceIntro,
      purchaseInfo,
    });

    return new Response(request.method === "HEAD" ? null : html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=UTF-8",
        "Cache-Control": "no-store",
      },
    });
  }

  // --- Auth & Admin Helpers -------------------------------------------------

  hasAnyUsers() {
    return this.sql.exec("SELECT 1 FROM users LIMIT 1").toArray().length > 0;
  }

  currentAdminUser(session) {
    const id = session.data.admin_user_id;
    if (!id) return null;
    const rows = this.sql
      .exec("SELECT * FROM users WHERE id = ? AND is_active = 1", id)
      .toArray();
    return rows[0] ?? null;
  }

  requireAdmin(request, pathname, origin, session) {
    const user = this.currentAdminUser(session);
    if (!user) {
      if (session.data.admin_user_id) {
        delete session.data.admin_user_id;
        session.dirty = true;
      }
      if (expectsJson(request, pathname)) {
        throw new HttpException(401, "Your admin session has expired. Please sign in again.");
      }
      return { redirect: this.redirectResponse(makeUrlBuilder(origin)("/admin/login")) };
    }
    return { user };
  }

  requireOwner(user) {
    if (user?.role !== "owner") {
      throw new HttpException(403, "Only the website owner can manage this area.");
    }
  }

  redirectResponse(targetUrl, status = 302) {
    return new Response(null, {
      status,
      headers: { Location: targetUrl },
    });
  }

  jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "Cache-Control": "no-store",
      },
    });
  }

  async parseBody(request) {
    const ct = (request.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("application/json")) {
      try {
        return { kind: "json", data: (await request.json()) ?? {} };
      } catch {
        return { kind: "json", data: {} };
      }
    }
    if (ct.includes("multipart/form-data") || ct.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      const obj = {};
      for (const [k, v] of formData.entries()) {
        if (typeof v === "string") {
          obj[k] = v;
        }
      }
      return { kind: "form", data: obj, formData };
    }
    try {
      const text = await request.text();
      return { kind: "json", data: text ? JSON.parse(text) : {} };
    } catch {
      return { kind: "json", data: {} };
    }
  }

  verifyCsrf(request, session, parsedBody) {
    const headerToken =
      request.headers.get("x-csrf-token") ||
      parsedBody?.data?._token ||
      "";
    if (!headerToken || headerToken !== session.data.csrf_token) {
      throw new HttpException(419, "Your session security token expired. Reload the page and try again.");
    }
  }

  // --- Admin Auth Handlers --------------------------------------------------

  handleSetupForm(origin, session) {
    const url = makeUrlBuilder(origin);
    if (this.hasAnyUsers()) {
      return this.redirectResponse(url("/admin/login"));
    }
    const errorMessage = session.data.flash_error || "";
    const old = session.data.flash_old || {};
    if (session.data.flash_error || session.data.flash_old) {
      delete session.data.flash_error;
      delete session.data.flash_old;
      session.dirty = true;
    }
    return new Response(
      renderAdminSetup({
        origin,
        csrfToken: session.data.csrf_token,
        errorMessage,
        old,
      }),
      { status: 200, headers: { "Content-Type": "text/html; charset=UTF-8", "Cache-Control": "no-store" } },
    );
  }

  async handleSetupSubmit(request, origin, session, body) {
    const url = makeUrlBuilder(origin);
    if (!this.checkRateLimit(`setup:${clientIp(request)}`, 5, 60)) {
      throw new HttpException(429, "Too many setup attempts. Please wait a minute and try again.");
    }
    if (this.hasAnyUsers()) {
      throw new HttpException(403, "The first admin account has already been created.");
    }

    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const confirmation = String(body.password_confirmation ?? "");

    const fail = (msg) => {
      session.data.flash_error = msg;
      session.data.flash_old = { name, email };
      session.dirty = true;
      return this.redirectResponse(url("/admin/setup"));
    };

    if (!name || name.length > 120) return fail("Enter a valid admin name (up to 120 characters).");
    if (!email || email.length > 190 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail("Enter a valid email address.");
    }
    if (password.length < 12) return fail("The password must be at least 12 characters.");
    if (new TextEncoder().encode(password).byteLength > 72) {
      return fail("The password may not exceed 72 bytes.");
    }
    if (password !== confirmation) return fail("The password confirmation does not match.");

    const hashed = await hashPassword(password);
    const ts = nowSqlTimestamp();
    const inserted = this.sql
      .exec(
        `INSERT INTO users (name, email, password, role, is_active, created_at, updated_at)
         VALUES (?, ?, ?, 'owner', 1, ?, ?)
         RETURNING id`,
        name,
        email,
        hashed,
        ts,
        ts,
      )
      .toArray();

    this.regenerateSession(session);
    session.data.admin_user_id = Number(inserted[0].id);
    session.dirty = true;
    return this.redirectResponse(url("/admin"));
  }

  handleLoginForm(origin, session) {
    const url = makeUrlBuilder(origin);
    if (!this.hasAnyUsers()) {
      return this.redirectResponse(url("/admin/setup"));
    }
    if (this.currentAdminUser(session)) {
      return this.redirectResponse(url("/admin"));
    }
    const errorMessage = session.data.flash_error || "";
    const old = session.data.flash_old || {};
    if (session.data.flash_error || session.data.flash_old) {
      delete session.data.flash_error;
      delete session.data.flash_old;
      session.dirty = true;
    }
    return new Response(
      renderAdminLogin({
        origin,
        csrfToken: session.data.csrf_token,
        errorMessage,
        old,
      }),
      { status: 200, headers: { "Content-Type": "text/html; charset=UTF-8", "Cache-Control": "no-store" } },
    );
  }

  async handleLoginSubmit(request, origin, session, body) {
    const url = makeUrlBuilder(origin);
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const ip = clientIp(request);

    const fail = (msg) => {
      session.data.flash_error = msg;
      session.data.flash_old = { email };
      session.dirty = true;
      return this.redirectResponse(url("/admin/login"));
    };

    if (!email || !password) {
      return fail("Enter both your email address and password.");
    }

    const throttleKey = `admin-login:${email}|${ip}`;
    if (!this.checkRateLimit(`login-route:${ip}`, 8, 60) || this.tooManyAttempts(throttleKey, 8)) {
      return fail("Too many sign-in attempts. Please wait a minute and try again.");
    }

    const user = this.sql
      .exec("SELECT * FROM users WHERE email = ? LIMIT 1", email)
      .toArray()[0];

    if (!user || !user.is_active || !(await verifyPassword(password, user.password))) {
      this.hitRateLimit(throttleKey, 60);
      return fail("The email or password is incorrect.");
    }

    this.clearRateLimit(throttleKey);
    this.regenerateSession(session);
    session.data.admin_user_id = Number(user.id);
    session.dirty = true;
    return this.redirectResponse(url("/admin"));
  }

  handleDashboard(origin, session, adminUser) {
    const url = makeUrlBuilder(origin);
    if (!this.hasAnyUsers()) {
      return this.redirectResponse(url("/admin/setup"));
    }
    const html = renderAdminDashboard({
      origin,
      csrfToken: session.data.csrf_token,
      admin: adminUser,
    });
    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=UTF-8", "Cache-Control": "no-store" },
    });
  }

  handleLogout(origin, session) {
    this.invalidateSession(session);
    return this.redirectResponse(makeUrlBuilder(origin)("/admin/login"));
  }

  // --- Public API Handlers (SiteApiController & TeamProfileController) ------

  handlePublicReviews(urlObj) {
    const settingsContent = this.siteDataGet("settings")?.content ?? {};
    let all = (this.siteDataGet("reviews") ?? []).filter(
      (row) => (row?.status ?? "pending") === "approved",
    );
    if (all.some((row) => row && Object.prototype.hasOwnProperty.call(row, "display_order"))) {
      all = sortRecords(all, "display_order");
    } else {
      all = [...all].sort((a, b) =>
        String(b?.created_at ?? "").localeCompare(String(a?.created_at ?? "")),
      );
    }

    const rawLimit = Number.parseInt(urlObj.searchParams.get("limit") ?? "20", 10);
    const rawOffset = Number.parseInt(urlObj.searchParams.get("offset") ?? "0", 10);
    const limit = Math.min(50, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 20));
    const offset = Math.max(0, Number.isFinite(rawOffset) ? rawOffset : 0);

    const ratings = all.map((r) => Number.parseInt(String(r?.rating ?? 5), 10) || 5);
    const seedReviews = getSiteDefaults().reviews ?? [];
    const storedStats = this.siteDataGet("settings")?.review_stats ?? {};
    const isSeed =
      all.length === seedReviews.length &&
      all.every((r) => String(r?.created_at ?? "").startsWith("2026-10-"));

    const stats = isSeed
      ? storedStats
      : {
          count: all.length,
          average: all.length
            ? Math.round((ratings.reduce((a, b) => a + b, 0) / all.length) * 10) / 10
            : 0,
          five: ratings.filter((r) => r === 5).length,
        };

    return this.jsonResponse({
      items: all.slice(offset, offset + limit),
      stats,
      settings: {
        review_heading: settingsContent.review_heading ?? "Client Reviews",
        review_hero_image: settingsContent.review_hero_image ?? "",
        review_hero_desc: settingsContent.review_hero_desc ?? "",
      },
      offset,
      limit,
    });
  }

  handleSubmitReview(request, body) {
    if (!this.checkRateLimit(`reviews:${clientIp(request)}`, 10, 60)) {
      throw new HttpException(429, "Too many review submissions. Please wait a minute.");
    }
    const name = String(body.name ?? "").trim();
    const role = String(body.role ?? "").trim();
    const rating = Number.parseInt(String(body.rating ?? ""), 10);
    const reviewBody = String(body.body ?? "").trim();
    const photoUrl = String(body.photo_url ?? "").trim();

    if (!name || name.length > 120) {
      throw new HttpException(422, "Please enter your name (up to 120 characters).");
    }
    if (role.length > 160) {
      throw new HttpException(422, "Role may not exceed 160 characters.");
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new HttpException(422, "Rating must be between 1 and 5.");
    }
    if (reviewBody.length < 10 || reviewBody.length > 900) {
      throw new HttpException(422, "Review text must be between 10 and 900 characters.");
    }
    if (photoUrl !== "" && !isHttpUrl(photoUrl)) {
      throw new HttpException(422, "Photo URL must be a valid HTTP(S) link.");
    }

    const review = {
      id: crypto.randomUUID(),
      name,
      role,
      photo_url: photoUrl,
      rating,
      body: reviewBody,
      status: "pending",
      created_at: nowIso(),
    };

    this.ctx.storage.transactionSync(() => {
      const rows = [...(this.siteDataGet("reviews") ?? [])];
      rows.unshift(review);
      this.siteDataPut("reviews", rows);
    });

    return this.jsonResponse({ ok: true, status: "pending", id: review.id }, 201);
  }

  handleStorePublicData(request, body) {
    if (!this.checkRateLimit(`pub-storage:${clientIp(request)}`, 20, 60)) {
      throw new HttpException(429, "Too many requests. Please slow down.");
    }
    if (body.key !== "mm_bookings_v1" || !Array.isArray(body.value) || body.value.length > 500) {
      throw new HttpException(422, "Invalid booking payload.");
    }

    const rows = [...(this.siteDataGet("bookings") ?? [])];
    const knownIds = new Set(rows.map((r) => String(r?.id ?? "")));
    let added = 0;

    for (const ticket of body.value) {
      if (!ticket || typeof ticket !== "object" || !ticket.id || knownIds.has(String(ticket.id))) {
        continue;
      }
      const id = String(ticket.id).slice(0, 100);
      rows.push({
        id,
        ref: String(ticket.ref ?? "").slice(0, 80),
        serviceId: String(ticket.serviceId ?? "").slice(0, 80),
        serviceName: String(ticket.serviceName ?? "").slice(0, 180),
        quality: String(ticket.quality ?? "").slice(0, 40),
        packageName: String(ticket.packageName ?? "").slice(0, 180),
        price: Math.max(0, Number(ticket.price ?? 0) || 0),
        currency: String(ticket.currency ?? "USD").slice(0, 8),
        message: String(ticket.message ?? "").slice(0, 5000),
        status: "pending",
        createdAt: ticket.createdAt ?? nowIso(),
        updatedAt: nowIso(),
      });
      knownIds.add(id);
      added++;
    }

    if (added > 0) {
      this.siteDataPut("bookings", rows);
    }

    return this.jsonResponse({ ok: true, saved: added });
  }

  async resolveMemberForToken(token) {
    if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) {
      throw new HttpException(404, "Not Found.");
    }
    const tokenHash = await sha256Hex(token);
    const access = this.sql
      .exec("SELECT member_id FROM team_profile_access WHERE token_hash = ? LIMIT 1", tokenHash)
      .toArray()[0];
    if (!access) {
      throw new HttpException(404, "Not Found.");
    }
    const team = this.siteDataGet("team");
    const member = (team?.members ?? []).find(
      (m) => String(m?.id ?? "") === String(access.member_id),
    );
    if (!member) {
      throw new HttpException(404, "Not Found.");
    }
    return member;
  }

  async handleTeamProfileSubmit(request, token, body) {
    if (!this.checkRateLimit(`team-profile:${clientIp(request)}`, 5, 60)) {
      throw new HttpException(429, "Too many submissions. Please wait a minute.");
    }
    const member = await this.resolveMemberForToken(token);
    const name = String(body.name ?? "").trim();
    if (!name || name.length > 120) {
      throw new HttpException(422, "Please enter your full name (up to 120 characters).");
    }

    const urlFields = ["photo_url", "linkedin", "facebook", "instagram", "youtube", "website"];
    for (const field of urlFields) {
      const val = String(body[field] ?? "").trim();
      if (val !== "" && !isHttpUrl(val)) {
        throw new HttpException(422, `Enter a valid HTTP(S) URL for ${field}.`);
      }
    }
    const email = String(body.email ?? "").trim();
    if (email !== "" && (email.length > 190 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      throw new HttpException(422, "Enter a valid email address.");
    }

    const skills = Array.isArray(body.skills)
      ? body.skills.slice(0, 30).map((s) => String(s).trim().slice(0, 120)).filter(Boolean)
      : [];
    const responsibilities = Array.isArray(body.responsibilities)
      ? body.responsibilities.slice(0, 30).map((s) => String(s).trim().slice(0, 160)).filter(Boolean)
      : [];

    const payload = {
      name,
      role: String(body.role ?? "").trim().slice(0, 160),
      designation: String(body.designation ?? "").trim().slice(0, 160),
      photo_url: String(body.photo_url ?? "").trim(),
      bio: String(body.bio ?? "").slice(0, 3000),
      description: String(body.description ?? "").slice(0, 5000),
      skills,
      responsibilities,
      whatsapp: String(body.whatsapp ?? "").slice(0, 80),
      telegram: String(body.telegram ?? "").slice(0, 500),
      phone: String(body.phone ?? "").slice(0, 80),
      email,
      linkedin: String(body.linkedin ?? "").trim(),
      facebook: String(body.facebook ?? "").trim(),
      instagram: String(body.instagram ?? "").trim(),
      youtube: String(body.youtube ?? "").trim(),
      website: String(body.website ?? "").trim(),
    };

    const ts = nowSqlTimestamp();
    this.sql.exec(
      `INSERT INTO team_profile_submissions (member_id, payload, status, submitted_at, created_at, updated_at)
       VALUES (?, ?, 'pending', ?, ?, ?)`,
      String(member.id),
      JSON.stringify(payload),
      ts,
      ts,
      ts,
    );

    return this.jsonResponse(
      {
        ok: true,
        status: "pending",
        message: "Profile changes sent to the MEXA MOTION team for approval.",
      },
      201,
    );
  }

  // --- Admin Section Update & Management -----------------------------------

  handleUpdateSection(section, body) {
    if (!SECTIONS.includes(section)) {
      throw new HttpException(404, "Section not found.");
    }
    const payload = body?.payload;
    if (!payload || typeof payload !== "object") {
      throw new HttpException(422, "The section content must be a JSON object or array.");
    }
    if (containsInlineMedia(payload)) {
      throw new HttpException(
        422,
        "Upload images and videos as files; do not paste file data or data: URLs into content fields.",
      );
    }

    const encoded = JSON.stringify(payload);
    if (new TextEncoder().encode(encoded).byteLength > 2_000_000) {
      throw new HttpException(413, "This section is larger than the 2 MB limit.");
    }

    if (section === "packages") {
      if (!Array.isArray(payload)) {
        throw new HttpException(422, "Packages must be a list.");
      }
      for (const pkg of payload) {
        if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) {
          throw new HttpException(422, "Each package must be a structured record.");
        }
        const currency = String(pkg.currency ?? "USD").toUpperCase();
        if (!["USD", "USDT", "BDT"].includes(currency)) {
          throw new HttpException(422, "Package currency must be USD, USDT, or BDT.");
        }
        if (pkg.price !== undefined && (!Number.isFinite(Number(pkg.price)) || Number(pkg.price) < 0)) {
          throw new HttpException(422, "Package prices must be zero or greater.");
        }
        if (pkg.prices !== undefined) {
          if (!pkg.prices || typeof pkg.prices !== "object" || Array.isArray(pkg.prices)) {
            throw new HttpException(422, "Currency prices must be an object with separate amounts.");
          }
          if (pkg.prices[currency] === undefined || pkg.prices[currency] === "" || !Number.isFinite(Number(pkg.prices[currency]))) {
            throw new HttpException(
              422,
              "Enter a price for the selected currency. No exchange rate is applied automatically.",
            );
          }
          for (const [unit, amount] of Object.entries(pkg.prices)) {
            if (
              !["USD", "USDT", "BDT"].includes(String(unit).toUpperCase()) ||
              (amount !== null && amount !== "" && (!Number.isFinite(Number(amount)) || Number(amount) < 0))
            ) {
              throw new HttpException(422, "Enter a separate valid amount for each selected currency.");
            }
          }
        }
      }
    }

    if (section === "settings") {
      const media = payload.home_media ?? {};
      if (typeof media !== "object") {
        throw new HttpException(422, "Hero media settings must be a structured object.");
      }
      for (const key of ["image", "video"]) {
        const val = String(media[key] ?? "").trim();
        if (val !== "" && !isHttpUrl(val)) {
          throw new HttpException(422, "Hero media must use a public HTTP or HTTPS URL.");
        }
      }
      if (media.video && !/\.(mp4|webm|ogg)(?:[?#].*)?$/i.test(String(media.video))) {
        throw new HttpException(422, "The hero background video must be a direct MP4, WebM, or Ogg URL.");
      }
      for (const key of ["logo_url", "favicon_url"]) {
        const val = String(payload[key] ?? "").trim();
        if (val !== "" && !isHttpUrl(val)) {
          throw new HttpException(422, "Logo and favicon must use a public HTTP or HTTPS URL.");
        }
      }
      const purchase = payload.purchase ?? {};
      if (typeof purchase !== "object") {
        throw new HttpException(422, "Purchase information must be a structured object.");
      }
      const purchaseLink = String(purchase.button_link ?? "").trim();
      if (purchaseLink !== "" && !isSafeLink(purchaseLink)) {
        throw new HttpException(422, "Purchase buttons must use a safe HTTP(S), mailto, tel, or internal link.");
      }
      for (const key of ["whatsapp", "telegram"]) {
        const val = String(purchase[key] ?? "").trim();
        if (val !== "" && !isSafeLink(val)) {
          throw new HttpException(422, "Purchase contact links must use a safe URL.");
        }
      }
      for (const overrides of Object.values(payload.page_content ?? {})) {
        if (!overrides || typeof overrides !== "object") {
          throw new HttpException(422, "Page content overrides must be structured records.");
        }
        for (const override of Object.values(overrides)) {
          if (!override || typeof override !== "object") {
            throw new HttpException(422, "Page content overrides must be structured records.");
          }
          const src = String(override.src ?? "").trim();
          if (src !== "" && !isSafeMediaUrl(src)) {
            throw new HttpException(
              422,
              "Page images must use a public HTTP(S) URL or a site-relative path, not inline file data.",
            );
          }
          const href = String(override.href ?? "").trim();
          if (href !== "" && !isSafeLink(href)) {
            throw new HttpException(
              422,
              "Page links must use a safe HTTP(S), mailto, tel, or internal link.",
            );
          }
        }
      }
      if (payload.home_sections !== undefined) {
        if (!Array.isArray(payload.home_sections)) {
          throw new HttpException(422, "Homepage sections must be a list.");
        }
        const allowed = ["hero", "services", "work", "process", "reviews", "team", "about", "contact"];
        const seen = new Set();
        for (const item of payload.home_sections) {
          if (!item || typeof item !== "object" || !allowed.includes(item.key ?? "") || !Number.isFinite(Number(item.order))) {
            throw new HttpException(422, "Homepage section settings contain an invalid section or order.");
          }
          if (seen.has(item.key)) {
            throw new HttpException(422, "A homepage section can only appear once in the order list.");
          }
          seen.add(item.key);
        }
      }
    }

    if (section === "team") {
      const members = payload.members ?? [];
      if (!Array.isArray(members)) {
        throw new HttpException(422, "Team members must be a list of profile records.");
      }
      const ids = new Set();
      for (const member of members) {
        if (!member || typeof member !== "object" || member.id === undefined || typeof member.id === "object") {
          throw new HttpException(422, "Every team member needs a unique ID.");
        }
        const id = String(member.id);
        if (ids.has(id)) {
          throw new HttpException(422, "Team member IDs must be unique.");
        }
        ids.add(id);
      }

      const oldIds = (this.siteDataGet("team")?.members ?? []).map((r) => String(r?.id ?? ""));
      for (const oldId of oldIds) {
        if (oldId && !ids.has(oldId)) {
          this.sql.exec("DELETE FROM team_profile_access WHERE member_id = ?", oldId);
          this.sql.exec("DELETE FROM team_profile_submissions WHERE member_id = ?", oldId);
        }
      }
    }

    if (section === "portfolio") {
      for (const group of WORK_SECTIONS) {
        const items = payload[group] ?? [];
        if (!Array.isArray(items)) {
          throw new HttpException(422, "Each work category must contain a list of entries.");
        }
        for (const item of items) {
          if (!item || typeof item !== "object" || Array.isArray(item)) {
            throw new HttpException(422, "Work entries must be structured records.");
          }
          for (const key of ["url", "video_url"]) {
            const u = String(item[key] ?? "").trim();
            if (u !== "" && !isHttpUrl(u)) {
              throw new HttpException(422, "Video links must use a public HTTP or HTTPS URL.");
            }
          }
        }
      }
    }

    this.siteDataPut(section, payload);
    return this.jsonResponse({ ok: true, section, saved_at: nowIso() });
  }

  // --- Media Library (ImageUploadController) --------------------------------

  async handleMediaUpload(request, origin, formData, rateLimitMax = 20) {
    if (!this.checkRateLimit(`media-upload:${clientIp(request)}`, rateLimitMax, 60)) {
      throw new HttpException(429, "Too many upload requests. Please wait a minute.");
    }
    if (!formData) {
      throw new HttpException(422, "Choose a valid image or video file to upload.");
    }

    const file = formData.get("media") || formData.get("image") || formData.get("video");
    if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function" || file.size === 0) {
      throw new HttpException(422, "Choose a valid image or video file to upload.");
    }

    let mime = String(file.type || "").trim().toLowerCase();
    if (mime === "application/ogg") mime = "video/ogg";
    const extension = extensionForMime(mime);
    if (!extension) {
      throw new HttpException(422, "This file type is not supported for website media.");
    }

    const kind = mime.startsWith("image/") ? "image" : "video";
    if (kind === "image" && file.size > MAX_IMAGE_BYTES) {
      throw new HttpException(422, "Images must be 8 MB or smaller.");
    }
    if (kind === "video" && file.size > MAX_VIDEO_BYTES) {
      throw new HttpException(422, "Videos must be 200 MB or smaller.");
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const filename = `${crypto.randomUUID()}.${extension}`;
    const assetUrl = makeUrlBuilder(origin)(`/storage/media/${filename}`);
    const rawName = String(file.name || "")
      .split(/[\\/]/)
      .pop()
      .slice(0, 255)
      .replace(/[\x00-\x1F\x7F]/g, "")
      .trim();
    const name = rawName || "Uploaded media";
    const ts = nowSqlTimestamp();

    let assetId;
    this.ctx.storage.transactionSync(() => {
      const inserted = this.sql
        .exec(
          `INSERT INTO media_assets (filename, url, thumbnail_url, provider, name, mime_type, size_bytes, created_at, updated_at)
           VALUES (?, ?, ?, 'local', ?, ?, ?, ?, ?)
           RETURNING id`,
          filename,
          assetUrl,
          kind === "image" ? assetUrl : null,
          name,
          mime,
          bytes.byteLength,
          ts,
          ts,
        )
        .toArray();
      assetId = Number(inserted[0].id);

      let chunkIndex = 0;
      for (let offset = 0; offset < bytes.byteLength; offset += CHUNK_SIZE) {
        const slice = bytes.subarray(offset, Math.min(offset + CHUNK_SIZE, bytes.byteLength));
        this.sql.exec(
          "INSERT INTO media_chunks (asset_id, chunk_index, data) VALUES (?, ?, ?)",
          assetId,
          chunkIndex++,
          slice,
        );
      }
    });

    const asset = {
      id: assetId,
      url: assetUrl,
      thumbnail_url: kind === "image" ? assetUrl : null,
      provider: "local",
      name,
      mime_type: mime,
      size_bytes: bytes.byteLength,
      kind,
      disk: "public",
      path: `media/${filename}`,
    };

    return this.jsonResponse(
      { ok: true, asset, image: kind === "image" ? asset : null },
      201,
    );
  }

  handleServeMedia(request, file) {
    if (!isSafeFilename(file)) {
      throw new HttpException(404, "Not Found.");
    }
    const suffix = `/storage/media/${file}`;
    const asset = this.sql
      .exec(
        "SELECT id, mime_type, size_bytes FROM media_assets WHERE provider = 'local' AND (filename = ? OR url LIKE ?) LIMIT 1",
        file,
        `%${suffix}`,
      )
      .toArray()[0];
    if (!asset) {
      throw new HttpException(404, "Not Found.");
    }

    const totalSize = Number(asset.size_bytes || 0);
    const contentType = asset.mime_type || "application/octet-stream";
    const baseHeaders = {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Accept-Ranges": "bytes",
    };

    if (request.method === "HEAD") {
      return new Response(null, {
        status: 200,
        headers: { ...baseHeaders, "Content-Length": String(totalSize) },
      });
    }

    const rangeHeader = request.headers.get("range");
    let start = 0;
    let end = Math.max(0, totalSize - 1);
    let isPartial = false;

    if (rangeHeader && totalSize > 0) {
      const m = rangeHeader.match(/^bytes=(\d*)-(\d*)$/i);
      if (m) {
        isPartial = true;
        if (m[1] === "" && m[2] !== "") {
          const suffixLen = Number.parseInt(m[2], 10);
          start = Math.max(0, totalSize - suffixLen);
        } else {
          start = Number.parseInt(m[1], 10) || 0;
          if (m[2] !== "") {
            end = Math.min(totalSize - 1, Number.parseInt(m[2], 10));
          }
        }
        if (start >= totalSize || start > end) {
          return new Response(null, {
            status: 416,
            headers: { ...baseHeaders, "Content-Range": `bytes */${totalSize}` },
          });
        }
      }
    }

    const firstChunk = Math.floor(start / CHUNK_SIZE);
    const lastChunk = Math.floor(end / CHUNK_SIZE);
    const sql = this.sql;
    const assetId = asset.id;

    let currentChunk = firstChunk;
    const stream = new ReadableStream({
      pull(controller) {
        if (currentChunk > lastChunk || totalSize === 0) {
          controller.close();
          return;
        }
        const row = sql
          .exec(
            "SELECT data FROM media_chunks WHERE asset_id = ? AND chunk_index = ?",
            assetId,
            currentChunk,
          )
          .toArray()[0];
        if (!row) {
          controller.close();
          return;
        }
        let bytes = row.data instanceof Uint8Array ? row.data : new Uint8Array(row.data);
        const chunkStartOffset = currentChunk * CHUNK_SIZE;
        const sliceStart = currentChunk === firstChunk ? start - chunkStartOffset : 0;
        const sliceEnd =
          currentChunk === lastChunk ? end - chunkStartOffset + 1 : bytes.byteLength;
        if (sliceStart > 0 || sliceEnd < bytes.byteLength) {
          bytes = bytes.subarray(sliceStart, sliceEnd);
        }
        currentChunk++;
        controller.enqueue(bytes);
      },
    });

    const length = totalSize === 0 ? 0 : end - start + 1;
    const headers = { ...baseHeaders, "Content-Length": String(length) };
    if (isPartial) {
      headers["Content-Range"] = `bytes ${start}-${end}/${totalSize}`;
    }

    return new Response(stream, {
      status: isPartial ? 206 : 200,
      headers,
    });
  }

  isMediaUrlReferenced(targetUrl) {
    const inVideos = this.sql
      .exec(
        "SELECT 1 FROM video_library WHERE url = ? OR thumbnail_url = ? LIMIT 1",
        targetUrl,
        targetUrl,
      )
      .toArray();
    if (inVideos.length > 0) return true;

    const containsUrl = (val) => {
      if (Array.isArray(val)) return val.some(containsUrl);
      if (val && typeof val === "object") return Object.values(val).some(containsUrl);
      if (typeof val !== "string") return false;
      return (
        val === targetUrl ||
        val.startsWith(`${targetUrl}?`) ||
        val.startsWith(`${targetUrl}#`)
      );
    };

    for (const row of this.sql.exec("SELECT payload FROM site_data").toArray()) {
      try {
        if (containsUrl(JSON.parse(row.payload))) return true;
      } catch {
        // ignore
      }
    }
    return false;
  }

  handleDeleteMedia(mediaId) {
    const asset = this.sql
      .exec("SELECT * FROM media_assets WHERE id = ? LIMIT 1", mediaId)
      .toArray()[0];
    if (!asset) {
      throw new HttpException(404, "Media file not found.");
    }
    if (this.isMediaUrlReferenced(String(asset.url))) {
      throw new HttpException(
        409,
        "This file is being used on a page or video. Replace it there before removing it.",
      );
    }
    this.ctx.storage.transactionSync(() => {
      this.sql.exec("DELETE FROM media_chunks WHERE asset_id = ?", mediaId);
      this.sql.exec("DELETE FROM media_assets WHERE id = ?", mediaId);
    });
    return this.jsonResponse({ ok: true });
  }

  // --- Video Library Controller ---------------------------------------------

  removeLegacyVideoReferences(videoUrl, placements) {
    const portfolio = this.siteDataGet("portfolio");
    let portfolioChanged = false;
    for (const placement of placements) {
      if (placement.page === "work") {
        const section = String(placement.section);
        const urlKey = section === "videos" ? "video_url" : "url";
        if (!Array.isArray(portfolio?.[section])) continue;
        portfolio[section] = portfolio[section].filter(
          (item) =>
            String(item?.id ?? "") !== String(placement.item_key) &&
            String(item?.[urlKey] ?? item?.url ?? "") !== videoUrl,
        );
        portfolioChanged = true;
      }
    }
    if (portfolioChanged) {
      this.siteDataPut("portfolio", portfolio);
    }

    const services = [...(this.siteDataGet("services") ?? [])];
    let servicesChanged = false;
    for (const placement of placements) {
      if (placement.page !== "service" || !placement.service_id) continue;
      for (const service of services) {
        if (!service || String(service.id ?? "") !== String(placement.service_id)) continue;
        if (placement.section === "service-card" && (service.main_video_url ?? "") === videoUrl) {
          service.main_video_url = "";
          service.video_thumbnail = "";
          if (service.image_url) {
            service.media = {
              ...(service.media ?? {}),
              type: "image",
              imageUrl: service.image_url,
            };
          }
          servicesChanged = true;
        }
        if (placement.section === "service-demo" && Array.isArray(service.demo_videos)) {
          const before = service.demo_videos.length;
          service.demo_videos = service.demo_videos.filter(
            (demo) =>
              String(demo?.id ?? "") !== String(placement.item_key) &&
              String(demo?.video_url ?? "") !== videoUrl,
          );
          if (service.demo_videos.length !== before) servicesChanged = true;
        }
      }
    }
    if (servicesChanged) {
      this.siteDataPut("services", services);
    }

    const settings = this.siteDataGet("settings");
    for (const placement of placements) {
      if (
        placement.page === "service" &&
        placement.section === "overview" &&
        (settings?.content?.overview_video_url ?? "") === videoUrl
      ) {
        settings.content.overview_video_url = "";
        settings.content.overview_video_embed_type = "";
        settings.content.overview_video_embed_url = "";
        this.siteDataPut("settings", settings);
      }
    }
  }

  async handleSaveVideo(id, body) {
    if (id !== null) {
      const exists = this.sql
        .exec("SELECT 1 FROM video_library WHERE id = ? LIMIT 1", id)
        .toArray();
      if (exists.length === 0) throw new HttpException(404, "Video not found.");
    }

    const title = String(body.title ?? "").trim();
    if (!title || title.length > 180) {
      throw new HttpException(422, "Enter a video title (up to 180 characters).");
    }
    const rawUrl = String(body.url ?? "").trim();
    if (!isHttpUrl(rawUrl)) {
      throw new HttpException(422, "Enter a valid HTTP or HTTPS video URL.");
    }
    const rawThumb = String(body.thumbnail_url ?? "").trim();
    if (rawThumb !== "" && !isHttpUrl(rawThumb)) {
      throw new HttpException(422, "Thumbnail URL must be a valid HTTP or HTTPS URL.");
    }
    if (containsInlineMedia(rawUrl) || containsInlineMedia(rawThumb)) {
      throw new HttpException(
        422,
        "Use an uploaded file URL or a public HTTP(S) link; inline file data is not allowed.",
      );
    }

    const placements = body.placements;
    if (!Array.isArray(placements) || placements.length < 1 || placements.length > 30) {
      throw new HttpException(422, "Select at least one placement for this video.");
    }

    const knownServices = new Set(
      (this.siteDataGet("services") ?? []).map((s) => String(s?.id ?? "")),
    );

    for (const p of placements) {
      if (!p || typeof p !== "object") {
        throw new HttpException(422, "Invalid placement entry.");
      }
      const page = String(p.page ?? "");
      const section = String(p.section ?? "");
      const valid =
        (page === "home" && section === "showreel") ||
        (page === "service" && ["overview", "service-card", "service-demo"].includes(section)) ||
        (page === "work" && WORK_SECTIONS.includes(section));
      if (!valid) {
        throw new HttpException(422, "Choose a section that belongs to the selected page.");
      }
      const needsService = page === "service" && ["service-card", "service-demo"].includes(section);
      const serviceId = String(p.service_id ?? "");
      if (needsService && (!serviceId || !knownServices.has(serviceId))) {
        throw new HttpException(422, "Select an existing service for this placement.");
      }
      if (!needsService && serviceId !== "") {
        throw new HttpException(
          422,
          "A service can only be selected for service card or demo placements.",
        );
      }
    }

    const resolved = resolveVideoEmbed(rawUrl);
    if (resolved.type !== "iframe" && resolved.type !== "video") {
      throw new HttpException(
        422,
        "This URL is not a supported video source. Use YouTube, Facebook, Google Drive, Vimeo, Dailymotion, Streamable, MP4, WebM, or HLS.",
      );
    }

    const hash = await sha256Hex(rawUrl);
    const thumbnail = this.validThumbnail(rawThumb) || resolved.thumbnail_url || null;
    const duplicate = this.sql
      .exec("SELECT id FROM video_library WHERE url_hash = ? LIMIT 1", hash)
      .toArray()[0];
    const existingId = id ?? (duplicate ? Number(duplicate.id) : null);

    for (const p of placements) {
      if (!["showreel", "overview", "service-card"].includes(p.section)) continue;
      const itemKey = p.service_id ? String(p.service_id) : "";
      const conflictRows =
        existingId !== null
          ? this.sql
              .exec(
                "SELECT 1 FROM video_placements WHERE page = ? AND section = ? AND item_key = ? AND video_id != ? LIMIT 1",
                p.page,
                p.section,
                itemKey,
                existingId,
              )
              .toArray()
          : this.sql
              .exec(
                "SELECT 1 FROM video_placements WHERE page = ? AND section = ? AND item_key = ? LIMIT 1",
                p.page,
                p.section,
                itemKey,
              )
              .toArray();
      if (conflictRows.length > 0) {
        throw new HttpException(
          422,
          "This page section already has a video. Edit or remove the existing record before assigning another.",
        );
      }
    }

    const desc = String(body.description ?? "").trim().slice(0, 5000) || null;
    const category = String(body.category ?? "").trim().slice(0, 120) || null;
    const isFeatured = body.is_featured ? 1 : 0;
    const isEnabled = body.is_enabled === undefined ? 1 : body.is_enabled ? 1 : 0;
    const displayOrder = Math.min(
      100000,
      Math.max(0, Number.parseInt(String(body.display_order ?? 0), 10) || 0),
    );
    const ts = nowSqlTimestamp();

    let recordId;
    let reused = false;

    this.ctx.storage.transactionSync(() => {
      if (id !== null && duplicate && Number(duplicate.id) !== id) {
        throw new HttpException(
          422,
          "This video URL is already in the library. Edit that record to reuse it.",
        );
      }

      if (id !== null) {
        const old = this.sql
          .exec("SELECT url FROM video_library WHERE id = ?", id)
          .toArray()[0];
        const oldPlacements = this.sql
          .exec("SELECT * FROM video_placements WHERE video_id = ?", id)
          .toArray();
        const requestedSet = new Set(
          placements.map((p) => `${p.page}|${p.section}|${p.item_key ?? ""}`),
        );
        const removed = oldPlacements.filter(
          (op) => !requestedSet.has(`${op.page}|${op.section}|${op.item_key ?? ""}`),
        );
        if (removed.length > 0 && old) {
          this.removeLegacyVideoReferences(String(old.url), removed);
        }
        this.sql.exec(
          `UPDATE video_library
           SET url_hash = ?, title = ?, description = ?, url = ?, provider = ?, embed_type = ?, embed_url = ?,
               thumbnail_url = ?, category = ?, is_featured = ?, is_enabled = ?, display_order = ?, updated_at = ?
           WHERE id = ?`,
          hash,
          title,
          desc,
          rawUrl,
          resolved.provider,
          resolved.type,
          resolved.embed_url || null,
          thumbnail,
          category,
          isFeatured,
          isEnabled,
          displayOrder,
          ts,
          id,
        );
        recordId = id;
        this.sql.exec("DELETE FROM video_placements WHERE video_id = ?", recordId);
      } else if (duplicate) {
        recordId = Number(duplicate.id);
        reused = true;
        this.sql.exec(
          `UPDATE video_library
           SET title = ?, description = ?, url = ?, provider = ?, embed_type = ?, embed_url = ?,
               thumbnail_url = ?, category = ?, is_featured = ?, is_enabled = ?, display_order = ?, updated_at = ?
           WHERE id = ?`,
          title,
          desc,
          rawUrl,
          resolved.provider,
          resolved.type,
          resolved.embed_url || null,
          thumbnail,
          category,
          isFeatured,
          isEnabled,
          displayOrder,
          ts,
          recordId,
        );
      } else {
        const inserted = this.sql
          .exec(
            `INSERT INTO video_library
             (url_hash, title, description, url, provider, embed_type, embed_url, thumbnail_url, category, is_featured, is_enabled, display_order, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             RETURNING id`,
            hash,
            title,
            desc,
            rawUrl,
            resolved.provider,
            resolved.type,
            resolved.embed_url || null,
            thumbnail,
            category,
            isFeatured,
            isEnabled,
            displayOrder,
            ts,
            ts,
          )
          .toArray();
        recordId = Number(inserted[0].id);
      }

      for (const p of placements) {
        this.attachVideoPlacement(
          recordId,
          p.page,
          p.section,
          String(p.item_key ?? ""),
          p.service_id ? String(p.service_id) : null,
        );
      }
    });

    const saved = this.videoRecords(false).find((v) => v.id === recordId) ?? null;
    return this.jsonResponse({ ok: true, reused, video: saved }, id === null && !reused ? 201 : 200);
  }

  handleDeleteVideo(videoId) {
    const record = this.sql
      .exec("SELECT * FROM video_library WHERE id = ? LIMIT 1", videoId)
      .toArray()[0];
    if (!record) throw new HttpException(404, "Video not found.");

    this.ctx.storage.transactionSync(() => {
      const placements = this.sql
        .exec("SELECT * FROM video_placements WHERE video_id = ?", videoId)
        .toArray();
      this.removeLegacyVideoReferences(String(record.url), placements);
      this.sql.exec("DELETE FROM video_library WHERE id = ?", videoId);
    });

    return this.jsonResponse({ ok: true });
  }

  // --- Main Router ----------------------------------------------------------

  async fetch(request) {
    this.ensureSchema();

    const urlObj = new URL(request.url);
    const rawPath = urlObj.pathname;
    const pathname = rawPath.length > 1 ? rawPath.replace(/\/+$/, "") : rawPath;
    const method = request.method.toUpperCase();
    const origin = publicOrigin(request, this.env);
    const session = this.loadSession(request);

    let response;
    try {
      response = await this.route(request, method, pathname, urlObj, origin, session);
    } catch (error) {
      if (error instanceof HttpException) {
        if (expectsJson(request, pathname)) {
          response = this.jsonResponse(
            {
              message: error.message,
              ...(error.errors ? { errors: error.errors } : {}),
            },
            error.status,
          );
        } else if (error.status === 404) {
          response = new Response(renderError404({ origin }), {
            status: 404,
            headers: { "Content-Type": "text/html; charset=UTF-8" },
          });
        } else {
          response = new Response(error.message, {
            status: error.status,
            headers: { "Content-Type": "text/plain; charset=UTF-8" },
          });
        }
      } else {
        console.error("Unhandled request error:", error);
        response = expectsJson(request, pathname)
          ? this.jsonResponse({ message: "Server Error." }, 500)
          : new Response("Server Error.", { status: 500 });
      }
    }

    const setCookie = this.persistSession(request, session);
    if (setCookie) {
      const headers = new Headers(response.headers);
      headers.append("Set-Cookie", setCookie);
      response = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    return response;
  }

  async route(request, method, pathname, urlObj, origin, session) {
    const url = makeUrlBuilder(origin);

    // Healthcheck
    if ((method === "GET" || method === "HEAD") && pathname === "/up") {
      return new Response(method === "HEAD" ? null : "OK", {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=UTF-8" },
      });
    }

    // Uploaded media serving
    const mediaMatch = pathname.match(/^\/storage\/media\/([A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp|gif|mp4|webm|ogg))$/);
    if ((method === "GET" || method === "HEAD") && mediaMatch) {
      return this.handleServeMedia(request, mediaMatch[1]);
    }

    // Legacy admin redirects
    if (
      (method === "GET" || method === "HEAD") &&
      (pathname === "/admin-team" || pathname === "/admin-team.html" || pathname === "/admin.html")
    ) {
      return this.redirectResponse(url("/admin"));
    }

    // Public pages & legacy .html URLs
    if (method === "GET" || method === "HEAD") {
      const decodedPath = decodeURIComponent(pathname);
      if (pathname === "/" || decodedPath === "/mexa motion.html") {
        return this.handlePublicPage("home", request, urlObj, origin, session);
      }
      if (pathname === "/service" || pathname === "/service.html") {
        return this.handlePublicPage("service", request, urlObj, origin, session);
      }
      if (pathname === "/work" || pathname === "/work.html") {
        return this.handlePublicPage("work", request, urlObj, origin, session);
      }
      if (pathname === "/reviews" || pathname === "/review.html") {
        return this.handlePublicPage("reviews", request, urlObj, origin, session);
      }
      if (pathname === "/team" || pathname === "/team.html") {
        return this.handlePublicPage("team", request, urlObj, origin, session);
      }
      if (pathname === "/book" || pathname === "/contact-founder.html") {
        return this.handlePublicPage("booking", request, urlObj, origin, session);
      }

      const teamProfilePage = pathname.match(/^\/team\/profile\/([^/]+)$/);
      if (teamProfilePage) {
        const token = decodeURIComponent(teamProfilePage[1]);
        const member = await this.resolveMemberForToken(token);
        const html = renderTeamProfile({
          origin,
          csrfToken: session.data.csrf_token,
          member,
          token,
        });
        return new Response(method === "HEAD" ? null : html, {
          status: 200,
          headers: { "Content-Type": "text/html; charset=UTF-8", "Cache-Control": "no-store" },
        });
      }

      if (pathname === "/admin/setup") {
        return this.handleSetupForm(origin, session);
      }
      if (pathname === "/admin/login") {
        return this.handleLoginForm(origin, session);
      }
      if (pathname === "/admin") {
        const guard = this.requireAdmin(request, pathname, origin, session);
        if (guard.redirect) return guard.redirect;
        return this.handleDashboard(origin, session, guard.user);
      }
    }

    // Admin setup/login/logout form posts
    if (method === "POST" && pathname === "/admin/setup") {
      const parsed = await this.parseBody(request);
      this.verifyCsrf(request, session, parsed);
      return await this.handleSetupSubmit(request, origin, session, parsed.data);
    }
    if (method === "POST" && pathname === "/admin/login") {
      const parsed = await this.parseBody(request);
      this.verifyCsrf(request, session, parsed);
      return await this.handleLoginSubmit(request, origin, session, parsed.data);
    }
    if (method === "POST" && pathname === "/admin/logout") {
      const guard = this.requireAdmin(request, pathname, origin, session);
      if (guard.redirect) return guard.redirect;
      const parsed = await this.parseBody(request);
      this.verifyCsrf(request, session, parsed);
      return this.handleLogout(origin, session);
    }

    // Public API endpoints
    if (method === "GET" && pathname === "/api/public/content") {
      const data = this.hydrateVideoCatalog(this.siteDataAll());
      const content = {
        ...(data.settings?.content ?? {}),
        purchase: data.settings?.purchase ?? {},
      };
      return this.jsonResponse({ content });
    }
    if (method === "GET" && pathname === "/api/public/services") {
      const data = this.hydrateVideoCatalog(this.siteDataAll());
      const active = sortRecords(
        decorateServices(data.services ?? []).filter((r) => isActiveFlag(r?.active, true)),
        "display_order",
        "sort_order",
      );
      return this.jsonResponse({ services: decorateServices(active) });
    }
    if (method === "GET" && pathname === "/api/public/packages") {
      return this.jsonResponse({ packages: filterPublishedPackages(this.siteDataGet("packages")) });
    }
    if (method === "GET" && pathname === "/api/public/team") {
      const team = { ...(this.siteDataGet("team") ?? {}) };
      team.members = sortRecords(
        (team.members ?? []).filter((r) => isActiveFlag(r?.is_active, true)),
        "sort_order",
      );
      return this.jsonResponse(team);
    }
    if (method === "GET" && pathname === "/api/public/contact") {
      const settings = this.siteDataGet("settings") ?? {};
      return this.jsonResponse({
        ...(settings.contact ?? {}),
        purchase: settings.purchase ?? {},
        social: settings.social ?? {},
      });
    }
    if (method === "GET" && pathname === "/api/public/work") {
      const hydrated = this.hydrateVideoCatalog(this.siteDataAll());
      const work = filterPublishedPortfolio(hydrated.portfolio ?? {});
      for (const key of WORK_SECTIONS) {
        work[key] = (work[key] ?? []).map((item) => decorateVideoItem(item));
      }
      return this.jsonResponse(work);
    }
    if (method === "GET" && pathname === "/api/public/videos") {
      return this.jsonResponse({ videos: this.videoRecords(true) });
    }
    if (method === "GET" && pathname === "/api/public/video-resolve") {
      const target = urlObj.searchParams.get("url") || "";
      if (!isHttpUrl(target)) {
        throw new HttpException(422, "Provide a valid HTTP or HTTPS video URL.");
      }
      const resolved = resolveVideoEmbed(target);
      if (resolved.type !== "iframe" && resolved.type !== "video") {
        throw new HttpException(
          422,
          "This video host does not provide a supported embed. Use a YouTube, Facebook, Google Drive, Vimeo, Dailymotion, Streamable, MP4, WebM, or HLS link.",
        );
      }
      return this.jsonResponse(resolved);
    }
    if (method === "GET" && pathname === "/api/public/reviews") {
      return this.handlePublicReviews(urlObj);
    }
    if (method === "POST" && pathname === "/api/public/reviews") {
      const parsed = await this.parseBody(request);
      this.verifyCsrf(request, session, parsed);
      return this.handleSubmitReview(request, parsed.data);
    }
    if (method === "POST" && pathname === "/api/public/storage") {
      const parsed = await this.parseBody(request);
      this.verifyCsrf(request, session, parsed);
      return this.handleStorePublicData(request, parsed.data);
    }

    const teamSubmitMatch = pathname.match(/^\/api\/public\/team-profile\/([^/]+)$/);
    if (method === "POST" && teamSubmitMatch) {
      const parsed = await this.parseBody(request);
      this.verifyCsrf(request, session, parsed);
      return await this.handleTeamProfileSubmit(
        request,
        decodeURIComponent(teamSubmitMatch[1]),
        parsed.data,
      );
    }

    // Protected Admin API endpoints (/api/admin/*)
    if (pathname.startsWith("/api/admin/")) {
      const guard = this.requireAdmin(request, pathname, origin, session);
      if (guard.redirect) return guard.redirect;
      const adminUser = guard.user;

      if (method === "GET" && pathname === "/api/admin/state") {
        if (adminUser.role === "moderator") {
          return this.jsonResponse({
            sections: { reviews: this.siteDataGet("reviews") },
            images: [],
          });
        }
        const images = this.sql
          .exec(
            "SELECT id, url, thumbnail_url, provider, name, mime_type, size_bytes, created_at, updated_at FROM media_assets ORDER BY id DESC LIMIT 100",
          )
          .toArray();
        return this.jsonResponse({ sections: this.siteDataAll(), images });
      }

      if (method === "GET" && pathname === "/api/admin/approvals") {
        const reviews = (this.siteDataGet("reviews") ?? []).filter(
          (r) => (r?.status ?? "pending") === "pending",
        );
        const submissions = this.sql
          .exec(
            "SELECT * FROM team_profile_submissions WHERE status = 'pending' ORDER BY submitted_at DESC",
          )
          .toArray();
        const membersById = new Map(
          (this.siteDataGet("team")?.members ?? []).map((m) => [String(m?.id ?? ""), m]),
        );
        return this.jsonResponse({
          reviews,
          team_submissions: submissions.map((s) => ({
            id: Number(s.id),
            member_id: s.member_id,
            member_name: membersById.get(String(s.member_id))?.name ?? "Former team member",
            payload: JSON.parse(s.payload || "{}") || {},
            submitted_at: s.submitted_at,
          })),
        });
      }

      const reviewDecisionMatch = pathname.match(/^\/api\/admin\/reviews\/([^/]+)\/(approve|reject|delete)$/);
      if (method === "POST" && reviewDecisionMatch) {
        const parsed = await this.parseBody(request);
        this.verifyCsrf(request, session, parsed);
        const reviewId = decodeURIComponent(reviewDecisionMatch[1]);
        const decision = reviewDecisionMatch[2];

        this.ctx.storage.transactionSync(() => {
          const rows = [...(this.siteDataGet("reviews") ?? [])];
          const idx = rows.findIndex((r) => String(r?.id ?? "") === reviewId);
          if (idx === -1) throw new HttpException(404, "Review not found.");
          if (decision === "delete") {
            rows.splice(idx, 1);
          } else {
            rows[idx] = {
              ...rows[idx],
              status: decision === "approve" ? "approved" : "rejected",
              published_at: decision === "approve" ? nowIso() : null,
            };
          }
          this.siteDataPut("reviews", rows);
        });

        return this.jsonResponse({
          ok: true,
          status: decision === "approve" ? "approved" : "rejected",
        });
      }

      const teamDecisionMatch = pathname.match(/^\/api\/admin\/team-submissions\/(\d+)\/(approve|reject)$/);
      if (method === "POST" && teamDecisionMatch) {
        const parsed = await this.parseBody(request);
        this.verifyCsrf(request, session, parsed);
        const subId = Number.parseInt(teamDecisionMatch[1], 10);
        const decision = teamDecisionMatch[2];

        const proposal = this.sql
          .exec("SELECT * FROM team_profile_submissions WHERE id = ? AND status = 'pending' LIMIT 1", subId)
          .toArray()[0];
        if (!proposal) throw new HttpException(404, "Submission not found.");

        const ts = nowSqlTimestamp();
        this.ctx.storage.transactionSync(() => {
          if (decision === "approve") {
            const team = { ...(this.siteDataGet("team") ?? {}) };
            const patch = JSON.parse(proposal.payload || "{}") || {};
            const members = Array.isArray(team.members) ? [...team.members] : [];
            const idx = members.findIndex(
              (m) => String(m?.id ?? "") === String(proposal.member_id),
            );
            if (idx === -1) throw new HttpException(404, "Team member no longer exists.");
            members[idx] = {
              ...members[idx],
              ...patch,
              profile_updated_at: nowIso(),
            };
            team.members = members;
            this.siteDataPut("team", team);
          }
          this.sql.exec(
            `UPDATE team_profile_submissions
             SET status = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
             WHERE id = ?`,
            decision === "approve" ? "approved" : "rejected",
            adminUser.id,
            ts,
            ts,
            subId,
          );
        });

        return this.jsonResponse({
          ok: true,
          status: decision === "approve" ? "approved" : "rejected",
        });
      }

      const teamDeleteMatch = pathname.match(/^\/api\/admin\/team-submissions\/(\d+)$/);
      if (method === "DELETE" && teamDeleteMatch) {
        this.verifyCsrf(request, session, null);
        const subId = Number.parseInt(teamDeleteMatch[1], 10);
        const existing = this.sql
          .exec("SELECT id FROM team_profile_submissions WHERE id = ? AND status = 'pending'", subId)
          .toArray();
        if (existing.length === 0) throw new HttpException(404, "Submission not found.");
        this.sql.exec("DELETE FROM team_profile_submissions WHERE id = ?", subId);
        return this.jsonResponse({ ok: true, status: "deleted" });
      }

      if (method === "POST" && pathname === "/api/admin/password") {
        if (!this.checkRateLimit(`pwd:${adminUser.id}`, 5, 60)) {
          throw new HttpException(429, "Too many password attempts. Please wait a minute.");
        }
        const parsed = await this.parseBody(request);
        this.verifyCsrf(request, session, parsed);
        const currentPassword = String(parsed.data.current_password ?? "");
        const newPassword = String(parsed.data.password ?? "");
        const confirmation = String(parsed.data.password_confirmation ?? "");

        if (newPassword.length < 12) {
          throw new HttpException(422, "The password must be at least 12 characters.");
        }
        if (new TextEncoder().encode(newPassword).byteLength > 72) {
          throw new HttpException(422, "The password may not exceed 72 bytes.");
        }
        if (newPassword !== confirmation) {
          throw new HttpException(422, "The password confirmation does not match.");
        }
        if (!(await verifyPassword(currentPassword, adminUser.password))) {
          throw new HttpException(422, "The current password is incorrect.");
        }

        const newHash = await hashPassword(newPassword);
        this.sql.exec(
          "UPDATE users SET password = ?, updated_at = ? WHERE id = ?",
          newHash,
          nowSqlTimestamp(),
          adminUser.id,
        );
        this.regenerateSession(session, true);
        return this.jsonResponse({ ok: true });
      }

      // Owner-only endpoints below
      this.requireOwner(adminUser);

      const sectionMatch = pathname.match(/^\/api\/admin\/state\/([a-z_]+)$/);
      if (method === "PUT" && sectionMatch) {
        const parsed = await this.parseBody(request);
        this.verifyCsrf(request, session, parsed);
        return this.handleUpdateSection(sectionMatch[1], parsed.data);
      }

      if (method === "GET" && (pathname === "/api/admin/media" || pathname === "/api/admin/images")) {
        const media = this.sql
          .exec(
            "SELECT id, url, thumbnail_url, provider, name, mime_type, size_bytes, created_at, updated_at FROM media_assets ORDER BY id DESC LIMIT 200",
          )
          .toArray();
        return this.jsonResponse({ media, images: media });
      }

      if (method === "POST" && (pathname === "/api/admin/media" || pathname === "/api/admin/images")) {
        const parsed = await this.parseBody(request);
        this.verifyCsrf(request, session, parsed);
        const maxRate = pathname === "/api/admin/images" ? 15 : 20;
        return await this.handleMediaUpload(request, origin, parsed.formData, maxRate);
      }

      const deleteMediaMatch = pathname.match(/^\/api\/admin\/media\/(\d+)$/);
      if (method === "DELETE" && deleteMediaMatch) {
        this.verifyCsrf(request, session, null);
        return this.handleDeleteMedia(Number.parseInt(deleteMediaMatch[1], 10));
      }

      if (method === "GET" && pathname === "/api/admin/video-preview") {
        const target = urlObj.searchParams.get("url") || "";
        if (!isHttpUrl(target)) {
          throw new HttpException(422, "Provide a valid HTTP or HTTPS video URL.");
        }
        return this.jsonResponse(resolveVideoEmbed(target));
      }

      if (method === "GET" && pathname === "/api/admin/videos") {
        if (this.videoRecords(false).length === 0) {
          await this.importLegacyVideos();
        }
        return this.jsonResponse({ videos: this.videoRecords(false) });
      }

      if (method === "POST" && pathname === "/api/admin/videos") {
        const parsed = await this.parseBody(request);
        this.verifyCsrf(request, session, parsed);
        return await this.handleSaveVideo(null, parsed.data);
      }

      const videoIdMatch = pathname.match(/^\/api\/admin\/videos\/(\d+)$/);
      if (method === "PUT" && videoIdMatch) {
        const parsed = await this.parseBody(request);
        this.verifyCsrf(request, session, parsed);
        return await this.handleSaveVideo(Number.parseInt(videoIdMatch[1], 10), parsed.data);
      }
      if (method === "DELETE" && videoIdMatch) {
        this.verifyCsrf(request, session, null);
        return this.handleDeleteVideo(Number.parseInt(videoIdMatch[1], 10));
      }

      const profileLinkMatch = pathname.match(/^\/api\/admin\/team\/([^/]+)\/profile-link$/);
      if (method === "POST" && profileLinkMatch) {
        const parsed = await this.parseBody(request);
        this.verifyCsrf(request, session, parsed);
        const memberId = decodeURIComponent(profileLinkMatch[1]);
        const found = (this.siteDataGet("team")?.members ?? []).some(
          (m) => String(m?.id ?? "") === memberId,
        );
        if (!found) throw new HttpException(404, "Team member not found.");

        const token = randomToken(48);
        const tokenHash = await sha256Hex(token);
        const ts = nowSqlTimestamp();
        this.sql.exec(
          `INSERT INTO team_profile_access (member_id, token_hash, created_at, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(member_id) DO UPDATE SET
             token_hash = excluded.token_hash,
             updated_at = excluded.updated_at`,
          memberId,
          tokenHash,
          ts,
          ts,
        );
        return this.jsonResponse({ ok: true, url: url(`/team/profile/${token}`) });
      }

      if (method === "GET" && pathname === "/api/admin/moderators") {
        const users = this.sql
          .exec(
            "SELECT id, name, email, role, is_active, created_at FROM users WHERE role = 'moderator' ORDER BY name ASC",
          )
          .toArray()
          .map((u) => ({ ...u, is_active: Boolean(u.is_active) }));
        return this.jsonResponse({ users });
      }

      if (method === "POST" && pathname === "/api/admin/moderators") {
        const parsed = await this.parseBody(request);
        this.verifyCsrf(request, session, parsed);
        const name = String(parsed.data.name ?? "").trim();
        const email = String(parsed.data.email ?? "").trim().toLowerCase();
        const password = String(parsed.data.password ?? "");

        if (!name || name.length > 120) {
          throw new HttpException(422, "Enter a valid name (up to 120 characters).");
        }
        if (!email || email.length > 190 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw new HttpException(422, "Enter a valid email address.");
        }
        if (password.length < 12) {
          throw new HttpException(422, "Password must be at least 12 characters.");
        }
        if (new TextEncoder().encode(password).byteLength > 72) {
          throw new HttpException(422, "The password may not exceed 72 bytes.");
        }
        const dupe = this.sql
          .exec("SELECT 1 FROM users WHERE email = ? LIMIT 1", email)
          .toArray();
        if (dupe.length > 0) {
          throw new HttpException(422, "The email has already been taken.");
        }

        const hashed = await hashPassword(password);
        const ts = nowSqlTimestamp();
        const inserted = this.sql
          .exec(
            `INSERT INTO users (name, email, password, role, is_active, created_at, updated_at)
             VALUES (?, ?, ?, 'moderator', 1, ?, ?)
             RETURNING id, name, email, role, is_active, created_at`,
            name,
            email,
            hashed,
            ts,
            ts,
          )
          .toArray()[0];

        return this.jsonResponse(
          { ok: true, user: { ...inserted, is_active: Boolean(inserted.is_active) } },
          201,
        );
      }

      const modDeleteMatch = pathname.match(/^\/api\/admin\/moderators\/(\d+)$/);
      if (method === "DELETE" && modDeleteMatch) {
        this.verifyCsrf(request, session, null);
        const targetId = Number.parseInt(modDeleteMatch[1], 10);
        if (Number(adminUser.id) === targetId) {
          throw new HttpException(422, "You cannot deactivate your own account.");
        }
        const record = this.sql
          .exec("SELECT id FROM users WHERE id = ? AND role = 'moderator' LIMIT 1", targetId)
          .toArray()[0];
        if (!record) throw new HttpException(404, "Moderator not found.");
        this.sql.exec(
          "UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?",
          nowSqlTimestamp(),
          targetId,
        );
        return this.jsonResponse({ ok: true });
      }
    }

    throw new HttpException(404, "Page not found.");
  }
}
