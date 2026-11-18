<?php
/**
 * Participant Model
 * Manages unique voting participant records per interaction link.
 * Strictly enforces:
 * - 1 Google Account = 1 Vote per Interaction Link
 * - 1 WhatsApp Phone Number = 1 Vote per Interaction Link
 * - Anti-repeat voting submissions
 */

declare(strict_types=1);

class Participant {
    public const TYPE_GOOGLE = 'google';
    public const TYPE_WHATSAPP = 'whatsapp';
    public const TYPE_USER = 'user';
    public const TYPE_IP = 'ip';

    public static function ensureTablesExist(PDO $db): void {
        $driver = $db->getAttribute(PDO::ATTR_DRIVER_NAME);

        if ($driver === 'sqlite') {
            $db->exec("CREATE TABLE IF NOT EXISTS interaction_participants (
                id VARCHAR(50) PRIMARY KEY,
                interaction_id VARCHAR(50) NOT NULL,
                participant_type VARCHAR(20) NOT NULL,
                identifier_hash VARCHAR(64) NOT NULL,
                response_id VARCHAR(50) NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (interaction_id, participant_type, identifier_hash),
                FOREIGN KEY (interaction_id) REFERENCES interactions(id) ON DELETE CASCADE
            )");
        } else {
            $db->exec("CREATE TABLE IF NOT EXISTS `interaction_participants` (
                `id` VARCHAR(50) NOT NULL,
                `interaction_id` VARCHAR(50) NOT NULL,
                `participant_type` VARCHAR(20) NOT NULL,
                `identifier_hash` VARCHAR(64) NOT NULL,
                `response_id` VARCHAR(50) NULL,
                `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                UNIQUE KEY `uk_participant` (`interaction_id`, `participant_type`, `identifier_hash`),
                KEY `idx_participants_interaction` (`interaction_id`),
                KEY `idx_participants_response` (`response_id`),
                CONSTRAINT `fk_participants_interaction` FOREIGN KEY (`interaction_id`) REFERENCES `interactions` (`id`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        }
    }

    /**
     * Compute SHA-256 hash of an identifier
     */
    public static function hashIdentifier(string $raw): string {
        return hash('sha256', strtolower(trim($raw)));
    }

    /**
     * Check if an identifier has already submitted a response for the interaction
     */
    public static function hasVoted(PDO $db, string $interactionId, string $type, string $rawIdentifier): bool {
        self::ensureTablesExist($db);

        $hash = self::hashIdentifier($rawIdentifier);
        $stmt = $db->prepare("
            SELECT COUNT(*) AS total 
            FROM interaction_participants 
            WHERE interaction_id = :iid AND participant_type = :type AND identifier_hash = :hash
        ");
        $stmt->execute([
            ':iid' => $interactionId,
            ':type' => $type,
            ':hash' => $hash,
        ]);

        return ((int)($stmt->fetch()['total'] ?? 0)) > 0;
    }

    /**
     * Record a vote participation lock for the interaction
     */
    public static function recordVote(
        PDO $db,
        string $interactionId,
        string $type,
        string $rawIdentifier,
        ?string $responseId = null
    ): bool {
        self::ensureTablesExist($db);

        $id = 'pt_' . bin2hex(random_bytes(4));
        $hash = self::hashIdentifier($rawIdentifier);
        $now = gmdate('Y-m-d H:i:s');

        try {
            $stmt = $db->prepare("
                INSERT INTO interaction_participants (id, interaction_id, participant_type, identifier_hash, response_id, created_at)
                VALUES (:id, :iid, :type, :hash, :rid, :created_at)
            ");
            return $stmt->execute([
                ':id' => $id,
                ':iid' => $interactionId,
                ':type' => $type,
                ':hash' => $hash,
                ':rid' => $responseId,
                ':created_at' => $now,
            ]);
        } catch (Throwable $e) {
            // Duplicate key constraint violation -> already voted!
            return false;
        }
    }
}

