<?php
/**
 * Router script for PHP Built-in Web Server
 * Usage: php -S localhost:8000 router.php
 */

declare(strict_types=1);

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Serve existing static files directly
if ($uri !== '/' && file_exists(__DIR__ . $uri) && !is_dir(__DIR__ . $uri)) {
    return false;
}

// Route setup.php if accessed directly
if ($uri === '/setup.php') {
    require __DIR__ . '/setup.php';
    exit;
}

// Route all other requests through index.php
require __DIR__ . '/index.php';
