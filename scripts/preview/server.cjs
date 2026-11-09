// MEXA MOTION sandbox preview — bridges HTTP requests into Laravel running on PHP-WASM.
//
// Usage: node server.cjs   (PORT env var optional, default 8000)
// See README.md in this folder for the full bootstrap flow and known limitations.

const http = require('http');
const path = require('path');
const { PHP, PHPRequestHandler } = require('@php-wasm/universal');
const { loadNodeRuntime, useHostFilesystem } = require('@php-wasm/node');

const PORT = parseInt(process.env.PORT || '8000', 10);
const REPO = path.resolve(__dirname, '..', '..');
const DOCROOT = path.join(REPO, 'public');

(async () => {
  // PHP 8.4 — laravel/framework v12.70's config references the Pdo\Mysql class
  // (PHP 8.4+), which fatals on 8.2/8.3 whenever pdo_mysql is loaded.
  const php = new PHP(await loadNodeRuntime('8.4', {
    emscriptenOptions: { processId: 1 },
  }));
  useHostFilesystem(php);

  const { setPhpIniEntries } = require('@php-wasm/universal');
  await setPhpIniEntries(php, {
    memory_limit: '512M',
    upload_max_filesize: '200M',
    post_max_size: '220M',
    max_execution_time: '300',
    'opcache.enable': '1',
  });

  const handler = new PHPRequestHandler({
    php,
    documentRoot: DOCROOT,
    absoluteUrl: 'http://127.0.0.1:' + PORT,
    // The handler's built-in cookie jar would swallow each client's Cookie
    // header and merge every visitor into one shared session — disable it so
    // each browser's cookies pass through to PHP untouched.
    cookieStore: false,
    // Laravel front controller: anything that is not a real static file
    // goes through public/index.php while keeping the original REQUEST_URI.
    getFileNotFoundAction: () => ({ type: 'internal-redirect', uri: '/index.php' }),
  });

  const server = http.createServer(async (req, res) => {
    const started = Date.now();
    try {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = Buffer.concat(chunks);

      const headers = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (k === 'connection' || k === 'content-length') continue;
        headers[k] = Array.isArray(v) ? v.join(', ') : v;
      }

      const response = await handler.request({
        method: req.method === 'HEAD' ? 'HEAD' : (req.method || 'GET'),
        url: req.url || '/',
        headers,
        body: body.length ? body : undefined,
      });

      const outHeaders = {};
      for (const [k, vs] of Object.entries(response.headers || {})) {
        if (k.toLowerCase() === 'content-encoding' && vs.some((v) => /br|gzip/i.test(v))) {
          // The wasm SAPI may emit encodings the proxy/client never asked for — drop them.
          continue;
        }
        outHeaders[k] = vs.length === 1 ? vs[0] : vs;
      }
      res.writeHead(response.httpStatusCode || 200, outHeaders);
      res.end(Buffer.from(response.bytes || []));
      console.log(`${req.method} ${req.url} -> ${response.httpStatusCode} (${Date.now() - started}ms)`);
    } catch (e) {
      console.error(`ERROR ${req.method} ${req.url}:`, e && e.message);
      try {
        res.writeHead(502, { 'content-type': 'text/plain' });
        res.end('Preview server error: ' + (e && e.message));
      } catch (_) { /* headers already sent */ }
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`MEXA MOTION preview listening on 0.0.0.0:${PORT} (PHP 8.4 WASM, Laravel 12)`);
  });

  const shutdown = () => {
    console.log('shutting down');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
})().catch(e => {
  console.error('FATAL startup error:', e);
  process.exit(1);
});
