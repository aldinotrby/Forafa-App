<?php
/**
 * Authentication & Session Controller
 */

declare(strict_types=1);

require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../models/Session.php';
require_once __DIR__ . '/../models/GoogleAuth.php';
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
        $expireMinutes = (int)($config['session']['lifetime_minutes'] ?? $config['jwt']['expire_minutes'] ?? 1440);
        $sessionId = 'sess_' . bin2hex(random_bytes(16));

        $payload = [
            'sub' => $user['id'],
            'sid' => $sessionId,
            'role' => $user['role'],
            'exp' => time() + ($expireMinutes * 60),
        ];

        $token = JWT::encode($payload, $config['jwt']['secret']);

        // Create persistent session
        $session = Session::create($db, $user['id'], $token, $expireMinutes, ['role' => $user['role']], $sessionId);

        // Native PHP session initialization
        if (session_status() === PHP_SESSION_NONE) {
            @session_start();
        }
        @session_regenerate_id(true);
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['session_id'] = $sessionId;

        ApiResponse::json([
            'access_token' => $token,
            'token_type' => 'bearer',
            'user' => $user,
            'session' => [
                'id' => $session['id'],
                'expires_at' => $session['expires_at'],
                'expires_in_seconds' => $expireMinutes * 60,
                'idle_timeout_seconds' => ((int)($config['session']['idle_minutes'] ?? 120)) * 60,
            ],
        ], 201);
    }

    /**
     * POST /auth/login
     * Implements credential verification, session creation, and session regeneration
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
        $expireMinutes = (int)($config['session']['lifetime_minutes'] ?? $config['jwt']['expire_minutes'] ?? 1440);
        $idleMinutes = (int)($config['session']['idle_minutes'] ?? 120);

        // 1. Session Regeneration (Anti-Fixation)
        // If client already had a previous token/session, revoke it first
        $oldToken = AuthMiddleware::getBearerToken();

        // 2. Generate new unique session ID and JWT access token
        $newSessionId = 'sess_' . bin2hex(random_bytes(16));
        $payload = [
            'sub' => $user['id'],
            'sid' => $newSessionId,
            'role' => $user['role'],
            'exp' => time() + ($expireMinutes * 60),
        ];

        $token = JWT::encode($payload, $config['jwt']['secret']);

        // 3. Register fresh session in database
        $session = Session::regenerate(
            $db,
            $user['id'],
            $oldToken,
            $token,
            $expireMinutes,
            ['role' => $user['role']]
        );

        // 4. Regenerate PHP native session ID
        if (session_status() === PHP_SESSION_NONE) {
            @session_start();
        }
        @session_regenerate_id(true);
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['session_id'] = $session['id'];

        ApiResponse::json([
            'access_token' => $token,
            'token_type' => 'bearer',
            'user' => $user,
            'session' => [
                'id' => $session['id'],
                'expires_at' => $session['expires_at'],
                'expires_in_seconds' => $expireMinutes * 60,
                'idle_timeout_seconds' => $idleMinutes * 60,
            ],
        ], 200);
    }

    /**
     * POST /auth/google
     * Integrasi Google OAuth: Autentikasi dan pendaftaran akun menggunakan Google ID Token.
     */
    public static function googleLogin(): void {
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $idToken = trim((string)($input['id_token'] ?? $input['credential'] ?? $input['token'] ?? ''));

        if (empty($idToken)) {
            ApiResponse::error("Google ID Token ('id_token' atau 'credential') wajib diisi.", 422);
        }

        $googlePayload = GoogleAuth::verifyIdToken($idToken);
        if (!$googlePayload) {
            ApiResponse::error("Token Google OAuth tidak valid atau telah kedaluwarsa.", 401);
        }

        $db = Database::getConnection();
        $email = $googlePayload['email'];
        $userRow = User::findByEmail($db, $email);

        if (!$userRow) {
            // Pendaftaran akun baru otomatis dari Google
            $baseUsername = preg_replace('/[^a-zA-Z0-9_]/', '', explode('@', $email)[0]);
            if (strlen($baseUsername) < 3) {
                $baseUsername = 'user_' . substr(bin2hex(random_bytes(3)), 0, 5);
            }
            $username = $baseUsername;
            $counter = 1;
            while (User::findByUsername($db, $username)) {
                $username = substr($baseUsername, 0, 15) . '_' . $counter++;
            }

            $user = User::create($db, [
                'username' => $username,
                'email' => $email,
                'password' => bin2hex(random_bytes(16)),
                'role' => 'User',
            ]);
        } else {
            $user = User::format($userRow);
        }

        $config = require __DIR__ . '/../config/config.php';
        $expireMinutes = (int)($config['session']['lifetime_minutes'] ?? $config['jwt']['expire_minutes'] ?? 1440);
        $idleMinutes = (int)($config['session']['idle_minutes'] ?? 120);

        // 1. Session Regeneration (Anti-Fixation)
        $oldToken = AuthMiddleware::getBearerToken();
        $newSessionId = 'sess_' . bin2hex(random_bytes(16));
        $payload = [
            'sub' => $user['id'],
            'sid' => $newSessionId,
            'role' => $user['role'],
            'exp' => time() + ($expireMinutes * 60),
            'auth_provider' => 'google',
        ];

        $token = JWT::encode($payload, $config['jwt']['secret']);

        // 2. Register fresh session in database
        $session = Session::regenerate(
            $db,
            $user['id'],
            $oldToken,
            $token,
            $expireMinutes,
            ['role' => $user['role'], 'auth_provider' => 'google']
        );

        // 3. Regenerate PHP native session ID
        if (session_status() === PHP_SESSION_NONE) {
            @session_start();
        }
        @session_regenerate_id(true);
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['session_id'] = $session['id'];

        ApiResponse::json([
            'access_token' => $token,
            'token_type' => 'bearer',
            'user' => $user,
            'session' => [
                'id' => $session['id'],
                'expires_at' => $session['expires_at'],
                'expires_in_seconds' => $expireMinutes * 60,
                'idle_timeout_seconds' => $idleMinutes * 60,
            ],
            'google' => [
                'google_id' => $googlePayload['google_id'],
                'email' => $googlePayload['email'],
                'name' => $googlePayload['name'],
            ],
        ], 200);
    }

    /**
     * POST /auth/logout
     * Revokes active session in database and destroys native PHP session
     */
    public static function logout(): void {
        $token = AuthMiddleware::getBearerToken();
        $db = Database::getConnection();

        if ($token) {
            Session::revoke($db, $token);
        }

        // Destroy PHP native session if active
        if (session_status() === PHP_SESSION_NONE) {
            @session_start();
        }
        $_SESSION = [];
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(
                session_name(),
                '',
                time() - 42000,
                $params["path"],
                $params["domain"],
                $params["secure"],
                $params["httponly"]
            );
        }
        @session_destroy();

        $config = require __DIR__ . '/../config/config.php';
        $cookieName = $config['session']['cookie_name'] ?? 'forafa_session';
        setcookie($cookieName, '', time() - 3600, '/');

        ApiResponse::json([
            'message' => 'Berhasil keluar sistem (Logout). Session telah dihapus dan dinonaktifkan.'
        ], 200);
    }

    /**
     * GET /auth/session & GET /auth/validate-session
     * Validates active session when user reopens tab or returns to application
     */
    public static function validateSession(): void {
        $currentUser = AuthMiddleware::authenticate();

        $sessionInfo = $currentUser['_session'] ?? [];

        ApiResponse::json([
            'valid' => true,
            'message' => 'Session aktif dan valid.',
            'user' => User::format($currentUser),
            'session' => [
                'id' => $sessionInfo['id'] ?? null,
                'expires_at' => $sessionInfo['expires_at'] ?? null,
                'last_activity_at' => $sessionInfo['last_activity_at'] ?? null,
                'remaining_seconds' => $sessionInfo['remaining_seconds'] ?? null,
            ],
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
