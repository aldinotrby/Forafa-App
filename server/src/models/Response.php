<?php
/**
 * Response Model
 * Implements data separation between voting answers and participant identities,
 * along with privacy enforcement for anonymous voting and multi-question branching.
 */

declare(strict_types=1);

require_once __DIR__ . '/VotingQuestion.php';

class ResponseModel {
    /**
     * Ensure responses table has is_anonymous and response_identities table exists
     */
    public static function ensureTablesExist(PDO $db): void {
        $driver = $db->getAttribute(PDO::ATTR_DRIVER_NAME);

        if ($driver === 'sqlite') {
            $db->exec("CREATE TABLE IF NOT EXISTS response_identities (
                id VARCHAR(50) PRIMARY KEY,
                response_id VARCHAR(50) NOT NULL UNIQUE,
                interaction_id VARCHAR(50) NOT NULL,
                name VARCHAR(100) NULL,
                is_anonymous INTEGER NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (response_id) REFERENCES responses(id) ON DELETE CASCADE,
                FOREIGN KEY (interaction_id) REFERENCES interactions(id) ON DELETE CASCADE
            )");

            $cols = $db->query("PRAGMA table_info(responses)")->fetchAll(PDO::FETCH_COLUMN, 1);
            if (!in_array('is_anonymous', $cols, true)) {
                try {
                    $db->exec("ALTER TABLE responses ADD COLUMN is_anonymous INTEGER NOT NULL DEFAULT 0");
                } catch (Throwable $e) {}
            }
        } else {
            $db->exec("CREATE TABLE IF NOT EXISTS `response_identities` (
                `id` VARCHAR(50) NOT NULL,
                `response_id` VARCHAR(50) NOT NULL,
                `interaction_id` VARCHAR(50) NOT NULL,
                `name` VARCHAR(100) NULL,
                `is_anonymous` TINYINT(1) NOT NULL DEFAULT 0,
                `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                UNIQUE KEY `uk_response_identities_response` (`response_id`),
                KEY `idx_response_identities_interaction` (`interaction_id`),
                CONSTRAINT `fk_response_identities_response` FOREIGN KEY (`response_id`) REFERENCES `responses` (`id`) ON DELETE CASCADE,
                CONSTRAINT `fk_response_identities_interaction` FOREIGN KEY (`interaction_id`) REFERENCES `interactions` (`id`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

            try {
                $check = $db->query("SHOW COLUMNS FROM `responses` LIKE 'is_anonymous'")->fetch();
                if (!$check) {
                    $db->exec("ALTER TABLE `responses` ADD COLUMN `is_anonymous` TINYINT(1) NOT NULL DEFAULT 0 AFTER `shared`");
                }
            } catch (Throwable $e) {}
        }

        // Also ensure voting_questions and voting_answers tables exist
        VotingQuestion::ensureTablesExist($db);
    }

    /**
     * Format response row for frontend and API compatibility
     */
    public static function format(array $row): array {
        $isoTime = !empty($row['created_at'])
            ? gmdate('Y-m-d\TH:i:s\Z', strtotime($row['created_at']))
            : null;

        $isAnonymous = !empty($row['is_anonymous']);
        $rawName = $row['identity_name'] ?? $row['name'] ?? null;
        $displayName = $isAnonymous ? null : (!empty($rawName) ? $rawName : null);

        $formatted = [
            'id' => $row['id'],
            'interaction_id' => $row['interaction_id'],
            'iid' => $row['interaction_id'],
            'name' => $displayName,
            'is_anonymous' => $isAnonymous,
            'choice' => $row['choice'] ?? null,
            'message' => $row['message'] ?? null,
            'status' => $row['status'] ?? 'Baru',
            'reply' => $row['reply'] ?? null,
            'shared' => (bool)($row['shared'] ?? 0),
            'created_at' => $isoTime,
            'at' => $isoTime,
        ];

        if (isset($row['answers'])) {
            $formatted['answers'] = $row['answers'];
        }

        return $formatted;
    }

    /**
     * Apply privacy rules when formatting response for a specific viewer
     */
    public static function formatWithPrivacy(array $row, ?array $currentUser, ?array $interaction = null): array {
        $formatted = self::format($row);
        $isAnonymous = !empty($row['is_anonymous']);

        if ($isAnonymous) {
            $formatted['name'] = null;
            $formatted['is_anonymous'] = true;
            return $formatted;
        }

        $isOwner = $currentUser && $interaction && ($interaction['owner_id'] === $currentUser['id']);
        $isAdmin = $currentUser && (($currentUser['role'] ?? '') === 'Administrator');

        if ($isOwner || $isAdmin) {
            $realName = $row['identity_name'] ?? $row['name'] ?? null;
            $formatted['name'] = !empty($realName) ? $realName : null;
            $formatted['is_anonymous'] = false;
        } else {
            $formatted['name'] = null;
        }

        return $formatted;
    }

    /**
     * Batch attach granular branching answers to response rows
     */
    private static function attachAnswersToRows(PDO $db, array $rows): array {
        if (empty($rows)) {
            return [];
        }

        $respIds = array_column($rows, 'id');
        $placeholders = implode(',', array_fill(0, count($respIds), '?'));

        $sql = "
            SELECT va.*, vq.title AS question_title
            FROM voting_answers va
            LEFT JOIN voting_questions vq ON vq.id = va.question_id
            WHERE va.response_id IN ($placeholders)
            ORDER BY va.created_at ASC
        ";

        try {
            $stmt = $db->prepare($sql);
            $stmt->execute($respIds);
            $allAnswers = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $grouped = [];
            $roles = VotingQuestion::getKnownRoles();
            foreach ($allAnswers as $ans) {
                $rid = $ans['response_id'];
                if (!isset($grouped[$rid])) {
                    $grouped[$rid] = [];
                }
                $grouped[$rid][] = [
                    'id' => $ans['id'],
                    'question_id' => $ans['question_id'],
                    'role_key' => $ans['role_key'],
                    'role_label' => $roles[$ans['role_key']] ?? ucfirst($ans['role_key']),
                    'question_title' => $ans['question_title'] ?? 'Pertanyaan',
                    'choice' => $ans['choice'],
                ];
            }

            foreach ($rows as &$r) {
                if (isset($grouped[$r['id']])) {
                    $r['answers'] = $grouped[$r['id']];
                }
            }
        } catch (Throwable $e) {}

        return $rows;
    }

    public static function findById(PDO $db, string $id): ?array {
        self::ensureTablesExist($db);

        $stmt = $db->prepare("
            SELECT r.*, ri.name AS identity_name, COALESCE(r.is_anonymous, ri.is_anonymous, 0) AS is_anonymous
            FROM responses r
            LEFT JOIN response_identities ri ON ri.response_id = r.id
            WHERE r.id = :id
        ");
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) return null;

        $answers = VotingQuestion::getAnswersByResponse($db, $id);
        if (!empty($answers)) {
            $row['answers'] = $answers;
        }

        return $row;
    }

    public static function getByInteraction(PDO $db, string $interactionId, int $skip = 0, int $limit = 200): array {
        self::ensureTablesExist($db);

        $stmt = $db->prepare("
            SELECT r.*, ri.name AS identity_name, COALESCE(r.is_anonymous, ri.is_anonymous, 0) AS is_anonymous
            FROM responses r
            LEFT JOIN response_identities ri ON ri.response_id = r.id
            WHERE r.interaction_id = :interaction_id 
            ORDER BY r.created_at DESC 
            LIMIT :limit OFFSET :skip
        ");
        $stmt->bindValue(':interaction_id', $interactionId);
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':skip', $skip, PDO::PARAM_INT);
        $stmt->execute();

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        return self::attachAnswersToRows($db, $rows);
    }

    public static function getByInteractions(PDO $db, array $interactionIds, int $skip = 0, int $limit = 500): array {
        self::ensureTablesExist($db);

        if (empty($interactionIds)) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($interactionIds), '?'));
        $sql = "
            SELECT r.*, ri.name AS identity_name, COALESCE(r.is_anonymous, ri.is_anonymous, 0) AS is_anonymous
            FROM responses r
            LEFT JOIN response_identities ri ON ri.response_id = r.id
            WHERE r.interaction_id IN ($placeholders)
            ORDER BY r.created_at DESC
            LIMIT ? OFFSET ?
        ";
        
        $stmt = $db->prepare($sql);
        $paramIndex = 1;
        foreach ($interactionIds as $id) {
            $stmt->bindValue($paramIndex++, $id, PDO::PARAM_STR);
        }
        $stmt->bindValue($paramIndex++, $limit, PDO::PARAM_INT);
        $stmt->bindValue($paramIndex++, $skip, PDO::PARAM_INT);
        $stmt->execute();

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        return self::attachAnswersToRows($db, $rows);
    }

    /**
     * Create response with explicit separation between voting answer and identity data
     */
    public static function create(PDO $db, array $data, ?string $customId = null): array {
        self::ensureTablesExist($db);

        $responseId = $customId ?? ('r_' . bin2hex(random_bytes(4)));
        $identityId = 'ri_' . bin2hex(random_bytes(4));
        $now = gmdate('Y-m-d H:i:s');
        $status = $data['status'] ?? 'Baru';
        $shared = isset($data['shared']) ? (int)(bool)$data['shared'] : 0;

        $rawName = isset($data['name']) ? trim((string)$data['name']) : null;
        $name = !empty($rawName) ? $rawName : null;

        if (isset($data['is_anonymous'])) {
            $isAnonymous = filter_var($data['is_anonymous'], FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
        } elseif (isset($data['privacy']) && strtolower(trim((string)$data['privacy'])) === 'anonymous') {
            $isAnonymous = 1;
        } elseif (empty($name)) {
            $isAnonymous = 1;
        } else {
            $isAnonymous = 0;
        }

        // 1. Simpan data jawaban voting ke tabel `responses`
        $stmtResponse = $db->prepare("
            INSERT INTO responses (id, interaction_id, name, choice, message, status, reply, shared, is_anonymous, created_at)
            VALUES (:id, :interaction_id, :name, :choice, :message, :status, :reply, :shared, :is_anonymous, :created_at)
        ");
        $stmtResponse->execute([
            ':id' => $responseId,
            ':interaction_id' => $data['interaction_id'],
            ':name' => ($isAnonymous ? null : $name),
            ':choice' => $data['choice'] ?? null,
            ':message' => $data['message'] ?? null,
            ':status' => $status,
            ':reply' => $data['reply'] ?? null,
            ':shared' => $shared,
            ':is_anonymous' => $isAnonymous,
            ':created_at' => $now,
        ]);

        // 2. Simpan data identitas pemilih secara terpisah ke tabel `response_identities`
        $stmtIdentity = $db->prepare("
            INSERT INTO response_identities (id, response_id, interaction_id, name, is_anonymous, created_at)
            VALUES (:id, :response_id, :interaction_id, :name, :is_anonymous, :created_at)
        ");
        $stmtIdentity->execute([
            ':id' => $identityId,
            ':response_id' => $responseId,
            ':interaction_id' => $data['interaction_id'],
            ':name' => $name,
            ':is_anonymous' => $isAnonymous,
            ':created_at' => $now,
        ]);

        return self::format([
            'id' => $responseId,
            'interaction_id' => $data['interaction_id'],
            'name' => ($isAnonymous ? null : $name),
            'is_anonymous' => $isAnonymous,
            'choice' => $data['choice'] ?? null,
            'message' => $data['message'] ?? null,
            'status' => $status,
            'reply' => $data['reply'] ?? null,
            'shared' => $shared,
            'created_at' => $now,
        ]);
    }

    public static function update(PDO $db, string $id, array $data): array {
        $fields = [];
        $params = [':id' => $id];

        if (array_key_exists('status', $data)) {
            $fields[] = "status = :status";
            $params[':status'] = $data['status'];
        }
        if (array_key_exists('reply', $data)) {
            $fields[] = "reply = :reply";
            $params[':reply'] = $data['reply'];
        }
        if (array_key_exists('shared', $data)) {
            $fields[] = "shared = :shared";
            $params[':shared'] = (int)(bool)$data['shared'];
        }

        if (!empty($fields)) {
            $sql = "UPDATE responses SET " . implode(', ', $fields) . " WHERE id = :id";
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
        }

        $row = self::findById($db, $id);
        return $row ? self::format($row) : [];
    }

    public static function delete(PDO $db, string $id): void {
        self::ensureTablesExist($db);
        $stmt = $db->prepare("DELETE FROM responses WHERE id = :id");
        $stmt->execute([':id' => $id]);
    }

    /**
     * Generate CSV content with privacy masking applied
     */
    public static function generateCsv(array $responses, string $interactionTitle = ''): string {
        $output = fopen('php://temp', 'r+');
        fputcsv($output, ['ID', 'Interaction Title', 'Pengirim / Nama', 'Status Privasi', 'Pilihan Vote', 'Pesan / Masukan', 'Status', 'Tanggapan / Reply', 'Dibagikan Publik', 'Waktu']);

        foreach ($responses as $r) {
            $isAnon = !empty($r['is_anonymous']);
            $displayName = $isAnon ? 'Anonim' : (!empty($r['name']) ? $r['name'] : 'Anonim');
            fputcsv($output, [
                $r['id'] ?? '',
                $interactionTitle,
                $displayName,
                $isAnon ? 'Anonymous' : 'Nama Asli',
                $r['choice'] ?? '-',
                $r['message'] ?? '-',
                $r['status'] ?? 'Baru',
                $r['reply'] ?? '-',
                !empty($r['shared']) ? 'Ya' : 'Tidak',
                $r['created_at'] ?? '',
            ]);
        }

        rewind($output);
        $csv = stream_get_contents($output);
        fclose($output);
        return $csv;
    }
}
