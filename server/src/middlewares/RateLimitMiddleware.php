<?php
/**
 * Rate Limiting Middleware
 * Protects against brute-force, voting spam, and resource exhaustion.
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/Response.php';

class RateLimitMiddleware {
    public static function ensureTableExists(PDO $db): void {
        $driver = $db->getAttribute(PDO::ATTR_DRIVER_NAME);

        if ($driver === 'sqlite') {
            $db->exec("CREATE TABLE IF NOT EXISTS rate_limits (
                key_hash VARCHAR(64) PRIMARY KEY,
                hits INTEGER NOT NULL DEFAULT 1,
                reset_at DATETIME NOT NULL
            )");
        } else {
            $db->exec("CREATE TABLE IF NOT EXISTS `rate_limits` (
                `key_hash` VARCHAR(64) NOT NULL,
                `hits` INT NOT NULL DEFAULT 1,
                `reset_at` DATETIME NOT NULL,
                PRIMARY KEY (`key_hash`),
                KEY `idx_rate_limits_reset` (`reset_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        }
    }

    /**
     * Get Client IP
     */
    public static function getClientIp(): string {
        if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
            return trim($ips[0]);
        }
        return $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
    }

    /**
     * Enforce rate limit for an action
     * @param string $action Action identifier (e.g. 'submit_vote', 'send_otp', 'general_api')
     * @param int $maxRequests Max allowed hits
     * @param int $windowSeconds Window period in seconds
     * @param ?string $customIdentifier Optional specific identifier (e.g. phone or user ID)
     */
    public static function enforce(string $action, int $maxRequests = 60, int $windowSeconds = 60, ?string $customIdentifier = null): void {
        $config = require __DIR__ . '/../config/config.php';
        if (empty($config['rate_limit']['enabled'])) {
            return;
        }

        $ip = self::getClientIp();
        $target = $customIdentifier ? "{$action}:{$customIdentifier}" : "{$action}:{$ip}";
        $keyHash = hash('sha256', $target);

        $db = Database::getConnection();
        self::ensureTableExists($db);

        $now = time();
        $nowIso = gmdate('Y-m-d H:i:s', $now);

        // Fetch current rate limit row
        $stmt = $db->prepare("SELECT * FROM rate_limits WHERE key_hash = :hash");
        $stmt->execute([':hash' => $keyHash]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($row && strtotime($row['reset_at']) > $now) {
            $hits = (int)$row['hits'] + 1;
            $resetAt = strtotime($row['reset_at']);

            $up = $db->prepare("UPDATE rate_limits SET hits = :hits WHERE key_hash = :hash");
            $up->execute([':hits' => $hits, ':hash' => $keyHash]);

            $remaining = max(0, $maxRequests - $hits);

            header("X-RateLimit-Limit: {$maxRequests}");
            header("X-RateLimit-Remaining: {$remaining}");
            header("X-RateLimit-Reset: {$resetAt}");

            if ($hits > $maxRequests) {
                $retryAfter = max(1, $resetAt - $now);
                header("Retry-After: {$retryAfter}");
                ApiResponse::error("Terlalu banyak permintaan (Rate limit terlampaui). Silakan coba lagi dalam {$retryAfter} detik.", 429);
            }
        } else {
            // New window
            $resetAt = $now + $windowSeconds;
            $resetAtIso = gmdate('Y-m-d H:i:s', $resetAt);

            // Clean expired or insert new
            $del = $db->prepare("DELETE FROM rate_limits WHERE key_hash = :hash OR reset_at < :now");
            $del->execute([':hash' => $keyHash, ':now' => $nowIso]);

            $ins = $db->prepare("INSERT INTO rate_limits (key_hash, hits, reset_at) VALUES (:hash, 1, :reset)");
            $ins->execute([':hash' => $keyHash, ':reset' => $resetAtIso]);

            header("X-RateLimit-Limit: {$maxRequests}");
            header("X-RateLimit-Remaining: " . ($maxRequests - 1));
            header("X-RateLimit-Reset: {$resetAt}");
        }
    }
}

