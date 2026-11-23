<?php
/**
 * User Management Controller (Admin & Profile)
 */

declare(strict_types=1);

require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../models/EmailOtp.php';
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../middlewares/AuthMiddleware.php';
require_once __DIR__ . '/../config/database.php';

class UserController {

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


    public static function create(): void {
        AuthMiddleware::requireAdmin();

        $input = json_decode(file_get_contents('php://input'), true) ?: [];

        $username = trim($input['username'] ?? '');
        $email = trim($input['email'] ?? '');
        $password = $input['password'] ?? '';
        $role = $input['role'] ?? 'User';
        $verificationToken = trim((string)($input['email_verification_token'] ?? ''));

        if (!preg_match('/^[a-zA-Z0-9_]{3,20}$/', $username)) {
            ApiResponse::error("Username harus berupa 3-20 karakter alfanumerik atau underscore.", 422);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            ApiResponse::error("Format email tidak valid.", 422);
        }

        // Syarat password: minimal 8 karakter, 1 huruf kapital, 1 angka,
        // dan 1 simbol (sama seperti pendaftaran & ganti password).
        if (strlen($password) < 8 || !preg_match('/[A-Z]/', $password) || !preg_match('/[0-9]/', $password) || !preg_match('/[^A-Za-z0-9]/', $password)) {
            ApiResponse::error("Password minimal 8 karakter dan harus mengandung minimal 1 huruf kapital, 1 angka, dan 1 simbol.", 422);
        }

        $db = Database::getConnection();

        // Verifikasi email wajib bila SMTP dikonfigurasi (sama seperti
        // pendaftaran): admin harus membuktikan kepemilikan email calon
        // pengguna dengan kode OTP 5 digit — token sekali pakai itu
        // dihanguskan di sini, jadi satu token hanya bisa dipakai satu kali.
        $config = require __DIR__ . '/../config/config.php';
        $mailConfigured = EmailOtp::isMailConfigured($config);
        if ($mailConfigured && $verificationToken === '') {
            ApiResponse::error('Verifikasi email wajib: minta kode 5 digit ke email calon pengguna, lalu verifikasi dulu sebelum membuat akun.', 422);
        }
        if ($verificationToken !== '' && !EmailOtp::consumeToken($db, $email, $verificationToken)) {
            ApiResponse::error('Kode verifikasi tidak valid, sudah dipakai, atau sudah kedaluwarsa. Minta kode baru.', 422);
        }

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
     *
     * Profil sendiri: username & email masing-masing hanya bisa diganti
     * 1x dalam 7 hari (dicek dari username_changed_at / email_changed_at);
     * admin yang mengubah akun orang lain tidak kena cooldown. Ganti
     * email oleh pemilik akun wajib verifikasi ulang: token sekali pakai
     * (`email_verification_token`) dari kode OTP 5 digit yang dikirim ke
     * email baru, bila SMTP dikonfigurasi (tanpa SMTP, pendaftaran pun
     * tidak bisa jalan lewat frontend, jadi jalur lama tetap dibuka).
     * Ganti password oleh pemilik akun wajib menyertakan password lama
     * (`current_password`). Admin tidak bisa mengubah password pengguna
     * lain — fitur reset password sudah dihapus.
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

        $isSelf = $currentUser['id'] === $id;
        $isAdmin = $currentUser['role'] === 'Administrator';

        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $updateData = [];

        // Cooldown 7 hari untuk ganti username/email oleh pemilik akun sendiri.
        $checkCooldown = static function (?string $changedAt, string $field) use ($isSelf, $isAdmin): void {
            if (!$isSelf || $isAdmin || empty($changedAt)) return;
            $next = strtotime((string)$changedAt) + (7 * 86400);
            if (time() < $next) {
                $date = date('d M Y', $next);
                ApiResponse::error("{$field} baru bisa diganti lagi pada {$date} (1x dalam 7 hari).", 422);
            }
        };

        if (isset($input['username'])) {
            $username = trim($input['username']);
            if (!preg_match('/^[a-zA-Z0-9_]{3,20}$/', $username)) {
                ApiResponse::error("Username harus berupa 3-20 karakter alfanumerik atau underscore.", 422);
            }
            $existing = User::findByUsername($db, $username);
            if ($existing && $existing['id'] !== $id) {
                ApiResponse::error("Username sudah digunakan pengguna lain.", 400);
            }
            if ($username !== $user['username']) {
                $checkCooldown($user['username_changed_at'] ?? null, 'Username');
                $updateData['username'] = $username;
                $updateData['username_changed_at'] = gmdate('Y-m-d H:i:s');
            }
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
            if (strtolower($email) !== strtolower((string)$user['email'])) {
                $checkCooldown($user['email_changed_at'] ?? null, 'Email');
                // Pemilik akun sendiri wajib membuktikan kepemilikan email
                // baru dengan kode OTP 5 digit (tanpa demo) bila SMTP
                // dikonfigurasi — token sekali pakai itu dihanguskan di
                // sini, jadi satu token hanya bisa dipakai satu kali.
                // Admin yang mengubah akun orang lain tidak kena aturan ini.
                if ($isSelf && !$isAdmin) {
                    $config = require __DIR__ . '/../config/config.php';
                    if (EmailOtp::isMailConfigured($config)) {
                        $emailToken = trim((string)($input['email_verification_token'] ?? ''));
                        if ($emailToken === '' || !EmailOtp::consumeToken($db, $email, $emailToken)) {
                            ApiResponse::error('Ganti email wajib verifikasi: minta kode 5 digit ke email baru dan verifikasi dulu sebelum menyimpan.', 422);
                        }
                    }
                }
                $updateData['email'] = $email;
                $updateData['email_changed_at'] = gmdate('Y-m-d H:i:s');
            }
        }

        if (array_key_exists('bio', $input)) {
            $bio = trim((string)$input['bio']);
            // mb_strlen bila tersedia (hitung per karakter), bila tidak
            // pakai strlen (hitung per byte — arahnya lebih ketat).
            $bioLen = function_exists('mb_strlen') ? mb_strlen($bio) : strlen($bio);
            if ($bioLen > 160) {
                ApiResponse::error('Bio maksimal 160 karakter.', 422);
            }
            $updateData['bio'] = $bio === '' ? null : $bio;
        }

        if (array_key_exists('avatar', $input)) {
            $avatar = $input['avatar'];
            if ($avatar !== null && !is_string($avatar)) {
                ApiResponse::error('Avatar tidak valid.', 422);
            }
            $updateData['avatar'] = $avatar;
        }

        if ($currentUser['role'] === 'Administrator' && isset($input['role'])) {
            $updateData['role'] = $input['role'] === 'Administrator' ? 'Administrator' : 'User';
        }

        if (!empty($input['password'])) {
            // Ganti password lewat jalur ini hanya untuk pemilik akun
            // sendiri (wajib password lama). Fitur reset password oleh
            // admin sudah dihapus — admin tidak bisa mengatur password
            // pengguna lain.
            if (!$isSelf) {
                ApiResponse::error('Admin tidak bisa mengubah password pengguna lain. Fitur reset password sudah dihapus.', 403);
            }
            // Syarat password baru sama seperti pendaftaran & ganti password.
            if (strlen($input['password']) < 8 || !preg_match('/[A-Z]/', $input['password']) || !preg_match('/[0-9]/', $input['password']) || !preg_match('/[^A-Za-z0-9]/', $input['password'])) {
                ApiResponse::error("Password minimal 8 karakter dan harus mengandung minimal 1 huruf kapital, 1 angka, dan 1 simbol.", 422);
            }
            $current = (string)($input['current_password'] ?? '');
            if ($current === '' || !password_verify($current, (string)$user['password_hash'])) {
                ApiResponse::error('Password lama salah.', 400);
            }
            $updateData['password'] = $input['password'];
        }

        $updated = User::update($db, $id, $updateData);
        ApiResponse::json($updated, 200);
    }

    /**
     * DELETE /users/{id}
     *
     * Admin boleh menghapus akun pengguna lain. Pemilik akun boleh
     * menghapus akunnya sendiri (dari halaman Profil); sesi milik akun
     * itu ikut terhapus lewat ON DELETE CASCADE di tabel sessions.
     */
    public static function delete(string $id): void {
        $currentUser = AuthMiddleware::authenticate();

        $isSelf = $currentUser['id'] === $id;
        if (!$isSelf && $currentUser['role'] !== 'Administrator') {
            ApiResponse::error("Tidak memiliki akses untuk menghapus pengguna ini.", 403);
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
