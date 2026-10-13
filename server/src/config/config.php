<?php
/**
 * Configuration Loader for Forafa-App
 * Loads settings from .env file or default fallbacks.
 */

declare(strict_types=1);

// Helper to load .env file into environment variables
function loadEnv(string $path): void {
    if (!file_exists($path)) {
        return;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }

        if (str_contains($line, '=')) {
            [$key, $value] = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);

            // Strip enclosing quotes if present
            if ((str_starts_with($value, '"') && str_ends_with($value, '"')) ||
                (str_starts_with($value, "'") && str_ends_with($value, "'"))) {
                $value = substr($value, 1, -1);
            }

            if (!array_key_exists($key, $_SERVER) && !array_key_exists($key, $_ENV)) {
                putenv("{$key}={$value}");
                $_ENV[$key] = $value;
                $_SERVER[$key] = $value;
            }
        }
    }
}

// Automatically load .env from server root or fallback to .env.example
loadEnv(__DIR__ . '/../../.env');
loadEnv(__DIR__ . '/../../.env.example');

// Helper to get environment variable with fallback
function env(string $key, mixed $default = null): mixed {
    $val = $_ENV[$key] ?? $_SERVER[$key] ?? getenv($key);
    if ($val === false || $val === null || $val === '') {
        return $default;
    }
    return match (strtolower((string)$val)) {
        'true', '(true)' => true,
        'false', '(false)' => false,
        'null', '(null)' => null,
        default => $val,
    };
}

return [
    'app' => [
        'name' => env('APP_NAME', 'Forafa-App Backend API'),
        'env' => env('APP_ENV', 'development'),
        'api_prefix' => env('API_PREFIX', '/api/v1'),
    ],
    'db' => [
        'host' => env('DB_HOST', '127.0.0.1'),
        'port' => (int)env('DB_PORT', 3306),
        'database' => env('DB_DATABASE', 'forafa_db'),
        'username' => env('DB_USERNAME', 'root'),
        'password' => env('DB_PASSWORD', ''),
        'charset' => 'utf8mb4',
    ],
    'jwt' => [
        'secret' => env('JWT_SECRET', 'forafa_secret_key_native_php_2026_change_in_production'),
        'expire_minutes' => (int)env('JWT_EXPIRE_MINUTES', 1440),
    ],
    'cors' => [
        'origins' => array_filter(array_map('trim', explode(',', env('CORS_ALLOWED_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000')))),
    ],
];
