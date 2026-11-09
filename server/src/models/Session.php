<?php
/**
 * Session Model
 * Handles user session lifecycle, expiration, regeneration, and revocation.
 */

declare(strict_types=1);

class Session {
    /**
     * Ensure the sessions table exists in the database
     */
    public static function ensureTableExists(PDO $db): void {
        $driver = $db->getAttribute(PDO::ATTR_DRIVER_NAME);
        if ($driver === 'sqlite') {
            $sql = "CREATE TABLE IF NOT EXISTS sessions (
                id VARCHAR(64) PRIMARY KEY,
                user_id VARCHAR(50) NOT NULL,
                token_hash VARCHAR(64) NOT NULL UNIQUE,
                ip_address VARCHAR(45) NULL,
                user_agent TEXT NULL,
                payload TEXT NULL,
                last_activity_at DATETIME NOT NULL,
                expires_at DATETIME NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )";
        } else {
            $sql = "CREATE TABLE IF NOT EXISTS `sessions` (
                `id` VARCHAR(64) NOT NULL,
                `user_id` VARCHAR(50) NOT NULL,
                `token_hash` VARCHAR(64) NOT NULL,
                `ip_address` VARCHAR(45) NULL,
                `user_agent` TEXT NULL,
                `payload` JSON NULL,
                `last_activity_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                `expires_at` DATETIME NOT NULL,
                `is_active` TINYINT(1) NOT NULL DEFAULT 1,
                `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                UNIQUE KEY `uk_sessions_token_hash` (`token_hash`),
                KEY `idx_sessions_user_id` (`user_id`),
                KEY `idx_sessions_expires_at` (`expires_at`),
                CONSTRAINT `fk_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
        }

        try {
            $db->exec($sql);
        } catch (Throwable $e) {
            // Silently continue if table already exists
        }
    }

    /**
     * Compute a SHA-256 hash of a bearer token
     */
    public static function hashToken(string $token): string {
        return hash('sha256', $token);
    }

    /**
     * Get client IP address
     */
    public static function getClientIp(): ?string {
        if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
            return trim($ips[0]);
        }
        return $_SERVER['REMOTE_ADDR'] ?? null;
    }

    /**
     * Get client User-Agent
     */
    public static function getUserAgent(): ?string {
        return $_SERVER['HTTP_USER_AGENT'] ?? null;
    }

    /**
     * Create a new session record in the database
     */
    public static function create(
        PDO $db,
        string $userId,
        string $token,
        int $lifetimeMinutes = 1440,
        ?array $payload = null,
        ?string $customSessionId = null
    ): array {
        self::ensureTableExists($db);

        $sessionId = $customSessionId ?: ('sess_' . bin2hex(random_bytes(16)));
        $tokenHash = self::hashToken($token);
        $ip = self::getClientIp();
        $ua = self::getUserAgent();
        $now = gmdate('Y-m-d H:i:s');
        $expiresAt = gmdate('Y-m-d H:i:s', time() + ($lifetimeMinutes * 60));
        $payloadJson = $payload !== null ? json_encode($payload, JSON_UNESCAPED_SLASHES) : null;

        // Ensure any existing collision with this token_hash is safely cleared
        $del = $db->prepare("DELETE FROM sessions WHERE token_hash = :hash");
        $del->execute([':hash' => $tokenHash]);

        $stmt = $db->prepare("
            INSERT INTO sessions (id, user_id, token_hash, ip_address, user_agent, payload, last_activity_at, expires_at, is_active, created_at)
            VALUES (:id, :user_id, :token_hash, :ip_address, :user_agent, :payload, :last_activity_at, :expires_at, 1, :created_at)
        ");

        $stmt->execute([
            ':id' => $sessionId,
            ':user_id' => $userId,
            ':token_hash' => $tokenHash,
            ':ip_address' => $ip,
            ':user_agent' => $ua,
            ':payload' => $payloadJson,
            ':last_activity_at' => $now,
            ':expires_at' => $expiresAt,
            ':created_at' => $now,
        ]);

        return [
            'id' => $sessionId,
            'user_id' => $userId,
            'token_hash' => $tokenHash,
            'ip_address' => $ip,
            'user_agent' => $ua,
            'last_activity_at' => gmdate('Y-m-d\TH:i:s\Z', strtotime($now)),
            'expires_at' => gmdate('Y-m-d\TH:i:s\Z', strtotime($expiresAt)),
            'is_active' => 1,
        ];
    }

    /**
     * Session Regeneration:
     * Invalidate any previous session associated with the user/client and issue a fresh session
     * to protect against Session Fixation attacks.
     */
    public static function regenerate(
        PDO $db,
        string $userId,
        ?string $oldToken,
        string $newToken,
        int $lifetimeMinutes = 1440,
        ?array $payload = null
    ): array {
        self::ensureTableExists($db);

        // 1. Invalidate old session if old token provided
        if (!empty($oldToken)) {
            self::revoke($db, $oldToken);
        }

        // 2. Generate a brand new unique session ID
        $newSessionId = 'sess_' . bin2hex(random_bytes(16));

        // 3. Create fresh session
        return self::create($db, $userId, $newToken, $lifetimeMinutes, $payload, $newSessionId);
    }

    /**
     * Validate an active session:
     * - Checks if session exists and is_active == 1
     * - Checks absolute expiration (expires_at)
     * - Checks idle timeout (last_activity_at + idleTimeoutMinutes)
     * - Updates last_activity_at when valid
     */
    public static function validate(PDO $db, string $token, int $idleTimeoutMinutes = 120): ?array {
        self::ensureTableExists($db);

        $tokenHash = self::hashToken($token);
        $stmt = $db->prepare("SELECT * FROM sessions WHERE token_hash = :token_hash LIMIT 1");
        $stmt->execute([':token_hash' => $tokenHash]);
        $session = $stmt->fetch();

        if (!$session || (int)$session['is_active'] !== 1) {
            return null;
        }

        $now = time();
        $expiresAt = strtotime($session['expires_at']);
        $lastActivity = strtotime($session['last_activity_at']);

        // Check absolute expiration
        if ($now >= $expiresAt) {
            self::deactivateById($db, $session['id']);
            return null;
        }

        // Check idle timeout
        if ($idleTimeoutMinutes > 0 && ($now - $lastActivity) > ($idleTimeoutMinutes * 60)) {
            self::deactivateById($db, $session['id']);
            return null;
        }

        // Update last activity to current time
        $updatedActivity = gmdate('Y-m-d H:i:s');
        $upStmt = $db->prepare("UPDATE sessions SET last_activity_at = :last_act WHERE id = :id");
        $upStmt->execute([
            ':last_act' => $updatedActivity,
            ':id' => $session['id'],
        ]);

        $session['last_activity_at'] = $updatedActivity;

        return [
            'id' => $session['id'],
            'user_id' => $session['user_id'],
            'last_activity_at' => gmdate('Y-m-d\TH:i:s\Z', strtotime($updatedActivity)),
            'expires_at' => gmdate('Y-m-d\TH:i:s\Z', $expiresAt),
            'remaining_seconds' => max(0, $expiresAt - $now),
            'is_active' => 1,
        ];
    }

    /**
     * Revoke (destroy/invalidate) a session by token upon logout
     */
    public static function revoke(PDO $db, string $token): bool {
        self::ensureTableExists($db);
        $tokenHash = self::hashToken($token);
        $stmt = $db->prepare("UPDATE sessions SET is_active = 0 WHERE token_hash = :token_hash");
        return $stmt->execute([':token_hash' => $tokenHash]);
    }

    /**
     * Deactivate a session by its primary ID
     */
    public static function deactivateById(PDO $db, string $sessionId): bool {
        $stmt = $db->prepare("UPDATE sessions SET is_active = 0 WHERE id = :id");
        return $stmt->execute([':id' => $sessionId]);
    }

    /**
     * Revoke all active sessions for a given user (e.g. password change, security reset)
     */
    public static function revokeAllForUser(PDO $db, string $userId): bool {
        self::ensureTableExists($db);
        $stmt = $db->prepare("UPDATE sessions SET is_active = 0 WHERE user_id = :user_id");
        return $stmt->execute([':user_id' => $userId]);
    }

    /**
     * Get active sessions for a user (e.g. to list logged-in devices)
     */
    public static function getActiveSessionsForUser(PDO $db, string $userId): array {
        self::ensureTableExists($db);
        $stmt = $db->prepare("
            SELECT id, ip_address, user_agent, last_activity_at, expires_at, created_at
            FROM sessions
            WHERE user_id = :user_id AND is_active = 1 AND expires_at > :now
            ORDER BY last_activity_at DESC
        ");
        $stmt->execute([
            ':user_id' => $userId,
            ':now' => gmdate('Y-m-d H:i:s'),
        ]);
        return $stmt->fetchAll() ?: [];
    }

    /**
     * Garbage collector: clean up old inactive or expired sessions
     */
    public static function cleanupExpired(PDO $db): int {
        self::ensureTableExists($db);
        $now = gmdate('Y-m-d H:i:s');
        $stmt = $db->prepare("DELETE FROM sessions WHERE expires_at < :now OR is_active = 0");
        $stmt->execute([':now' => $now]);
        return $stmt->rowCount();
    }
}
