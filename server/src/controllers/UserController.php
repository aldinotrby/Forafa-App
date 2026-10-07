<?php
/**
 * User Management Controller (Admin & Profile)
 */

declare(strict_types=1);

require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../middlewares/AuthMiddleware.php';
require_once __DIR__ . '/../config/database.php';

class UserController {
    /**
     * GET /users
     */
    public static function list(): void {
        AuthMiddleware::requireAdmin();

        $skip = max(0, (int)($_GET['skip'] ?? 0));
        $limit = max(1, min(500, (int)($_GET['limit'] ?? 100)));
        $search = !empty($_GET['search']) ? trim($_GET['search']) : (!empty($_GET['q']) ? trim($_GET['q']) : null);
        $role = !empty($_GET['role']) ? trim($_GET['role']) : null;

        $db = Database::getConnection();

        if ($search !== null || $role !== null) {
            $sql = "SELECT * FROM users WHERE 1=1";
            $params = [];
            if ($search !== null) {
                $sql .= " AND (LOWER(username) LIKE :search OR LOWER(email) LIKE :search)";
                $params[':search'] = '%' . strtolower($search) . '%';
            }
            if ($role !== null) {
                $sql .= " AND role = :role";
                $params[':role'] = $role;
            }
            $sql .= " ORDER BY created_at ASC LIMIT :limit OFFSET :skip";
            $stmt = $db->prepare($sql);
            foreach ($params as $k => $v) {
                $stmt->bindValue($k, $v);
            }
            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
            $stmt->bindValue(':skip', $skip, PDO::PARAM_INT);
            $stmt->execute();
            $users = array_map([User::class, 'format'], $stmt->fetchAll());
        } else {
            $users = User::getAll($db, $skip, $limit);
        }

        ApiResponse::json($users, 200);
    }

    /**
     * POST /users
     */
    public static function create(): void {
        AuthMiddleware::requireAdmin();

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

        ApiResponse::json($user, 201);
    }

    /**
     * GET /users/{id}
     */
    public static function getDetail(string $id): void {
        $currentUser = AuthMiddleware::authenticate();

        if ($currentUser['role'] !== 'Administrator' && $currentUser['id'] !== $id) {
            ApiResponse::error("Tidak memiliki akses ke data pengguna ini.", 403);
        }

        $db = Database::getConnection();
        $user = User::findById($db, $id);

        if (!$user) {
            ApiResponse::error("Pengguna tidak ditemukan.", 404);
        }

        ApiResponse::json(User::format($user), 200);
    }

    /**
     * PATCH /users/{id}
     */
    public static function update(string $id): void {
        $currentUser = AuthMiddleware::authenticate();

        if ($currentUser['role'] !== 'Administrator' && $currentUser['id'] !== $id) {
            ApiResponse::error("Tidak memiliki akses untuk mengubah data pengguna ini.", 403);
        }

        $db = Database::getConnection();
        $user = User::findById($db, $id);

        if (!$user) {
            ApiResponse::error("Pengguna tidak ditemukan.", 404);
        }

        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $updateData = [];

        if (isset($input['username'])) {
            $username = trim($input['username']);
            if (!preg_match('/^[a-zA-Z0-9_]{3,20}$/', $username)) {
                ApiResponse::error("Username harus berupa 3-20 karakter alfanumerik atau underscore.", 422);
            }
            $existing = User::findByUsername($db, $username);
            if ($existing && $existing['id'] !== $id) {
                ApiResponse::error("Username sudah digunakan pengguna lain.", 400);
            }
            $updateData['username'] = $username;
        }

        if (isset($input['email'])) {
            $email = trim($input['email']);
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                ApiResponse::error("Format email tidak valid.", 422);
            }
            $existing = User::findByEmail($db, $email);
            if ($existing && $existing['id'] !== $id) {
                ApiResponse::error("Email sudah digunakan pengguna lain.", 400);
            }
            $updateData['email'] = $email;
        }

        if ($currentUser['role'] === 'Administrator' && isset($input['role'])) {
            $updateData['role'] = $input['role'] === 'Administrator' ? 'Administrator' : 'User';
        }

        if (!empty($input['password'])) {
            if (strlen($input['password']) < 8) {
                ApiResponse::error("Password minimal 8 karakter.", 422);
            }
            $updateData['password'] = $input['password'];
        }

        $updated = User::update($db, $id, $updateData);
        ApiResponse::json($updated, 200);
    }

    /**
     * POST /users/{id}/reset-password (Admin Only)
     */
    public static function resetPassword(string $id): void {
        AuthMiddleware::requireAdmin();

        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $newPassword = $input['new_password'] ?? '';

        if (strlen($newPassword) < 8) {
            ApiResponse::error("Password baru minimal 8 karakter.", 422);
        }

        $db = Database::getConnection();
        $user = User::findById($db, $id);

        if (!$user) {
            ApiResponse::error("Pengguna tidak ditemukan.", 404);
        }

        User::update($db, $id, ['password' => $newPassword]);

        ApiResponse::json([
            'message' => "Password pengguna '{$user['username']}' berhasil direset.",
        ], 200);
    }

    /**
     * DELETE /users/{id} (Admin Only)
     */
    public static function delete(string $id): void {
        $currentUser = AuthMiddleware::requireAdmin();

        if ($currentUser['id'] === $id) {
            ApiResponse::error("Tidak dapat menghapus akun Anda sendiri.", 400);
        }

        $db = Database::getConnection();
        $user = User::findById($db, $id);

        if (!$user) {
            ApiResponse::error("Pengguna tidak ditemukan.", 404);
        }

        User::delete($db, $id);

        ApiResponse::noContent();
    }
}
