<?php
/**
 * VotingQuestion Model
 * Manages multi-question voting branching, organizational roles (ketua, wakil, sekretaris, bendahara),
 * question sequencing (ordering), activation status, and vote conflict validation.
 */

declare(strict_types=1);

class VotingQuestion {
    /**
     * Standard leadership roles and position hierarchy
     */
    public const ROLE_KETUA = 'ketua';
    public const ROLE_WAKIL = 'wakil';
    public const ROLE_SEKRETARIS = 'sekretaris';
    public const ROLE_BENDAHARA = 'bendahara';
    public const ROLE_CUSTOM = 'custom';

    public static function getKnownRoles(): array {
        return [
            self::ROLE_KETUA => 'Ketua',
            self::ROLE_WAKIL => 'Wakil Ketua',
            self::ROLE_SEKRETARIS => 'Sekretaris',
            self::ROLE_BENDAHARA => 'Bendahara',
            self::ROLE_CUSTOM => 'Posisi Lainnya',
        ];
    }

    /**
     * Ensure voting_questions and voting_answers tables exist in database
     */
    public static function ensureTablesExist(PDO $db): void {
        $driver = $db->getAttribute(PDO::ATTR_DRIVER_NAME);

        if ($driver === 'sqlite') {
            $db->exec("CREATE TABLE IF NOT EXISTS voting_questions (
                id VARCHAR(50) PRIMARY KEY,
                interaction_id VARCHAR(50) NOT NULL,
                role_key VARCHAR(50) NOT NULL DEFAULT 'custom',
                title VARCHAR(255) NOT NULL,
                description TEXT NULL,
                options TEXT NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 1,
                is_active INTEGER NOT NULL DEFAULT 1,
                depends_on_question_id VARCHAR(50) NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (interaction_id) REFERENCES interactions(id) ON DELETE CASCADE,
                FOREIGN KEY (depends_on_question_id) REFERENCES voting_questions(id) ON DELETE SET NULL
            )");

            $db->exec("CREATE TABLE IF NOT EXISTS voting_answers (
                id VARCHAR(50) PRIMARY KEY,
                response_id VARCHAR(50) NOT NULL,
                question_id VARCHAR(50) NOT NULL,
                role_key VARCHAR(50) NOT NULL,
                choice VARCHAR(255) NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (response_id) REFERENCES responses(id) ON DELETE CASCADE,
                FOREIGN KEY (question_id) REFERENCES voting_questions(id) ON DELETE CASCADE
            )");
        } else {
            $db->exec("CREATE TABLE IF NOT EXISTS `voting_questions` (
                `id` VARCHAR(50) NOT NULL,
                `interaction_id` VARCHAR(50) NOT NULL,
                `role_key` VARCHAR(50) NOT NULL DEFAULT 'custom',
                `title` VARCHAR(255) NOT NULL,
                `description` TEXT NULL,
                `options` JSON NOT NULL,
                `sort_order` INT NOT NULL DEFAULT 1,
                `is_active` TINYINT(1) NOT NULL DEFAULT 1,
                `depends_on_question_id` VARCHAR(50) NULL,
                `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                KEY `idx_voting_questions_interaction` (`interaction_id`),
                KEY `idx_voting_questions_sort_order` (`sort_order`),
                KEY `idx_voting_questions_is_active` (`is_active`),
                CONSTRAINT `fk_voting_questions_interaction` FOREIGN KEY (`interaction_id`) REFERENCES `interactions` (`id`) ON DELETE CASCADE,
                CONSTRAINT `fk_voting_questions_depends` FOREIGN KEY (`depends_on_question_id`) REFERENCES `voting_questions` (`id`) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

            $db->exec("CREATE TABLE IF NOT EXISTS `voting_answers` (
                `id` VARCHAR(50) NOT NULL,
                `response_id` VARCHAR(50) NOT NULL,
                `question_id` VARCHAR(50) NOT NULL,
                `role_key` VARCHAR(50) NOT NULL,
                `choice` VARCHAR(255) NOT NULL,
                `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                KEY `idx_voting_answers_response` (`response_id`),
                KEY `idx_voting_answers_question` (`question_id`),
                CONSTRAINT `fk_voting_answers_response` FOREIGN KEY (`response_id`) REFERENCES `responses` (`id`) ON DELETE CASCADE,
                CONSTRAINT `fk_voting_answers_question` FOREIGN KEY (`question_id`) REFERENCES `voting_questions` (`id`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        }
    }

    /**
     * Format a question row for API responses
     */
    public static function format(array $row): array {
        $opts = $row['options'] ?? '[]';
        if (is_string($opts)) {
            $opts = json_decode($opts, true) ?: [];
        }

        $roles = self::getKnownRoles();
        $roleKey = strtolower($row['role_key'] ?? 'custom');
        $roleLabel = $roles[$roleKey] ?? ucfirst($roleKey);

        return [
            'id' => $row['id'],
            'interaction_id' => $row['interaction_id'],
            'role_key' => $roleKey,
            'role_label' => $roleLabel,
            'title' => $row['title'],
            'description' => $row['description'] ?? '',
            'options' => is_array($opts) ? array_values($opts) : [],
            'sort_order' => (int)($row['sort_order'] ?? 1),
            'is_active' => (bool)($row['is_active'] ?? 1),
            'depends_on_question_id' => $row['depends_on_question_id'] ?? null,
            'created_at' => !empty($row['created_at'])
                ? gmdate('Y-m-d\TH:i:s\Z', strtotime($row['created_at']))
                : null,
        ];
    }

    /**
     * Get all questions for an interaction, ordered by sort_order ASC
     */
    public static function getByInteraction(PDO $db, string $interactionId, bool $activeOnly = false): array {
        self::ensureTablesExist($db);

        $sql = "SELECT * FROM voting_questions WHERE interaction_id = :interaction_id";
        if ($activeOnly) {
            $sql .= " AND is_active = 1";
        }
        $sql .= " ORDER BY sort_order ASC, created_at ASC";

        $stmt = $db->prepare($sql);
        $stmt->execute([':interaction_id' => $interactionId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_map([self::class, 'format'], $rows);
    }

    public static function findById(PDO $db, string $id): ?array {
        self::ensureTablesExist($db);

        $stmt = $db->prepare("SELECT * FROM voting_questions WHERE id = :id");
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ? self::format($row) : null;
    }

    /**
     * Create a new question linked to an interaction
     */
    public static function create(PDO $db, string $interactionId, array $data): array {
        self::ensureTablesExist($db);

        $id = 'vq_' . bin2hex(random_bytes(4));
        $title = trim($data['title'] ?? '');
        $roleKey = strtolower(trim($data['role_key'] ?? self::ROLE_CUSTOM));
        $description = trim($data['description'] ?? '');
        $options = $data['options'] ?? [];
        if (is_string($options)) {
            $options = json_decode($options, true) ?: [];
        }
        $optionsJson = json_encode(array_values((array)$options), JSON_UNESCAPED_UNICODE);

        // Calculate next sort_order if not provided
        if (isset($data['sort_order'])) {
            $sortOrder = (int)$data['sort_order'];
        } else {
            $stmtOrder = $db->prepare("SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM voting_questions WHERE interaction_id = :iid");
            $stmtOrder->execute([':iid' => $interactionId]);
            $sortOrder = (int)($stmtOrder->fetch()['next_order'] ?? 1);
        }

        $isActive = isset($data['is_active']) ? (int)(bool)$data['is_active'] : 1;
        $dependsOn = !empty($data['depends_on_question_id']) ? trim($data['depends_on_question_id']) : null;
        $now = gmdate('Y-m-d H:i:s');

        $stmt = $db->prepare("
            INSERT INTO voting_questions (id, interaction_id, role_key, title, description, options, sort_order, is_active, depends_on_question_id, created_at)
            VALUES (:id, :interaction_id, :role_key, :title, :description, :options, :sort_order, :is_active, :depends_on, :created_at)
        ");

        $stmt->execute([
            ':id' => $id,
            ':interaction_id' => $interactionId,
            ':role_key' => $roleKey,
            ':title' => $title,
            ':description' => $description,
            ':options' => $optionsJson,
            ':sort_order' => $sortOrder,
            ':is_active' => $isActive,
            ':depends_on' => $dependsOn,
            ':created_at' => $now,
        ]);

        return self::format([
            'id' => $id,
            'interaction_id' => $interactionId,
            'role_key' => $roleKey,
            'title' => $title,
            'description' => $description,
            'options' => $options,
            'sort_order' => $sortOrder,
            'is_active' => $isActive,
            'depends_on_question_id' => $dependsOn,
            'created_at' => $now,
        ]);
    }

    /**
     * Update an existing question
     */
    public static function update(PDO $db, string $id, array $data): ?array {
        self::ensureTablesExist($db);

        $fields = [];
        $params = [':id' => $id];

        if (array_key_exists('title', $data)) {
            $fields[] = "title = :title";
            $params[':title'] = trim((string)$data['title']);
        }
        if (array_key_exists('role_key', $data)) {
            $fields[] = "role_key = :role_key";
            $params[':role_key'] = strtolower(trim((string)$data['role_key']));
        }
        if (array_key_exists('description', $data)) {
            $fields[] = "description = :description";
            $params[':description'] = trim((string)$data['description']);
        }
        if (array_key_exists('options', $data)) {
            $opts = $data['options'];
            if (is_string($opts)) {
                $opts = json_decode($opts, true) ?: [];
            }
            $fields[] = "options = :options";
            $params[':options'] = json_encode(array_values((array)$opts), JSON_UNESCAPED_UNICODE);
        }
        if (array_key_exists('sort_order', $data)) {
            $fields[] = "sort_order = :sort_order";
            $params[':sort_order'] = (int)$data['sort_order'];
        }
        if (array_key_exists('is_active', $data)) {
            $fields[] = "is_active = :is_active";
            $params[':is_active'] = (int)(bool)$data['is_active'];
        }
        if (array_key_exists('depends_on_question_id', $data)) {
            $fields[] = "depends_on_question_id = :depends_on";
            $val = !empty($data['depends_on_question_id']) ? trim((string)$data['depends_on_question_id']) : null;
            $params[':depends_on'] = $val;
        }

        if (!empty($fields)) {
            $sql = "UPDATE voting_questions SET " . implode(', ', $fields) . " WHERE id = :id";
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
        }

        return self::findById($db, $id);
    }

    /**
     * Delete a question
     */
    public static function delete(PDO $db, string $id): void {
        self::ensureTablesExist($db);
        $stmt = $db->prepare("DELETE FROM voting_questions WHERE id = :id");
        $stmt->execute([':id' => $id]);
    }

    /**
     * Batch reorder questions by array of question IDs
     */
    public static function reorder(PDO $db, string $interactionId, array $orderedIds): void {
        self::ensureTablesExist($db);

        $stmt = $db->prepare("UPDATE voting_questions SET sort_order = :order WHERE id = :id AND interaction_id = :iid");
        $order = 1;
        foreach ($orderedIds as $id) {
            $stmt->execute([
                ':order' => $order++,
                ':id' => $id,
                ':iid' => $interactionId,
            ]);
        }
    }

    /**
     * VALIDATION ENGINE:
     * Validates that answers for branching questions do not conflict with each other:
     * 1. Mutual Exclusivity: The exact same candidate cannot be selected for multiple distinct positions
     *    (e.g., someone cannot simultaneously be voted as Ketua and Wakil Ketua).
     * 2. Validity: The chosen candidate must exist in the question's available options.
     * 3. Completeness: All currently active questions must be answered.
     * 4. Inactivity: Inactive questions (is_active = 0) must not be answered.
     *
     * Returns: null if valid, or a descriptive error string if conflicts/invalid choices are found.
     */
    public static function validateAnswers(array $activeQuestions, array $submittedAnswers): ?string {
        if (empty($activeQuestions)) {
            return null;
        }

        // Map active questions by ID and by role_key
        $questionMap = [];
        $activeQuestionIds = [];
        foreach ($activeQuestions as $q) {
            $questionMap[$q['id']] = $q;
            $activeQuestionIds[$q['id']] = true;
        }

        // Normalize submitted answers into a standard array of [question_id => choice]
        $normalizedAnswers = [];
        if (isset($submittedAnswers[0]) && is_array($submittedAnswers[0])) {
            // Format: [{"question_id": "...", "choice": "..."}, ...]
            foreach ($submittedAnswers as $item) {
                if (!empty($item['question_id']) && !empty($item['choice'])) {
                    $normalizedAnswers[trim((string)$item['question_id'])] = trim((string)$item['choice']);
                }
            }
        } else {
            // Format: ["vq_1" => "Choice A", ...] or by role_key ["ketua" => "Pak Suryo"]
            foreach ($submittedAnswers as $key => $choice) {
                $trimmedKey = trim((string)$key);
                $trimmedChoice = trim((string)$choice);
                if (isset($questionMap[$trimmedKey])) {
                    $normalizedAnswers[$trimmedKey] = $trimmedChoice;
                } else {
                    // Search by role_key if key was 'ketua', 'wakil', etc.
                    foreach ($activeQuestions as $q) {
                        if ($q['role_key'] === strtolower($trimmedKey)) {
                            $normalizedAnswers[$q['id']] = $trimmedChoice;
                            break;
                        }
                    }
                }
            }
        }

        // Check 1: Ensure all active questions have been answered
        foreach ($activeQuestions as $q) {
            if (empty($normalizedAnswers[$q['id']])) {
                return "Pertanyaan '{$q['title']}' ({$q['role_label']}) wajib dijawab.";
            }
        }

        // Check 2: Check for invalid choices not in allowed options
        foreach ($normalizedAnswers as $qid => $choice) {
            if (!isset($questionMap[$qid])) {
                return "Pertanyaan ID '{$qid}' tidak ditemukan atau sedang tidak aktif.";
            }

            $q = $questionMap[$qid];
            if (!in_array($choice, $q['options'], true)) {
                return "Pilihan '{$choice}' tidak valid untuk pertanyaan '{$q['title']}'. Pilihan yang tersedia: " . implode(', ', $q['options']);
            }
        }

        // Check 3: MUTUAL EXCLUSIVITY / CONFLICT DETECTION
        // A single candidate cannot be elected into multiple conflicting positions
        // (e.g. Ketua and Wakil Ketua, or Sekretaris and Bendahara).
        $chosenCandidates = []; // [ candidate_name => [ 'title' => ..., 'role' => ... ] ]

        foreach ($normalizedAnswers as $qid => $candidate) {
            $q = $questionMap[$qid];

            if (isset($chosenCandidates[$candidate])) {
                $prev = $chosenCandidates[$candidate];
                return "Pilihan bertentangan: Kandidat '{$candidate}' tidak dapat dipilih pada lebih dari satu posisi kepengurusan ({$prev['title']} dan {$q['title']}).";
            }

            $chosenCandidates[$candidate] = [
                'title' => $q['title'],
                'role' => $q['role_label'],
                'role_key' => $q['role_key'],
            ];
        }

        return null; // Valid! No conflicts found.
    }

    /**
     * Record granular answers for each question under a response
     */
    public static function saveAnswers(PDO $db, string $responseId, array $activeQuestions, array $submittedAnswers): array {
        self::ensureTablesExist($db);

        $questionMap = [];
        foreach ($activeQuestions as $q) {
            $questionMap[$q['id']] = $q;
        }

        // Normalize
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

        $saved = [];
        $stmt = $db->prepare("
            INSERT INTO voting_answers (id, response_id, question_id, role_key, choice, created_at)
            VALUES (:id, :response_id, :question_id, :role_key, :choice, :created_at)
        ");

        $now = gmdate('Y-m-d H:i:s');
        foreach ($normalized as $qid => $choice) {
            $q = $questionMap[$qid] ?? null;
            if (!$q) continue;

            $ansId = 'va_' . bin2hex(random_bytes(4));
            $stmt->execute([
                ':id' => $ansId,
                ':response_id' => $responseId,
                ':question_id' => $qid,
                ':role_key' => $q['role_key'],
                ':choice' => $choice,
                ':created_at' => $now,
            ]);

            $saved[] = [
                'id' => $ansId,
                'question_id' => $qid,
                'role_key' => $q['role_key'],
                'role_label' => $q['role_label'],
                'question_title' => $q['title'],
                'choice' => $choice,
            ];
        }

        return $saved;
    }

    /**
     * Get saved answers for a response
     */
    public static function getAnswersByResponse(PDO $db, string $responseId): array {
        self::ensureTablesExist($db);

        $stmt = $db->prepare("
            SELECT va.*, vq.title AS question_title
            FROM voting_answers va
            LEFT JOIN voting_questions vq ON vq.id = va.question_id
            WHERE va.response_id = :response_id
            ORDER BY va.created_at ASC
        ");
        $stmt->execute([':response_id' => $responseId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $roles = self::getKnownRoles();
        return array_map(function($r) use ($roles) {
            return [
                'id' => $r['id'],
                'question_id' => $r['question_id'],
                'role_key' => $r['role_key'],
                'role_label' => $roles[$r['role_key']] ?? ucfirst($r['role_key']),
                'question_title' => $r['question_title'] ?? 'Pertanyaan',
                'choice' => $r['choice'],
            ];
        }, $rows);
    }
}

