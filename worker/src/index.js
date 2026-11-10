// MEXA MOTION — Cloudflare Worker + SQLite Durable Object runtime.
//
// Runs 100% natively on Cloudflare Workers (Free and Paid plans) with zero
// Docker/Containers requirement:
//   - Static stylesheets and scripts (`public/css/*`, `public/js/*`) are served
//     directly at the Worker edge.
//   - Dynamic Blade pages (`resources/views/**/*.blade.php`), `/api/*`, `/admin`,
//     media uploads (`/storage/media/*`), reviews, bookings, video library and
//     team profile approvals run inside `MexaContainer` backed by Durable Object
//     SQLite (`ctx.storage.sql`).
//   - Optional: if `ORIGIN_URL` is set (or a Cloudflare Container is attached on
//     Workers Paid), requests are proxied upstream with X-Forwarded-* headers.

import { DurableObject } from "cloudflare:workers";
import { MexaEdgeApp } from "./app.js";
import { tryServePublicAsset } from "./assets.js";

/** Application-level session affinity key. All public traffic shares one instance. */
const APP_INSTANCE_NAME = "mexa-motion-app";

const INSTANCE_TYPES = new Set([
  "lite",
  "basic",
  "standard-1",
  "standard-2",
  "standard-3",
  "standard-4",
]);

const DEFAULT_PORT = 8080;
const DEFAULT_INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_INACTIVITY_TIMEOUT_MS = 6 * 60 * 60 * 1000;

const CONTAINER_SECRET_KEYS = [
  "APP_KEY",
  "APP_URL",
  "DB_HOST",
  "DB_DATABASE",
  "DB_USERNAME",
  "DB_PASSWORD",
  "MYSQL_ATTR_SSL_CA",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_ACCOUNT_ID",
  "R2_BUCKET",
  "IMGBB_API_KEY",
];

const CONTAINER_VAR_KEYS = [
  "APP_NAME",
  "APP_ENV",
  "APP_DEBUG",
  "APP_TIMEZONE",
  "APP_LOCALE",
  "APP_FALLBACK_LOCALE",
  "LOG_CHANNEL",
  "LOG_LEVEL",
  "DB_CONNECTION",
  "DB_PORT",
  "DB_CHARSET",
  "DB_COLLATION",
  "SESSION_DRIVER",
  "SESSION_TABLE",
  "SESSION_LIFETIME",
  "SESSION_ENCRYPT",
  "SESSION_SECURE_COOKIE",
  "SESSION_HTTP_ONLY",
  "SESSION_SAME_SITE",
  "CACHE_STORE",
  "QUEUE_CONNECTION",
  "FILESYSTEM_DISK",
  "TRUSTED_PROXIES",
  "MEXA_CONTAINER_PORT",
];

function containerEnv(env) {
  const vars = {};
  for (const key of [...CONTAINER_VAR_KEYS, ...CONTAINER_SECRET_KEYS]) {
    const value = env[key];
    if (typeof value === "string" && value.length > 0) {
      vars[key] = value;
    }
  }
  return vars;
}

function containerPort(env) {
  const port = Number.parseInt(env.MEXA_CONTAINER_PORT ?? "", 10);
  return Number.isInteger(port) && port > 0 ? port : DEFAULT_PORT;
}

function instanceType(env) {
  const type = env.MEXA_INSTANCE_TYPE ?? "basic";
  return INSTANCE_TYPES.has(type) ? type : "basic";
}

function inactivityTimeout(env) {
  const ms = Number.parseInt(env.MEXA_INACTIVITY_TIMEOUT_MS ?? "", 10);
  if (!Number.isInteger(ms) || ms <= 0) return DEFAULT_INACTIVITY_TIMEOUT_MS;
  return Math.min(ms, MAX_INACTIVITY_TIMEOUT_MS);
}

function buildForwardedHeaders(request, incomingUrl) {
  const clientIp = request.headers.get("cf-connecting-ip");
  const headers = new Headers(request.headers);
  headers.set("x-forwarded-proto", incomingUrl.protocol === "https:" ? "https" : "http");
  headers.set("x-forwarded-host", incomingUrl.host);
  if (clientIp) {
    headers.set("x-forwarded-for", clientIp);
    headers.set("x-real-ip", clientIp);
  }
  return headers;
}

function toContainerRequest(request) {
  const incoming = new URL(request.url);
  const headers = buildForwardedHeaders(request, incoming);
  incoming.protocol = "http:";
  incoming.host = "container";

  const init = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    init.duplex = "half";
  }
  return new Request(incoming.toString(), init);
}

async function proxyToOrigin(request, originUrl) {
  const incoming = new URL(request.url);
  const upstreamBase = new URL(originUrl);
  const target = new URL(incoming.pathname + incoming.search, upstreamBase);
  const headers = buildForwardedHeaders(request, incoming);
  headers.set("host", upstreamBase.host);

  const init = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    init.duplex = "half";
  }
  return await fetch(new Request(target.toString(), init));
}

export class MexaContainer extends DurableObject {
  ready = false;

  constructor(ctx, env) {
    super(ctx, env);
    this.edgeApp = new MexaEdgeApp(ctx, env);
    const container = ctx.container;
    if (container?.running) {
      void ctx.blockConcurrencyWhile(() =>
        this.applyInactivityTimeout(container),
      );
    }
  }

  async applyInactivityTimeout(container) {
    try {
      await container.setInactivityTimeout(inactivityTimeout(this.env));
    } catch (error) {
      console.error("Could not set container inactivity timeout", error);
    }
  }

  async ensureContainerRunning(container) {
    let startedNow = false;
    if (!container.running) {
      if (container.images?.app) {
        container.start({
          image: container.images.app,
          instance: instanceType(this.env),
          enableInternet: true,
          env: containerEnv(this.env),
        });
      } else {
        container.start();
      }
      await this.applyInactivityTimeout(container);
      startedNow = true;
    }
    return startedNow;
  }

  async waitForPort(container, timeoutMs = 120_000) {
    const deadline = Date.now() + timeoutMs;
    let lastError;
    while (Date.now() < deadline) {
      try {
        const response = await container
          .getTcpPort(containerPort(this.env))
          .fetch("http://container/up", {
            method: "GET",
            headers: { "user-agent": "mexa-container-readiness" },
          });
        await response.body?.cancel();
        return;
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    throw new Error(
      `Container did not start listening on port ${containerPort(this.env)}: ${
        lastError?.message ?? "timeout"
      }`,
    );
  }

  async fetch(request) {
    const container = this.ctx.container;
    if (!container) {
      // Default native mode (Workers Free & Paid): serve directly from SQLite Durable Object.
      return await this.edgeApp.fetch(request);
    }

    const startedNow = await this.ensureContainerRunning(container);
    if (startedNow || !this.ready) {
      await this.waitForPort(container);
      this.ready = true;
    }

    const port = container.getTcpPort(containerPort(this.env));
    try {
      return await port.fetch(toContainerRequest(request));
    } catch (error) {
      this.ready = false;
      throw error;
    }
  }
}

export default {
  async fetch(request, env, ctx) {
    try {
      if (typeof env.ORIGIN_URL === "string" && env.ORIGIN_URL.trim().length > 0) {
        return await proxyToOrigin(request, env.ORIGIN_URL.trim());
      }

      const url = new URL(request.url);
      const assetResponse = tryServePublicAsset(request, url.pathname);
      if (assetResponse) {
        return assetResponse;
      }

      if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/up") {
        return new Response(request.method === "HEAD" ? null : "OK", {
          status: 200,
          headers: { "Content-Type": "text/plain; charset=UTF-8" },
        });
      }

      const appNamespace = env.MEXA_APP ?? ctx?.exports?.MexaContainer;
      const stub = appNamespace.getByName(APP_INSTANCE_NAME);
      return await stub.fetch(request);
    } catch (error) {
      console.error("Mexa Worker request failed", error);
      return new Response(
        [
          "MEXA MOTION is starting or temporarily unavailable.",
          "",
          `Reason: ${error?.message ?? "unknown error"}`,
          "Check Workers & Pages -> mexa -> Logs, then retry in a few seconds.",
        ].join("\n"),
        {
          status: 503,
          headers: { "content-type": "text/plain; charset=utf-8" },
        },
      );
    }
  },
};
