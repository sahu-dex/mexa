<?php

declare(strict_types=1);

/*
 * Router for PHP's built-in server and the PHP-WASM preview server.
 * Production should serve public/index.php directly with Apache/nginx.
 * The project root is derived from this file, never hardcoded.
 */

$root = dirname(__DIR__);
$public = $root.'/public';
$publicReal = realpath($public) ?: $public;
$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$path = rawurldecode($uri);
$basename = basename($path);

$dotfileAllowed = str_starts_with($path, '/.well-known/');
$safeStatic = $path !== '/'
    && $path !== '/index.php'
    && !str_contains($path, '..')
    && !str_contains($path, "\0")
    && ($basename === '' || !str_starts_with($basename, '.') || $dotfileAllowed);

if ($safeStatic) {
    $file = realpath($public.$path);

    if ($file !== false
        && str_starts_with($file, rtrim($publicReal, DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR)
        && is_file($file)) {
        return false;
    }
}

$_ENV['APP_BASE_PATH'] = $root;
$_SERVER['APP_BASE_PATH'] = $root;
$_SERVER['SCRIPT_NAME'] = '/index.php';
$_SERVER['SCRIPT_FILENAME'] = $public.'/index.php';
$_SERVER['DOCUMENT_ROOT'] = $public;
$_SERVER['DOCUMENT_URI'] = '/index.php';

chdir($root);
require $public.'/index.php';
