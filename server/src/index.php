<?php
/**
 * Forafa-App — Backend API Entry Point (PHP Native + MySQL)
 */

declare(strict_types=1);

error_reporting(E_ALL);
ini_set('display_errors', '0');

require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/routes/Router.php';
require_once __DIR__ . '/middlewares/CorsMiddleware.php';
require_once __DIR__ . '/middlewares/AuthMiddleware.php';
require_once __DIR__ . '/controllers/AuthController.php';
require_once __DIR__ . '/controllers/UserController.php';
require_once __DIR__ . '/controllers/InteractionController.php';
require_once __DIR__ . '/controllers/ResponseController.php';
require_once __DIR__ . '/controllers/PublicController.php';
require_once __DIR__ . '/controllers/AnalyticsController.php';
require_once __DIR__ . '/routes/api.php';

// 1. Handle CORS (including preflight OPTIONS)
CorsMiddleware::handle();

// 2. Initialize Router & Register routes
$router = new Router();
registerApiRoutes($router);

// 3. Dispatch incoming request
$router->dispatch();
