<?php
/**
 * Email OTP Model — verifikasi pendaftaran akun lewat email.
 *
 * Alur:
 * 1. `createAndSend($db, $email)` — buat kode 5 digit, simpan hash-nya
 *    (kode aslinya TIDAK PERNAH disimpan), lalu kirim lewat SMTP Gmail
 *    dari forafagroup@gmail.com. Kode berlaku 10 menit, kirim ulang
 *    paling cepat 60 detik setelah kirim sebelumnya.
 * 2. `verify($db, $email, $code)` — cocokkan kode (maks. 3x salah).
 *    Bila benar, terbitkan `verification_token` sekali pakai (berlaku
 *    15 menit) untuk menyelesaikan pendaftaran di POST /auth/register.
 * 3. `consumeToken($db, $email, $token)` — validasi + hanguskan token
 *    saat akun dibuat, supaya satu token tidak bisa dipakai dua kali.
 *
 * TIDAK ADA kode demo: bila SMTP belum dikonfigurasi atau pengiriman
 * gagal, `createAndSend` melempar RuntimeException dan kode yang
 * tersimpan langsung dihanguskan — tidak ada kode yang ditampilkan
 * ke layar atau dikembalikan ke frontend.
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../utils/Mailer.php';

class EmailOtp
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_VERIFIED = 'verified';
    public const STATUS_CONSUMED = 'consumed';
    public const STATUS_EXPIRED = 'expired';
    public const STATUS_BLOCKED = 'blocked';

    public static function ensureTablesExist(PDO $db): void
    {
        $driver = $db->getAttribute(PDO::ATTR_DRIVER_NAME);

        if ($driver === 'sqlite') {
            $db->exec("CREATE TABLE IF NOT EXISTS email_otps (
                id VARCHAR(50) PRIMARY KEY,
                email VARCHAR(255) NOT NULL,
                otp_hash VARCHAR(64) NOT NULL,
                verification_token VARCHAR(64) NULL,
                token_expires_at DATETIME NULL,
                attempts INTEGER NOT NULL DEFAULT 0,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                expires_at DATETIME NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )");
        } else {
            $db->exec("CREATE TABLE IF NOT EXISTS `email_otps` (
                `id` VARCHAR(50) NOT NULL,
                `email` VARCHAR(255) NOT NULL,
                `otp_hash` VARCHAR(64) NOT NULL,
                `verification_token` VARCHAR(64) NULL,
                `token_expires_at` DATETIME NULL,
                `attempts` INT NOT NULL DEFAULT 0,
                `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
                `expires_at` DATETIME NOT NULL,
                `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                KEY `idx_email_otps_email` (`email`),
                KEY `idx_email_otps_token` (`verification_token`),
                KEY `idx_email_otps_expires` (`expires_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        }
    }

    /** Apakah SMTP sudah dikonfigurasi (username + App Password terisi)? */
    public static function isMailConfigured(array $config): bool
    {
        return !empty($config['mail']['username']) && !empty($config['mail']['password']);
    }

    private static function mailNotConfiguredMessage(): string
    {
        return 'Pengiriman email belum dikonfigurasi. Isi MAIL_USERNAME dan MAIL_APP_PASSWORD di server/.env (lihat docs/email-otp-setup.md).';
    }

    /**
     * Buat kode 5 digit dan kirim ke email. Mengembalikan info kedaluwarsa.
     *
     * @throws InvalidArgumentException bila email tidak valid (kode 422)
     * @throws RuntimeException bila SMTP belum dikonfigurasi (kode 503),
     *         kirim ulang terlalu cepat (kode 429), atau pengiriman gagal.
     */
    public static function createAndSend(PDO $db, string $email): array
    {
        self::ensureTablesExist($db);

        $email = strtolower(trim($email));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException('Format email tidak valid.');
        }

        $config = require __DIR__ . '/../config/config.php';
        if (!self::isMailConfigured($config)) {
            throw new RuntimeException(self::mailNotConfiguredMessage(), 503);
        }

        $expireMinutes = (int)($config['email_otp']['expire_minutes'] ?? 10);
        $resendCooldown = (int)($config['email_otp']['resend_cooldown_seconds'] ?? 60);

        // Kirim ulang paling cepat 60 detik setelah kode sebelumnya dibuat.
        $stmt = $db->prepare("SELECT created_at FROM email_otps WHERE email = :email AND status = 'pending' ORDER BY created_at DESC LIMIT 1");
        $stmt->execute([':email' => $email]);
        $last = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($last) {
            $wait = $resendCooldown - (time() - strtotime((string)$last['created_at']));
            if ($wait > 0) {
                throw new RuntimeException("Tunggu {$wait} detik sebelum meminta kode baru.", 429);
            }
        }

        // Hanguskan kode pending sebelumnya untuk email ini.
        $stmtInvalidate = $db->prepare("UPDATE email_otps SET status = 'expired' WHERE email = :email AND status = 'pending'");
        $stmtInvalidate->execute([':email' => $email]);

        // Kode 5 digit — hanya hash-nya yang disimpan, kode aslinya tidak.
        $code = (string)random_int(10000, 99999);
        $secret = $config['jwt']['secret'] ?? 'forafa_salt';
        $otpHash = hash('sha256', "{$email}:{$code}:{$secret}");

        $id = 'eotp_' . bin2hex(random_bytes(4));
        $now = time();
        $expiresAt = gmdate('Y-m-d H:i:s', $now + ($expireMinutes * 60));
        $createdAt = gmdate('Y-m-d H:i:s', $now);

        $stmt = $db->prepare("
            INSERT INTO email_otps (id, email, otp_hash, attempts, status, expires_at, created_at)
            VALUES (:id, :email, :hash, 0, 'pending', :exp, :created)
        ");
        $stmt->execute([
            ':id' => $id,
            ':email' => $email,
            ':hash' => $otpHash,
            ':exp' => $expiresAt,
            ':created' => $createdAt,
        ]);

        $subject = "Kode verifikasi Forafa-App: {$code}";
        $html = '<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">'
            . '<h2 style="color:#0f766e">Verifikasi email Anda</h2>'
            . '<p>Halo,</p>'
            . '<p>Gunakan kode berikut untuk menyelesaikan pendaftaran akun Forafa-App Anda:</p>'
            . "<p style=\"font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;padding:16px 0\">{$code}</p>"
            . "<p>Kode ini berlaku <strong>{$expireMinutes} menit</strong>. Jangan bagikan kode ini kepada siapa pun — tim Forafa tidak pernah meminta kode verifikasi Anda.</p>"
            . '<p>Jika Anda tidak meminta kode ini, abaikan email ini.</p>'
            . '<p style="color:#666;font-size:13px">— Tim Forafa-App (forafagroup@gmail.com)</p>'
            . '</div>';
        $text = "Kode verifikasi Forafa-App Anda: {$code}\nKode berlaku {$expireMinutes} menit. Jangan bagikan kode ini kepada siapa pun.";

        $sent = Mailer::send($email, $subject, $html, $text);
        if (!($sent['ok'] ?? false)) {
            // Pengiriman gagal: hanguskan kode supaya tidak ada kode
            // "hantu" yang tidak pernah sampai tapi masih bisa ditebak.
            $up = $db->prepare("UPDATE email_otps SET status = 'expired' WHERE id = :id");
            $up->execute([':id' => $id]);
            throw new RuntimeException($sent['error'] ?? 'Gagal mengirim email verifikasi.', 502);
        }

        return [
            'id' => $id,
            'email' => $email,
            'expires_in_seconds' => $expireMinutes * 60,
            'expires_at' => gmdate('Y-m-d\TH:i:s\Z', strtotime($expiresAt)),
            'resend_after_seconds' => $resendCooldown,
        ];
    }

    /**
     * Verifikasi kode 5 digit. Bila benar, kembalikan verification_token
     * sekali pakai untuk POST /auth/register.
     */
    public static function verify(PDO $db, string $email, string $code): array
    {
        self::ensureTablesExist($db);

        $email = strtolower(trim($email));
        $code = trim($code);

        $config = require __DIR__ . '/../config/config.php';
        $maxAttempts = (int)($config['email_otp']['max_attempts'] ?? 3);
        $tokenExpireMinutes = (int)($config['email_otp']['token_expire_minutes'] ?? 15);
        $secret = $config['jwt']['secret'] ?? 'forafa_salt';

        if (!preg_match('/^\d{5}$/', $code)) {
            return ['valid' => false, 'error' => 'Kode verifikasi harus 5 angka.'];
        }

        $stmt = $db->prepare("SELECT * FROM email_otps WHERE email = :email ORDER BY created_at DESC LIMIT 1");
        $stmt->execute([':email' => $email]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            return ['valid' => false, 'error' => 'Belum ada kode yang dikirim ke email ini. Silakan minta kode baru.'];
        }

        if ($row['status'] === self::STATUS_BLOCKED || (int)$row['attempts'] >= $maxAttempts) {
            return ['valid' => false, 'error' => 'Batas percobaan kode telah terlampaui. Silakan minta kode baru.'];
        }

        if (time() >= strtotime((string)$row['expires_at'])) {
            $up = $db->prepare("UPDATE email_otps SET status = 'expired' WHERE id = :id");
            $up->execute([':id' => $row['id']]);
            return ['valid' => false, 'error' => 'Kode sudah kedaluwarsa. Silakan minta kode baru.'];
        }

        if ($row['status'] !== self::STATUS_PENDING) {
            return ['valid' => false, 'error' => 'Kode sudah pernah digunakan atau tidak aktif. Silakan minta kode baru.'];
        }

        $expectedHash = hash('sha256', "{$email}:{$code}:{$secret}");
        if (!hash_equals((string)$row['otp_hash'], $expectedHash)) {
            $attempts = (int)$row['attempts'] + 1;
            $status = $attempts >= $maxAttempts ? self::STATUS_BLOCKED : self::STATUS_PENDING;
            $up = $db->prepare("UPDATE email_otps SET attempts = :attempts, status = :status WHERE id = :id");
            $up->execute([':attempts' => $attempts, ':status' => $status, ':id' => $row['id']]);
            $left = $maxAttempts - $attempts;
            return ['valid' => false, 'error' => $left > 0
                ? "Kode salah. Sisa percobaan: {$left} kali."
                : 'Kode salah. Batas percobaan terlampaui. Silakan minta kode baru.'];
        }

        $token = bin2hex(random_bytes(32));
        $tokenExpiresAt = gmdate('Y-m-d H:i:s', time() + ($tokenExpireMinutes * 60));
        $up = $db->prepare("UPDATE email_otps SET status = 'verified', verification_token = :token, token_expires_at = :token_exp WHERE id = :id");
        $up->execute([':token' => $token, ':token_exp' => $tokenExpiresAt, ':id' => $row['id']]);

        return [
            'valid' => true,
            'verification_token' => $token,
            'token_expires_in_seconds' => $tokenExpireMinutes * 60,
            'email' => $email,
        ];
    }

    /**
     * Validasi + hanguskan verification_token saat akun dibuat.
     * Mengembalikan true hanya bila token cocok dengan email, masih
     * berstatus terverifikasi, dan belum kedaluwarsa.
     */
    public static function consumeToken(PDO $db, string $email, string $token): bool
    {
        self::ensureTablesExist($db);

        $email = strtolower(trim($email));
        $token = trim($token);
        if ($token === '') return false;

        $stmt = $db->prepare("
            SELECT * FROM email_otps
            WHERE email = :email AND verification_token = :token AND status = 'verified'
            ORDER BY created_at DESC LIMIT 1
        ");
        $stmt->execute([':email' => $email, ':token' => $token]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) return false;
        if (empty($row['token_expires_at']) || time() >= strtotime((string)$row['token_expires_at'])) return false;

        $up = $db->prepare("UPDATE email_otps SET status = 'consumed', verification_token = NULL WHERE id = :id");
        $up->execute([':id' => $row['id']]);
        return true;
    }
}
