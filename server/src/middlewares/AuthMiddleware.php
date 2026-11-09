<?php
/**
 * Authentication & Authorization Middleware
 * Validates JWT access token and active server-side session.
 */

declare(strict_types=1);

require_once __DIR__ . '/../utils/JWT.php';
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../models/Session.php';
require_once __DIR__ . '/../config/database.php';

class AuthMiddleware {
    /**
     * Get bearer token from request headers
     */
    public static function getBearerToken(): ?string {
        $header = null;

        if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
            $header = $_SERVER['HTTP_AUTHORIZATION'];
        } elseif (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $header = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        } elseif (function_exists('apache_request_headers')) {
            $headers = apache_request_headers();
            $header = $headers['Authorization'] ?? $headers['authorization'] ?? null;
        }

        if (!$header || !preg_match('/Bearer\s(\S+)/i', $header, $matches)) {
            return null;
        }

        return $matches[1];
    }

    /**
     * Require authenticated user and valid session, returns user data array
     */
    public static function authenticate(): array {
        $token = self::getBearerToken();
        if (!$token) {
            ApiResponse::error("Autentikasi diperlukan. Silakan login terlebih dahulu.", 401);
        }

        $config = require __DIR__ . '/../config/config.php';
        $payload = JWT::decode($token, $config['jwt']['secret']);

        if (!$payload || empty($payload['sub'])) {
            ApiResponse::error("Token kedaluwarsa atau tidak valid.", 401);
        }

        $db = Database::getConnection();

        // Validate active session in database (including idle timeout and revocation)
        $idleMinutes = (int)($config['session']['idle_minutes'] ?? 120);
        $session = Session::validate($db, $token, $idleMinutes);

        if (!$session) {
            ApiResponse::error("Session telah kedaluwarsa atau telah keluar. Silakan login kembali.", 401);
        }

        $stmt = $db->prepare("SELECT id, username, email, role, created_at FROM users WHERE id = :id");
        $stmt->execute([':id' => $payload['sub']]);
        $user = $stmt->fetch();

        if (!$user) {
            ApiResponse::error("Pengguna tidak ditemukan.", 404);
        }

        // Attach session metadata
        $user['_session'] = $session;

        return $user;
    }

    /**
     * Require user to have Administrator role
     */
    public static function requireAdmin(?array $user = null): array {
        $currentUser = $user ?? self::authenticate();

        if (($currentUser['role'] ?? '') !== 'Administrator') {
            ApiResponse::error("Akses ditolak. Endpoint ini hanya untuk Administrator.", 403);
        }

        return $currentUser;
    }
}
