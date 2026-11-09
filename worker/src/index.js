// MEXA MOTION — Cloudflare Worker front door for the Laravel container.
//
// Every app request is sent to one Container instance (see wrangler.jsonc
// "containers" + "exports"). The Durable Object class below starts the PHP/
// Apache image on demand, sleeps it after an idle period, and proxies requests
// to it while keeping the Linux/amd64 container compatible with Cloudflare's
// `durable_object` scheduling policy.
//
// Nothing here changes application behaviour: routes, Blade views, /api
// endpoints, admin flows and /storage/media/* are all handled by Laravel.

import { DurableObject } from "cloudflare:workers";

/** Application-level session affinity key. All public traffic shares one instance. */
const APP_INSTANCE_NAME = "mexa-motion-app";

/** Instance sizes supported by Cloudflare Containers. */
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

/** Secrets that must reach the container; everything else is a plain var. */
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

/** Plain vars from wrangler.jsonc that the entrypoint needs. */
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

/**
 * Rebuild the incoming request for the container port:
 * - plain http + a fixed host (the container only listens on its own port),
 * - `redirect: "manual"` so Laravel's 302s reach the browser untouched,
 * - X-Forwarded-* headers so Laravel generates HTTPS URLs for the public host,
 * - the real visitor IP in X-Forwarded-For, keeping per-client throttling sane.
 */
function toContainerRequest(request) {
  const target = new URL(request.url);
  const clientIp = request.headers.get("cf-connecting-ip");

  const headers = new Headers(request.headers);
  headers.set("x-forwarded-proto", target.protocol === "https:" ? "https" : "http");
  headers.set("x-forwarded-host", target.host);
  if (clientIp) {
    // Overwrite instead of appending: a client-supplied X-Forwarded-For must
    // not be able to spoof its address.
    headers.set("x-forwarded-for", clientIp);
    headers.set("x-real-ip", clientIp);
  }

  target.protocol = "http:";
  target.host = "container";

  const init = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    init.duplex = "half";
  }

  return new Request(target.toString(), init);
}

export class MexaContainer extends DurableObject {
  /** True once the container port answered in this Durable Object lifetime. */
  ready = false;

  constructor(ctx, env) {
    super(ctx, env);
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

  async ensureRunning() {
    const container = this.ctx.container;
    if (!container) {
      throw new Error("No container is configured for this Durable Object");
    }

    let startedNow = false;
    if (!container.running) {
      container.start({
        image: container.images.app,
        instance: instanceType(this.env),
        enableInternet: true,
        env: containerEnv(this.env),
      });
      await this.applyInactivityTimeout(container);
      startedNow = true;
    }

    return { container, startedNow };
  }

  /**
   * Wait until Apache answers on the container port. `start()` returns before
   * the process can accept traffic, so the first request after a cold start
   * polls the port instead of failing.
   */
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
    const { container, startedNow } = await this.ensureRunning();

    // Probe the port only after a start (or the first request this Durable
    // Object handles), not on every single request.
    if (startedNow || !this.ready) {
      await this.waitForPort(container);
      this.ready = true;
    }

    const port = container.getTcpPort(containerPort(this.env));
    try {
      return await port.fetch(toContainerRequest(request));
    } catch (error) {
      // The container may have restarted; probe again on the next request.
      this.ready = false;
      throw error;
    }
  }
}

export default {
  async fetch(request, env) {
    const stub = env.MEXA_APP.getByName(APP_INSTANCE_NAME);

    try {
      return await stub.fetch(request);
    } catch (error) {
      console.error("Container request failed", error);
      return new Response(
        [
          "MEXA MOTION is starting or temporarily unavailable.",
          "",
          `Reason: ${error?.message ?? "unknown error"}`,
          "Check Workers & Pages -> mexa-motion -> Logs, then retry in a few seconds.",
        ].join("\n"),
        {
          status: 503,
          headers: { "content-type": "text/plain; charset=utf-8" },
        },
      );
    }
  },
};
