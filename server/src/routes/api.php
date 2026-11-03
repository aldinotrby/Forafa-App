<?php
/**
 * Route Definitions for Forafa-App
 */

declare(strict_types=1);

function registerApiRoutes(Router $router): void {
    // Health Check & Root
    $healthCheck = function() {
        ApiResponse::json([
            'status' => 'ok',
            'service' => 'Forafa-App Backend API',
            'technology' => 'PHP Native + MySQL',
            'version' => '1.0.0',
            'timestamp' => gmdate('Y-m-d\TH:i:s\Z'),
        ], 200);
    };

    $router->get('/', $healthCheck);
    $router->get('/health', $healthCheck);
    $router->get('/api/v1', $healthCheck);

    // Register routes for both '/api/v1' prefix and direct path for compatibility
    $prefixes = ['/api/v1', ''];

    foreach ($prefixes as $p) {
        // --------------------------------------------------------------------------
        // Auth Routes
        // --------------------------------------------------------------------------
        $router->post("{$p}/auth/register", [AuthController::class, 'register']);
        $router->post("{$p}/auth/login", [AuthController::class, 'login']);
        $router->post("{$p}/auth/logout", [AuthController::class, 'logout']);
        $router->get("{$p}/auth/me", [AuthController::class, 'me']);

        // --------------------------------------------------------------------------
        // Users Management Routes (Admin & Profile)
        // --------------------------------------------------------------------------
        $router->get("{$p}/users", [UserController::class, 'list']);
        $router->post("{$p}/users", [UserController::class, 'create']);
        $router->get("{$p}/users/{id}", [UserController::class, 'getDetail']);
        $router->patch("{$p}/users/{id}", [UserController::class, 'update']);
        $router->post("{$p}/users/{id}/reset-password", [UserController::class, 'resetPassword']);
        $router->delete("{$p}/users/{id}", [UserController::class, 'delete']);

        // --------------------------------------------------------------------------
        // Interactions Routes (Voting, Feedback, Anon)
        // --------------------------------------------------------------------------
        $router->get("{$p}/interactions", [InteractionController::class, 'list']);
        $router->post("{$p}/interactions", [InteractionController::class, 'create']);
        $router->get("{$p}/interactions/{id}", [InteractionController::class, 'getDetail']);
        $router->patch("{$p}/interactions/{id}", [InteractionController::class, 'update']);
        $router->delete("{$p}/interactions/{id}", [InteractionController::class, 'delete']);
        $router->get("{$p}/interactions/{id}/responses", [InteractionController::class, 'getResponses']);

        // --------------------------------------------------------------------------
        // Responses Management Routes
        // --------------------------------------------------------------------------
        $router->get("{$p}/responses/export/csv", [ResponseController::class, 'exportCsv']);
        $router->get("{$p}/responses", [ResponseController::class, 'list']);
        $router->patch("{$p}/responses/{id}", [ResponseController::class, 'update']);
        $router->delete("{$p}/responses/{id}", [ResponseController::class, 'delete']);

        // --------------------------------------------------------------------------
        // Public Portal Routes (No Auth)
        // --------------------------------------------------------------------------
        $router->get("{$p}/public/{slug}", [PublicController::class, 'getDetail']);
        $router->post("{$p}/public/{slug}/submit", [PublicController::class, 'submit']);

        // --------------------------------------------------------------------------
        // Analytics & Overview Routes
        // --------------------------------------------------------------------------
        $router->get("{$p}/analytics/overview", [AnalyticsController::class, 'overview']);
        $router->get("{$p}/analytics/user-stats", [AnalyticsController::class, 'userStats']);
    }
}
