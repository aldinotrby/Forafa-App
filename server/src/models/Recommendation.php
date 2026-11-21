<?php
/**
 * Recommendation Model
 * Logika rekomendasi voting berbasis aturan IF-ELSE:
 * - Menyimpan kriteria rekomendasi (recommendation_rules)
 * - Mengevaluasi kondisi IF-ELSE terhadap jawaban pengisi
 * - Menghasilkan kandidat rekomendasi untuk pertanyaan target
 * - Menyimpan hasil rekomendasi per pengisian (recommendation_results)
 */

declare(strict_types=1);

class Recommendation {
    /**
     * Operator kondisi yang didukung aturan IF-ELSE
     */
    public const OPERATORS = ['eq', 'neq', 'contains', 'in'];

    public const MODE_RECOMMENDATION = 'recommendation';
    public const MODE_MANUAL = 'manual';

    /**
     * Ensure recommendation tables exist and interactions.recommendation_enabled column is present
     */
    public static function ensureTablesExist(PDO $db): void {
        $driver = $db->getAttribute(PDO::ATTR_DRIVER_NAME);

        if ($driver === 'sqlite') {
            $db->exec("CREATE TABLE IF NOT EXISTS recommendation_rules (
                id VARCHAR(50) PRIMARY KEY,
                interaction_id VARCHAR(50) NOT NULL,
                target_question_id VARCHAR(50) NOT NULL,
                conditions TEXT NOT NULL,
                recommended_choice VARCHAR(255) NOT NULL,
                priority INTEGER NOT NULL DEFAULT 0,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (interaction_id) REFERENCES interactions(id) ON DELETE CASCADE,
                FOREIGN KEY (target_question_id) REFERENCES voting_questions(id) ON DELETE CASCADE
            )");
            $db->exec("CREATE TABLE IF NOT EXISTS recommendation_results (
                id VARCHAR(50) PRIMARY KEY,
                response_id VARCHAR(50) NOT NULL UNIQUE,
                interaction_id VARCHAR(50) NOT NULL,
                mode VARCHAR(20) NOT NULL DEFAULT 'manual',
                recommendations TEXT NULL,
                matched_rule_ids TEXT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (response_id) REFERENCES responses(id) ON DELETE CASCADE,
                FOREIGN KEY (interaction_id) REFERENCES interactions(id) ON DELETE CASCADE
            )");

            $iCols = $db->query("PRAGMA table_info(interactions)")->fetchAll(PDO::FETCH_COLUMN, 1);
            if (!in_array('recommendation_enabled', $iCols, true)) {
                try {
                    $db->exec("ALTER TABLE interactions ADD COLUMN recommendation_enabled INTEGER NOT NULL DEFAULT 0");
                } catch (Throwable $e) {}
            }
        } else {
            $db->exec("CREATE TABLE IF NOT EXISTS `recommendation_rules` (
                `id` VARCHAR(50) NOT NULL,
                `interaction_id` VARCHAR(50) NOT NULL,
                `target_question_id` VARCHAR(50) NOT NULL,
                `conditions` JSON NOT NULL,
                `recommended_choice` VARCHAR(255) NOT NULL,
                `priority` INT NOT NULL DEFAULT 0,
                `is_active` TINYINT(1) NOT NULL DEFAULT 1,
                `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                KEY `idx_recommendation_rules_interaction` (`interaction_id`),
                KEY `idx_recommendation_rules_target` (`target_question_id`),
                KEY `idx_recommendation_rules_priority` (`priority`),
                CONSTRAINT `fk_recommendation_rules_interaction` FOREIGN KEY (`interaction_id`) REFERENCES `interactions` (`id`) ON DELETE CASCADE,
                CONSTRAINT `fk_recommendation_rules_target` FOREIGN KEY (`target_question_id`) REFERENCES `voting_questions` (`id`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

            $db->exec("CREATE TABLE IF NOT EXISTS `recommendation_results` (
                `id` VARCHAR(50) NOT NULL,
                `response_id` VARCHAR(50) NOT NULL,
                `interaction_id` VARCHAR(50) NOT NULL,
                `mode` VARCHAR(20) NOT NULL DEFAULT 'manual',
                `recommendations` JSON NULL,
                `matched_rule_ids` JSON NULL,
                `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                UNIQUE KEY `uk_recommendation_results_response` (`response_id`),
                KEY `idx_recommendation_results_interaction` (`interaction_id`),
                CONSTRAINT `fk_recommendation_results_response` FOREIGN KEY (`response_id`) REFERENCES `responses` (`id`) ON DELETE CASCADE,
                CONSTRAINT `fk_recommendation_results_interaction` FOREIGN KEY (`interaction_id`) REFERENCES `interactions` (`id`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

            try {
                $check = $db->query("SHOW COLUMNS FROM `interactions` LIKE 'recommendation_enabled'")->fetch();
                if (!$check) {
                    $db->exec("ALTER TABLE `interactions` ADD COLUMN `recommendation_enabled` TINYINT(1) NOT NULL DEFAULT 0 AFTER `options`");
                }
            } catch (Throwable $e) {}
        }
    }

    /**
     * Format one rule row for API output
     */
    public static function formatRule(array $row): array {
        $conditions = $row['conditions'] ?? '[]';
        if (is_string($conditions)) {
            $conditions = json_decode($conditions, true) ?: [];
        }

        return [
            'id' => $row['id'],
            'interaction_id' => $row['interaction_id'],
            'target_question_id' => $row['target_question_id'],
            'target_question_title' => $row['target_question_title'] ?? null,
            'conditions' => is_array($conditions) ? array_values($conditions) : [],
            'recommended_choice' => $row['recommended_choice'],
            'priority' => (int)($row['priority'] ?? 0),
            'is_active' => (bool)($row['is_active'] ?? 1),
            'created_at' => !empty($row['created_at'])
                ? gmdate('Y-m-d\TH:i:s\Z', strtotime($row['created_at']))
                : null,
        ];
    }

    /**
     * Get all rules for an interaction, ordered by priority then creation time
     */
    public static function getRulesByInteraction(PDO $db, string $interactionId, bool $activeOnly = false): array {
        self::ensureTablesExist($db);

        $sql = "
            SELECT rr.*, vq.title AS target_question_title
            FROM recommendation_rules rr
            LEFT JOIN voting_questions vq ON vq.id = rr.target_question_id
            WHERE rr.interaction_id = :iid
        ";
        if ($activeOnly) {
            $sql .= " AND rr.is_active = 1";
        }
        $sql .= " ORDER BY rr.priority ASC, rr.created_at ASC";

        $stmt = $db->prepare($sql);
        $stmt->execute([':iid' => $interactionId]);

        return array_map([self::class, 'formatRule'], $stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
    }

    public static function findRuleById(PDO $db, string $id): ?array {
        self::ensureTablesExist($db);

        $stmt = $db->prepare("
            SELECT rr.*, vq.title AS target_question_title
            FROM recommendation_rules rr
            LEFT JOIN voting_questions vq ON vq.id = rr.target_question_id
            WHERE rr.id = :id
        ");
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ? self::formatRule($row) : null;
    }

    /**
     * Create a recommendation rule (kriteria IF-ELSE)
     */
    public static function createRule(PDO $db, string $interactionId, array $data): array {
        self::ensureTablesExist($db);

        $id = 'rr_' . bin2hex(random_bytes(4));
        $now = gmdate('Y-m-d H:i:s');
        $priority = isset($data['priority']) ? (int)$data['priority'] : 0;
        $isActive = isset($data['is_active']) ? (int)(bool)$data['is_active'] : 1;
        $conditionsJson = json_encode(array_values((array)($data['conditions'] ?? [])), JSON_UNESCAPED_UNICODE);

        $stmt = $db->prepare("
            INSERT INTO recommendation_rules (id, interaction_id, target_question_id, conditions, recommended_choice, priority, is_active, created_at)
            VALUES (:id, :iid, :target_qid, :conditions, :choice, :priority, :is_active, :created_at)
        ");
        $stmt->execute([
            ':id' => $id,
            ':iid' => $interactionId,
            ':target_qid' => trim((string)$data['target_question_id']),
            ':conditions' => $conditionsJson,
            ':choice' => trim((string)$data['recommended_choice']),
            ':priority' => $priority,
            ':is_active' => $isActive,
            ':created_at' => $now,
        ]);

        return self::findRuleById($db, $id);
    }

    /**
     * Update a recommendation rule
     */
    public static function updateRule(PDO $db, string $id, array $data): ?array {
        self::ensureTablesExist($db);

        $fields = [];
        $params = [':id' => $id];

        if (array_key_exists('target_question_id', $data)) {
            $fields[] = "target_question_id = :target_qid";
            $params[':target_qid'] = trim((string)$data['target_question_id']);
        }
        if (array_key_exists('conditions', $data)) {
            $fields[] = "conditions = :conditions";
            $params[':conditions'] = json_encode(array_values((array)$data['conditions']), JSON_UNESCAPED_UNICODE);
        }
        if (array_key_exists('recommended_choice', $data)) {
            $fields[] = "recommended_choice = :choice";
            $params[':choice'] = trim((string)$data['recommended_choice']);
        }
        if (array_key_exists('priority', $data)) {
            $fields[] = "priority = :priority";
            $params[':priority'] = (int)$data['priority'];
        }
        if (array_key_exists('is_active', $data)) {
            $fields[] = "is_active = :is_active";
            $params[':is_active'] = (int)(bool)$data['is_active'];
        }

        if (!empty($fields)) {
            $sql = "UPDATE recommendation_rules SET " . implode(', ', $fields) . " WHERE id = :id";
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
        }

        return self::findRuleById($db, $id);
    }

    public static function deleteRule(PDO $db, string $id): void {
        self::ensureTablesExist($db);
        $stmt = $db->prepare("DELETE FROM recommendation_rules WHERE id = :id");
        $stmt->execute([':id' => $id]);
    }

    /**
     * Normalize submitted answers into [question_id => choice] map.
     * Menerima format array of {question_id, choice} maupun map/role_key.
     */
    public static function normalizeAnswers(array $activeQuestions, array $submittedAnswers): array {
        $questionMap = [];
        foreach ($activeQuestions as $q) {
            $questionMap[$q['id']] = $q;
        }

        $normalized = [];
        if (isset($submittedAnswers[0]) && is_array($submittedAnswers[0])) {
            foreach ($submittedAnswers as $item) {
                if (!empty($item['question_id']) && !empty($item['choice'])) {
                    $normalized[trim((string)$item['question_id'])] = trim((string)$item['choice']);
                }
            }
        } else {
            foreach ($submittedAnswers as $key => $choice) {
                $trimmedKey = trim((string)$key);
                $trimmedChoice = trim((string)$choice);
                if (isset($questionMap[$trimmedKey])) {
                    $normalized[$trimmedKey] = $trimmedChoice;
                } else {
                    foreach ($activeQuestions as $q) {
                        if ($q['role_key'] === strtolower($trimmedKey)) {
                            $normalized[$q['id']] = $trimmedChoice;
                            break;
                        }
                    }
                }
            }
        }

        return $normalized;
    }

    /**
     * Cek satu kondisi IF terhadap jawaban yang dinormalisasi.
     * Kondisi gagal bila pertanyaan kriteria belum dijawab.
     */
    private static function matchCondition(array $cond, array $answers, array $questionsById): bool {
        $qid = trim((string)($cond['question_id'] ?? ''));
        if ($qid === '' || !isset($questionsById[$qid])) {
            return false;
        }

        if (!array_key_exists($qid, $answers) || $answers[$qid] === '') {
            return false;
        }

        $actual = (string)$answers[$qid];
        $op = strtolower(trim((string)($cond['operator'] ?? 'eq')));
        $expected = $cond['value'] ?? null;

        switch ($op) {
            case 'neq':
                return strcasecmp(trim($actual), trim((string)$expected)) !== 0;
            case 'contains':
                // mb_stripos bila tersedia, bila tidak pakai stripos
                // (PHP tanpa ekstensi mbstring).
                return (function_exists('mb_stripos') ? mb_stripos($actual, (string)$expected) : stripos($actual, (string)$expected)) !== false;
            case 'in':
                $list = is_array($expected) ? $expected : [$expected];
                foreach ($list as $candidate) {
                    if (strcasecmp(trim($actual), trim((string)$candidate)) === 0) {
                        return true;
                    }
                }
                return false;
            case 'eq':
            default:
                return strcasecmp(trim($actual), trim((string)$expected)) === 0;
        }
    }

    /**
     * Evaluasi seluruh aturan IF-ELSE terhadap jawaban pengisi.
     * Aturan diproses berdasarkan priority terkecil lebih dulu; aturan pertama
     * yang cocok untuk sebuah pertanyaan target menang.
     *
     * Return null bila tidak ada aturan yang menyasar pertanyaan aktif,
     * selain itu array:
     *   recommendations  => [question_id => pilihan kandidat]
     *   matched_rule_ids => [id aturan yang cocok]
     *   missing_targets  => [question_id target yang belum punya aturan cocok]
     *   answers          => jawaban ternormalisasi (format map question_id => choice)
     */
    public static function evaluate(array $rules, array $activeQuestions, array $submittedAnswers): ?array {
        if (empty($rules) || empty($activeQuestions)) {
            return null;
        }

        $questionsById = [];
        foreach ($activeQuestions as $q) {
            $questionsById[$q['id']] = $q;
        }

        // Kumpulkan pertanyaan target yang masih aktif
        $targets = [];
        foreach ($rules as $rule) {
            $tid = $rule['target_question_id'] ?? null;
            if ($tid && isset($questionsById[$tid])) {
                $targets[$tid] = true;
            }
        }
        if (empty($targets)) {
            return null;
        }

        $answers = self::normalizeAnswers($activeQuestions, $submittedAnswers);
        $decisions = [];
        $matchedRuleIds = [];

        foreach ($rules as $rule) {
            $tid = $rule['target_question_id'] ?? null;
            if (!$tid || !isset($targets[$tid]) || isset($decisions[$tid])) {
                continue;
            }
            if (empty($rule['is_active'])) {
                continue;
            }

            // Seluruh kondisi IF harus terpenuhi (AND)
            $conditions = is_array($rule['conditions'] ?? null) ? $rule['conditions'] : [];
            $allMatch = true;
            foreach ($conditions as $cond) {
                if (!self::matchCondition((array)$cond, $answers, $questionsById)) {
                    $allMatch = false;
                    break;
                }
            }
            if (!$allMatch) {
                continue;
            }

            // Kandidat rekomendasi harus valid terhadap opsi pertanyaan target
            $choice = trim((string)($rule['recommended_choice'] ?? ''));
            $targetOptions = $questionsById[$tid]['options'] ?? [];
            if ($choice === '' || !in_array($choice, $targetOptions, true)) {
                continue;
            }

            $decisions[$tid] = $choice;
            $matchedRuleIds[] = $rule['id'];
        }

        $missing = array_values(array_diff(array_keys($targets), array_keys($decisions)));

        return [
            'recommendations' => $decisions,
            'matched_rule_ids' => $matchedRuleIds,
            'missing_targets' => $missing,
            'answers' => $answers,
        ];
    }

    /**
     * Gabungkan jawaban ternormalisasi dengan hasil rekomendasi
     * (rekomendasi menimpa jawaban target apa pun yang ikut terkirim).
     */
    public static function mergeRecommendations(array $answers, array $recommendations): array {
        return array_merge($answers, $recommendations);
    }

    /**
     * Simpan hasil rekomendasi / keputusan mode per pengisian
     */
    public static function saveResult(PDO $db, string $responseId, string $interactionId, string $mode, ?array $recommendations = null, array $matchedRuleIds = []): void {
        self::ensureTablesExist($db);

        $id = 'rrs_' . bin2hex(random_bytes(4));
        $now = gmdate('Y-m-d H:i:s');

        $stmt = $db->prepare("
            INSERT INTO recommendation_results (id, response_id, interaction_id, mode, recommendations, matched_rule_ids, created_at)
            VALUES (:id, :response_id, :iid, :mode, :recs, :rules, :created_at)
        ");
        $stmt->execute([
            ':id' => $id,
            ':response_id' => $responseId,
            ':iid' => $interactionId,
            ':mode' => $mode === self::MODE_RECOMMENDATION ? self::MODE_RECOMMENDATION : self::MODE_MANUAL,
            ':recs' => $recommendations !== null ? json_encode($recommendations, JSON_UNESCAPED_UNICODE) : null,
            ':rules' => !empty($matchedRuleIds) ? json_encode(array_values($matchedRuleIds), JSON_UNESCAPED_UNICODE) : null,
            ':created_at' => $now,
        ]);
    }

    /**
     * Format one result row for API output
     */
    public static function formatResult(array $row): array {
        $recommendations = $row['recommendations'] ?? null;
        if (is_string($recommendations)) {
            $recommendations = json_decode($recommendations, true);
        }
        $matchedRuleIds = $row['matched_rule_ids'] ?? null;
        if (is_string($matchedRuleIds)) {
            $matchedRuleIds = json_decode($matchedRuleIds, true);
        }

        return [
            'id' => $row['id'],
            'response_id' => $row['response_id'],
            'interaction_id' => $row['interaction_id'],
            'mode' => $row['mode'] ?? self::MODE_MANUAL,
            'recommendations' => is_array($recommendations) ? $recommendations : null,
            'matched_rule_ids' => is_array($matchedRuleIds) ? array_values($matchedRuleIds) : [],
            'created_at' => !empty($row['created_at'])
                ? gmdate('Y-m-d\TH:i:s\Z', strtotime($row['created_at']))
                : null,
        ];
    }

    /**
     * Get recommendation results for an interaction (untuk panel pemilik link)
     */
    public static function getResultsByInteraction(PDO $db, string $interactionId): array {
        self::ensureTablesExist($db);

        $stmt = $db->prepare("
            SELECT rr.*,
                   r.choice AS resp_choice, r.message AS resp_message, r.status AS resp_status,
                   r.reply AS resp_reply, r.shared AS resp_shared,
                   COALESCE(r.is_anonymous, ri.is_anonymous, 0) AS resp_is_anonymous,
                   ri.name AS identity_name, r.created_at AS responded_at
            FROM recommendation_results rr
            LEFT JOIN responses r ON r.id = rr.response_id
            LEFT JOIN response_identities ri ON ri.response_id = rr.response_id
            WHERE rr.interaction_id = :iid
            ORDER BY rr.created_at DESC
        ");
        $stmt->execute([':iid' => $interactionId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }
}
