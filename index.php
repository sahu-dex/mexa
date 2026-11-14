<?php
declare(strict_types=1);

// Started as `php -S host:port` without naming router.php: the built-in server
// sends every unknown address here, so hand it to the router for clean URLs.
if (PHP_SAPI === 'cli-server' && !defined('MEXA_ROUTER')) {
    require __DIR__ . '/router.php';
}

require __DIR__ . '/pages/index.php';
