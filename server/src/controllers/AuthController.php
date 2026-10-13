<?php
/**
 * Authentication Controller
 */

declare(strict_types=1);

require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../utils/JWT.php';
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../middlewares/AuthMiddleware.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/config.php';

class AuthController {
    /**
     * POST /auth/register
     */
    public static function register(): void {
        $input = json_decode(file_get_contents('php://input'), true) ?: [];

        $username = trim($input['username'] ?? '');
        $email = trim($input['email'] ?? '');
        $password = $input['password'] ?? '';
        $role = $input['role'] ?? 'User';

        if (!preg_match('/^[a-zA-Z0-9_]{3,20}$/', $username)) {
            ApiResponse::error("Username harus berupa 3-20 karakter alfanumerik atau underscore.", 422);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            ApiResponse::error("Format email tidak valid.", 422);
        }

        if (strlen($password) < 8) {
            ApiResponse::error("Password minimal 8 karakter.", 422);
        }

        $db = Database::getConnection();

        if (User::findByEmail($db, $email)) {
            ApiResponse::error("Email sudah terdaftar.", 400);
        }

        if (User::findByUsername($db, $username)) {
            ApiResponse::error("Username sudah terdaftar.", 400);
        }

        $user = User::create($db, [
            'username' => $username,
            'email' => $email,
            'password' => $password,
            'role' => $role === 'Administrator' ? 'Administrator' : 'User',
        ]);

        $config = require __DIR__ . '/../config/config.php';
        $expireMinutes = $config['jwt']['expire_minutes'] ?? 1440;
        $payload = [
            'sub' => $user['id'],
            'role' => $user['role'],
            'exp' => time() + ($expireMinutes * 60),
        ];

        $token = JWT::encode($payload, $config['jwt']['secret']);

        ApiResponse::json([
            'access_token' => $token,
            'token_type' => 'bearer',
            'user' => $user,
        ], 201);
    }

    /**
     * POST /auth/login
     */
    public static function login(): void {
        $input = json_decode(file_get_contents('php://input'), true) ?: [];

        $identifier = trim($input['id'] ?? '');
        $password = $input['password'] ?? '';

        if (empty($identifier) || empty($password)) {
            ApiResponse::error("Email/username dan password wajib diisi.", 422);
        }

        $db = Database::getConnection();
        $userRow = User::findByUsernameOrEmail($db, $identifier);

        if (!$userRow || !password_verify($password, $userRow['password_hash'])) {
            ApiResponse::error("Email/username atau password salah.", 400);
        }

        $user = User::format($userRow);

        $config = require __DIR__ . '/../config/config.php';
        $expireMinutes = $config['jwt']['expire_minutes'] ?? 1440;
        $payload = [
            'sub' => $user['id'],
            'role' => $user['role'],
            'exp' => time() + ($expireMinutes * 60),
        ];

        $token = JWT::encode($payload, $config['jwt']['secret']);

        ApiResponse::json([
            'access_token' => $token,
            'token_type' => 'bearer',
            'user' => $user,
        ], 200);
    }

    /**
     * POST /auth/logout
     */
    public static function logout(): void {
        // Stateless JWT logout - frontend invalidates client-side stored token
        ApiResponse::json([
            'message' => 'Berhasil keluar sistem (Logout).'
        ], 200);
    }

    /**
     * GET /auth/me
     */
    public static function me(): void {
        $currentUser = AuthMiddleware::authenticate();
        ApiResponse::json(User::format($currentUser), 200);
    }
}
