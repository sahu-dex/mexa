// Run a Laravel artisan command inside PHP-WASM.
// Usage: node run-artisan.cjs <command> [jsonArgs]
//   e.g. node run-artisan.cjs migrate '{"--force":true,"--no-ansi":true}'

const path = require('path');
const { PHP } = require('@php-wasm/universal');
const { loadNodeRuntime, useHostFilesystem } = require('@php-wasm/node');

const REPO = path.resolve(__dirname, '..', '..');
const command = process.argv[2] || 'list';
const argsJson = process.argv[3] || '[]';

(async () => {
  const php = new PHP(await loadNodeRuntime('8.4', { emscriptenOptions: { processId: 1 } }));
  useHostFilesystem(php);
  const out = await php.run({
    code: `<?php
putenv('APP_RUNNING_IN_CONSOLE=true');
$_ENV['APP_RUNNING_IN_CONSOLE'] = 'true';
$_SERVER['argv'] = ['artisan', ${JSON.stringify(command)}];
require ${JSON.stringify(REPO + '/vendor/autoload.php')};
$app = require ${JSON.stringify(REPO + '/bootstrap/app.php')};
$kernel = $app->make(Illuminate\\Contracts\\Console\\Kernel::class);
$kernel->bootstrap();
$args = json_decode('${argsJson.replace(/'/g, "\\'")}', true) ?: [];
$status = $kernel->call(${JSON.stringify(command)}, $args);
echo $kernel->output();
exit($status >= 200 ? 1 : 0);
`,
  });
  process.stdout.write(out.text || '');
  if (out.errors) process.stderr.write('STDERR: ' + out.errors + '\n');
  if (out.exitCode !== 0) {
    console.log('exit code:', out.exitCode);
    process.exit(1);
  }
  process.exit(0);
})().catch(e => { console.error('FAILED:', e.message || e); process.exit(1); });
