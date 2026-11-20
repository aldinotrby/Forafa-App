<?php
/**
 * Notification Model
 * Menyimpan notifikasi untuk akun pengisi, misalnya saat pembuat link
 * membalas tanggapan mereka. Notifikasi bersifat privat per pengguna.
 */

declare(strict_types=1);

class Notification {
    /**
     * Ensure notifications table exists (MySQL & SQLite)
     */
    public static function ensureTablesExist(PDO $db): void {
        $driver = $db->getAttribute(PDO::ATTR_DRIVER_NAME);

        if ($driver === 'sqlite') {
            $db->exec("CREATE TABLE IF NOT EXISTS notifications (
                id VARCHAR(50) PRIMARY KEY,
                user_id VARCHAR(50) NOT NULL,
                response_id VARCHAR(50) NULL,
                interaction_id VARCHAR(50) NULL,
                type VARCHAR(30) NOT NULL DEFAULT 'reply',
                title VARCHAR(255) NOT NULL,
                message TEXT NULL,
                is_read INTEGER NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (response_id) REFERENCES responses(id) ON DELETE CASCADE,
                FOREIGN KEY (interaction_id) REFERENCES interactions(id) ON DELETE SET NULL
            )");
            $db->exec("CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)");
        } else {
            $db->exec("CREATE TABLE IF NOT EXISTS `notifications` (
                `id` VARCHAR(50) NOT NULL,
                `user_id` VARCHAR(50) NOT NULL,
                `response_id` VARCHAR(50) NULL,
                `interaction_id` VARCHAR(50) NULL,
                `type` VARCHAR(30) NOT NULL DEFAULT 'reply',
                `title` VARCHAR(255) NOT NULL,
                `message` TEXT NULL,
                `is_read` TINYINT(1) NOT NULL DEFAULT 0,
                `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                KEY `idx_notifications_user` (`user_id`),
                KEY `idx_notifications_is_read` (`is_read`),
                CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
                CONSTRAINT `fk_notifications_response` FOREIGN KEY (`response_id`) REFERENCES `responses` (`id`) ON DELETE CASCADE,
                CONSTRAINT `fk_notifications_interaction` FOREIGN KEY (`interaction_id`) REFERENCES `interactions` (`id`) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        }
    }

    /**
     * Format one notification row for API output
     */
    public static function format(array $row): array {
        return [
            'id' => $row['id'],
            'user_id' => $row['user_id'] ?? null,
            'response_id' => $row['response_id'] ?? null,
            'interaction_id' => $row['interaction_id'] ?? null,
            'type' => $row['type'] ?? 'reply',
            'title' => $row['title'] ?? '',
            'message' => $row['message'] ?? null,
            'is_read' => (bool)($row['is_read'] ?? 0),
            'created_at' => !empty($row['created_at'])
                ? gmdate('Y-m-d\TH:i:s\Z', strtotime($row['created_at']))
                : null,
        ];
    }

    /**
     * Create a notification for a user
     */
    public static function create(PDO $db, array $data): array {
        self::ensureTablesExist($db);

        $id = 'nt_' . bin2hex(random_bytes(4));
        $now = gmdate('Y-m-d H:i:s');

        $stmt = $db->prepare("
            INSERT INTO notifications (id, user_id, response_id, interaction_id, type, title, message, is_read, created_at)
            VALUES (:id, :user_id, :response_id, :interaction_id, :type, :title, :message, 0, :created_at)
        ");
        $stmt->execute([
            ':id' => $id,
            ':user_id' => $data['user_id'],
            ':response_id' => $data['response_id'] ?? null,
            ':interaction_id' => $data['interaction_id'] ?? null,
            ':type' => $data['type'] ?? 'reply',
            ':title' => $data['title'] ?? 'Notifikasi baru',
            ':message' => $data['message'] ?? null,
            ':created_at' => $now,
        ]);

        return self::format([
            'id' => $id,
            'user_id' => $data['user_id'],
            'response_id' => $data['response_id'] ?? null,
            'interaction_id' => $data['interaction_id'] ?? null,
            'type' => $data['type'] ?? 'reply',
            'title' => $data['title'] ?? 'Notifikasi baru',
            'message' => $data['message'] ?? null,
            'is_read' => 0,
            'created_at' => $now,
        ]);
    }

    /**
     * List notifications belonging to one user only
     */
    public static function getByUser(PDO $db, string $userId, bool $unreadOnly = false, int $limit = 100): array {
        self::ensureTablesExist($db);

        $sql = "SELECT * FROM notifications WHERE user_id = :user_id";
        if ($unreadOnly) {
            $sql .= " AND is_read = 0";
        }
        $sql .= " ORDER BY created_at DESC LIMIT :limit";

        $stmt = $db->prepare($sql);
        $stmt->bindValue(':user_id', $userId);
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();

        return array_map([self::class, 'format'], $stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
    }

    /**
     * Count unread notifications for one user
     */
    public static function unreadCount(PDO $db, string $userId): int {
        self::ensureTablesExist($db);

        $stmt = $db->prepare("SELECT COUNT(*) AS total FROM notifications WHERE user_id = :user_id AND is_read = 0");
        $stmt->execute([':user_id' => $userId]);
        return (int)($stmt->fetch()['total'] ?? 0);
    }

    /**
     * Mark one notification as read. Returns false bila bukan milik user.
     */
    public static function markRead(PDO $db, string $id, string $userId): bool {
        self::ensureTablesExist($db);

        $stmt = $db->prepare("UPDATE notifications SET is_read = 1 WHERE id = :id AND user_id = :user_id");
        $stmt->execute([':id' => $id, ':user_id' => $userId]);
        return $stmt->rowCount() > 0;
    }

    /**
     * Mark all notifications of a user as read
     */
    public static function markAllRead(PDO $db, string $userId): int {
        self::ensureTablesExist($db);

        $stmt = $db->prepare("UPDATE notifications SET is_read = 1 WHERE user_id = :user_id AND is_read = 0");
        $stmt->execute([':user_id' => $userId]);
        return $stmt->rowCount();
    }
}
