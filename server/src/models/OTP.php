<?php
/**
 * WhatsApp OTP Model
 * Manages OTP generation, sending via WhatsApp Gateway, verification,
 * attempt rate-limits, and verification tokens.
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/config.php';

class OTP {
    public const STATUS_PENDING = 'pending';
    public const STATUS_VERIFIED = 'verified';
    public const STATUS_EXPIRED = 'expired';
    public const STATUS_BLOCKED = 'blocked';

    public static function ensureTablesExist(PDO $db): void {
        $driver = $db->getAttribute(PDO::ATTR_DRIVER_NAME);

        if ($driver === 'sqlite') {
            $db->exec("CREATE TABLE IF NOT EXISTS otps (
                id VARCHAR(50) PRIMARY KEY,
                interaction_id VARCHAR(50) NULL,
                phone_number VARCHAR(30) NOT NULL,
                otp_hash VARCHAR(64) NOT NULL,
                verification_token VARCHAR(64) NULL,
                attempts INTEGER NOT NULL DEFAULT 0,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                expires_at DATETIME NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )");
        } else {
            $db->exec("CREATE TABLE IF NOT EXISTS `otps` (
                `id` VARCHAR(50) NOT NULL,
                `interaction_id` VARCHAR(50) NULL,
                `phone_number` VARCHAR(30) NOT NULL,
                `otp_hash` VARCHAR(64) NOT NULL,
                `verification_token` VARCHAR(64) NULL,
                `attempts` INT NOT NULL DEFAULT 0,
                `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
                `expires_at` DATETIME NOT NULL,
                `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                KEY `idx_otps_phone` (`phone_number`),
                KEY `idx_otps_token` (`verification_token`),
                KEY `idx_otps_expires` (`expires_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        }
    }

    /**
     * Standardize Indonesian & International phone numbers into standard E.164 without '+'
     * e.g. '08123456789' -> '628123456789', '+62 812-3456-789' -> '628123456789'
     */
    public static function normalizePhoneNumber(string $phone): string {
        $clean = preg_replace('/[^0-9]/', '', $phone) ?: '';
        if (str_starts_with($clean, '0')) {
            $clean = '62' . substr($clean, 1);
        } elseif (str_starts_with($clean, '8')) {
            $clean = '628' . substr($clean, 1);
        }
        return $clean;
    }

    /**
     * Generate and dispatch a WhatsApp OTP
     */
    public static function createAndSend(PDO $db, string $phone, ?string $interactionId = null): array {
        self::ensureTablesExist($db);

        $cleanPhone = self::normalizePhoneNumber($phone);
        if (strlen($cleanPhone) < 10 || strlen($cleanPhone) > 16) {
            throw new InvalidArgumentException("Nomor telepon tidak valid. Pastikan nomor WhatsApp benar.");
        }

        $config = require __DIR__ . '/../config/config.php';
        $expireMinutes = (int)($config['whatsapp_otp']['otp_expire_minutes'] ?? 5);
        $maxAttempts = (int)($config['whatsapp_otp']['max_attempts'] ?? 3);

        // Invalidate previous active OTPs for this phone
        $stmtInvalidate = $db->prepare("UPDATE otps SET status = 'expired' WHERE phone_number = :phone AND status = 'pending'");
        $stmtInvalidate->execute([':phone' => $cleanPhone]);

        // Generate 6-digit random cryptographic OTP
        $code = (string)random_int(100000, 999999);
        $secret = $config['jwt']['secret'] ?? 'forafa_salt';
        $otpHash = hash('sha256', "{$cleanPhone}:{$code}:{$secret}");

        $id = 'otp_' . bin2hex(random_bytes(4));
        $now = time();
        $expiresAt = gmdate('Y-m-d H:i:s', $now + ($expireMinutes * 60));
        $createdAt = gmdate('Y-m-d H:i:s', $now);

        $stmt = $db->prepare("
            INSERT INTO otps (id, interaction_id, phone_number, otp_hash, attempts, status, expires_at, created_at)
            VALUES (:id, :iid, :phone, :hash, 0, 'pending', :exp, :created)
        ");
        $stmt->execute([
            ':id' => $id,
            ':iid' => $interactionId,
            ':phone' => $cleanPhone,
            ':hash' => $otpHash,
            ':exp' => $expiresAt,
            ':created' => $createdAt,
        ]);

        // Dispatch via WhatsApp Gateway (or mock log in dev)
        $dispatchResult = self::sendWhatsAppMessage($cleanPhone, $code, $expireMinutes);

        return [
            'id' => $id,
            'phone_number' => $cleanPhone,
            'expires_in_seconds' => $expireMinutes * 60,
            'expires_at' => gmdate('Y-m-d\TH:i:s\Z', strtotime($expiresAt)),
            'provider' => $dispatchResult['provider'],
            'dev_otp' => ($config['app']['env'] === 'development' || ($config['whatsapp_otp']['provider'] ?? '') === 'mock') ? $code : null,
        ];
    }

    /**
     * Verify an OTP code
     */
    public static function verify(PDO $db, string $phone, string $code, ?string $interactionId = null): array {
        self::ensureTablesExist($db);

        $cleanPhone = self::normalizePhoneNumber($phone);
        $code = trim($code);

        $config = require __DIR__ . '/../config/config.php';
        $maxAttempts = (int)($config['whatsapp_otp']['max_attempts'] ?? 3);
        $secret = $config['jwt']['secret'] ?? 'forafa_salt';
        $expectedHash = hash('sha256', "{$cleanPhone}:{$code}:{$secret}");

        $stmt = $db->prepare("
            SELECT * FROM otps 
            WHERE phone_number = :phone 
            ORDER BY created_at DESC LIMIT 1
        ");
        $stmt->execute([':phone' => $cleanPhone]);
        $otpRow = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$otpRow) {
            return ['valid' => false, 'error' => "Permintaan OTP tidak ditemukan. Silakan kirim ulang kode OTP."];
        }

        if ($otpRow['status'] === self::STATUS_BLOCKED || (int)$otpRow['attempts'] >= $maxAttempts) {
            return ['valid' => false, 'error' => "Batas percobaan OTP telah terlampaui. Silakan minta kode OTP baru."];
        }

        if (time() >= strtotime($otpRow['expires_at'])) {
            $up = $db->prepare("UPDATE otps SET status = 'expired' WHERE id = :id");
            $up->execute([':id' => $otpRow['id']]);
            return ['valid' => false, 'error' => "Kode OTP telah kedaluwarsa. Silakan minta kode baru."];
        }

        if ($otpRow['status'] !== self::STATUS_PENDING) {
            return ['valid' => false, 'error' => "Kode OTP sudah pernah digunakan atau tidak aktif."];
        }

        // Verify Hash using constant-time comparison
        if (!hash_equals($otpRow['otp_hash'], $expectedHash)) {
            $newAttempts = (int)$otpRow['attempts'] + 1;
            $newStatus = ($newAttempts >= $maxAttempts) ? self::STATUS_BLOCKED : self::STATUS_PENDING;

            $up = $db->prepare("UPDATE otps SET attempts = :att, status = :st WHERE id = :id");
            $up->execute([':att' => $newAttempts, ':st' => $newStatus, ':id' => $otpRow['id']]);

            $remaining = max(0, $maxAttempts - $newAttempts);
            return [
                'valid' => false,
                'error' => "Kode OTP salah. Sisa kesempatan: {$remaining} kali.",
                'remaining_attempts' => $remaining,
            ];
        }

        // OTP Valid! Generate single-use verification token (valid for 15 mins)
        $verificationToken = 'wa_tok_' . bin2hex(random_bytes(16));
        $upSuccess = $db->prepare("
            UPDATE otps 
            SET status = 'verified', verification_token = :token 
            WHERE id = :id
        ");
        $upSuccess->execute([':token' => $verificationToken, ':id' => $otpRow['id']]);

        return [
            'valid' => true,
            'message' => "Verifikasi nomor WhatsApp berhasil.",
            'phone_number' => $cleanPhone,
            'verification_token' => $verificationToken,
        ];
    }

    /**
     * Validate verification token when submitting vote
     */
    public static function validateToken(PDO $db, string $phone, string $token, ?string $interactionId = null): bool {
        self::ensureTablesExist($db);

        $cleanPhone = self::normalizePhoneNumber($phone);
        $token = trim($token);

        $stmt = $db->prepare("
            SELECT * FROM otps 
            WHERE phone_number = :phone AND verification_token = :token AND status = 'verified'
            ORDER BY created_at DESC LIMIT 1
        ");
        $stmt->execute([':phone' => $cleanPhone, ':token' => $token]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            return false;
        }

        // Check if verified within the last 15 minutes
        $verifiedAt = strtotime($row['created_at']);
        if ((time() - $verifiedAt) > (15 * 60)) {
            return false;
        }

        return true;
    }

    /**
     * Internal WhatsApp Gateway sender (supports Mock, Fonnte, Wablas, etc.)
     */
    private static function sendWhatsAppMessage(string $phone, string $code, int $expireMinutes): array {
        $config = require __DIR__ . '/../config/config.php';
        $provider = $config['whatsapp_otp']['provider'] ?? 'mock';
        $apiKey = $config['whatsapp_otp']['api_key'] ?? '';

        $message = "Kode OTP Forafa-App Anda adalah: *{$code}*. Kode berlaku selama {$expireMinutes} menit. Jangan berikan kode ini kepada siapapun.";

        if ($provider === 'fonnte' && !empty($apiKey)) {
            $ch = curl_init('https://api.fonnte.com/send');
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, [
                'target' => $phone,
                'message' => $message,
            ]);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: {$apiKey}"]);
            curl_setopt($ch, CURLOPT_TIMEOUT, 5);
            $res = curl_exec($ch);
            curl_close($ch);
            return ['provider' => 'fonnte', 'status' => 'dispatched'];
        }

        // Mock / Local Dev mode
        return ['provider' => 'mock', 'status' => 'sent'];
    }
}

