<?php
declare(strict_types=1);

/*
 * Clean-URL front controller for PHP's built-in server.
 *
 *     php -S 0.0.0.0:8000 router.php
 *
 * On Apache the same behaviour comes from .htaccess and this file is never
 * reached. It exists because `php -S` ignores .htaccess entirely:
 *
 *   /service            -> service.php          (no extension in the address bar)
 *   /service.php        -> 301 /service         (old links keep working)
 *   /admin              -> 301 /admin/          -> login page or dashboard
 *   /admin/login        -> admin/login.php
 *   /api/*.php          -> unchanged (form endpoints, POSTed to by the site's JS)
 *
 * It also applies the .htaccess deny rules (.env, config/, includes/, *.sql …),
 * which the built-in server would otherwise hand out as plain files.
 *
 * index.php and admin/index.php include this file too, so the clean URLs still
 * resolve when the server was started without naming the router.
 */

if (defined('MEXA_ROUTER')) {
    return true;
}
define('MEXA_ROUTER', true);

if (PHP_SAPI !== 'cli-server' && !defined('MEXA_ROUTER_FORCE')) {
    http_response_code(403);
    exit('Forbidden');
}

(static function (): void {
    $root = __DIR__;
    $uri = (string) ($_SERVER['REQUEST_URI'] ?? '/');
    $query = (string) (parse_url($uri, PHP_URL_QUERY) ?? '');
    $path = rawurldecode((string) (parse_url($uri, PHP_URL_PATH) ?? '/'));
    $path = '/' . ltrim(preg_replace('#/+#', '/', $path) ?? '/', '/');
    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    $isRead = $method === 'GET' || $method === 'HEAD';
    $qs = $query !== '' ? '?' . $query : '';

    $deny = static function (int $code, string $text): never {
        http_response_code($code);
        header('Content-Type: text/plain; charset=utf-8');
        exit($text);
    };
    $go = static function (string $to) use ($qs): never {
        header('Location: ' . $to . $qs, true, 301);
        exit;
    };
    $run = static function (string $file, string $scriptName): never {
        $_SERVER['SCRIPT_NAME'] = $scriptName;
        $_SERVER['PHP_SELF'] = $scriptName;
        chdir(dirname($file));
        require $file;
        exit;
    };

    // The same things .htaccess refuses to serve.
    if (str_contains($path, '..') || str_contains($path, "\0")
        || preg_match('#^/(config|includes|database|storage|pages|tests)(/|$)#i', $path)
        || preg_match('#(^|/)\.[^/]+#', $path)
        || preg_match('#(^|/)(composer\.(json|lock)|package(-lock)?\.json|README\.md|router\.php|[^/]*\.(sql|log))$#i', $path)
        || preg_match('#^/uploads/.*\.(php\d*|phtml|phar|inc|cgi|sh|html?|svg)$#i', $path)) {
        $deny(403, 'Forbidden');
    }

    $file = $root . $path;

    // Real PHP file requested by name.
    if (str_ends_with(strtolower($path), '.php')) {
        if (!is_file($file)) {
            $deny(404, 'Not Found');
        }
        // Pages move to their clean address; API endpoints keep theirs so that
        // POSTed forms are never redirected.
        if ($isRead && !str_starts_with($path, '/api/')) {
            $clean = substr($path, 0, -4);
            if (basename($clean) === 'index') {
                $clean = substr($clean, 0, -5);
            }
            $go($clean === '' ? '/' : $clean);
        }
        $run($file, $path);
    }

    // Directory: needs its trailing slash so relative links resolve inside it.
    if (is_dir($file)) {
        if (!str_ends_with($path, '/')) {
            $go($path . '/');
        }
        $index = rtrim($file, '/') . '/index.php';
        if (is_file($index)) {
            $run($index, $path . 'index.php');
        }
        $deny(403, 'Forbidden');
    }

    // Any other existing file (CSS, JS, images, fonts): let the server send it.
    if (is_file($file)) {
        return;
    }

    // /service/ -> /service
    if ($path !== '/' && str_ends_with($path, '/')) {
        $trimmed = rtrim($path, '/');
        if (is_file($root . $trimmed . '.php')) {
            $go($trimmed);
        }
        $deny(404, 'Not Found');
    }

    // Clean URL -> the PHP file behind it.
    if (is_file($file . '.php')) {
        $run($file . '.php', $path . '.php');
    }

    $deny(404, 'Not Found');
})();

// Only reached for a static file.
return false;
