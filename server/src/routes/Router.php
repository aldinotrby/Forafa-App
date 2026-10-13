<?php
/**
 * Lightweight Route Dispatcher
 */

declare(strict_types=1);

require_once __DIR__ . '/../utils/Response.php';

class Router {
    private array $routes = [];

    public function get(string $path, callable $handler): void {
        $this->addRoute('GET', $path, $handler);
    }

    public function post(string $path, callable $handler): void {
        $this->addRoute('POST', $path, $handler);
    }

    public function patch(string $path, callable $handler): void {
        $this->addRoute('PATCH', $path, $handler);
    }

    public function delete(string $path, callable $handler): void {
        $this->addRoute('DELETE', $path, $handler);
    }

    private function addRoute(string $method, string $path, callable $handler): void {
        $this->routes[] = [
            'method' => strtoupper($method),
            'pattern' => $path,
            'handler' => $handler,
        ];
    }

    public function dispatch(): void {
        $requestMethod = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        $requestUri = $_SERVER['REQUEST_URI'] ?? '/';

        // Strip query string
        $path = parse_url($requestUri, PHP_URL_PATH) ?: '/';

        // Remove script name if running in subdirectory
        $scriptName = dirname($_SERVER['SCRIPT_NAME'] ?? '');
        if ($scriptName !== '/' && $scriptName !== '\\' && str_starts_with($path, $scriptName)) {
            $path = substr($path, strlen($scriptName));
        }

        $path = '/' . trim($path, '/');

        foreach ($this->routes as $route) {
            if ($route['method'] !== $requestMethod) {
                continue;
            }

            // Convert path pattern to regex (e.g. {id} -> (?P<id>[^/]+))
            $patternRegex = preg_replace('/\{([a-zA-Z0-9_]+)\}/', '(?P<$1>[^/]+)', $route['pattern']);
            $patternRegex = '#^' . $patternRegex . '$#';

            if (preg_match($patternRegex, $path, $matches)) {
                $params = [];
                foreach ($matches as $key => $value) {
                    if (is_string($key)) {
                        $params[$key] = urldecode($value);
                    }
                }

                try {
                    call_user_func_array($route['handler'], $params);
                    return;
                } catch (Throwable $e) {
                    ApiResponse::error("Internal Server Error: " . $e->getMessage(), 500);
                }
            }
        }

        // Endpoint not found
        ApiResponse::error("Endpoint '{$path}' tidak ditemukan.", 404);
    }
}
