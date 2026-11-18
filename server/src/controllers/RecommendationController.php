<?php
/**
 * Recommendation Controller
 * Mengelola aturan IF-ELSE rekomendasi voting dan melihat hasil rekomendasi.
 * Dibatasi untuk pembuat link interaksi atau Administrator.
 */

declare(strict_types=1);

require_once __DIR__ . '/../models/Interaction.php';
require_once __DIR__ . '/../models/VotingQuestion.php';
require_once __DIR__ . '/../models/Recommendation.php';
require_once __DIR__ . '/../models/Response.php';
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../middlewares/AuthMiddleware.php';
require_once __DIR__ . '/../config/database.php';

class RecommendationController {
    /**
     * Helper verifikasi kepemilikan interaksi (sama seperti QuestionController)
     */
    private static function checkOwnership(PDO $db, string $interactionId, array $currentUser): array {
        $interaction = Interaction::findById($db, $interactionId);
        if (!$interaction) {
            ApiResponse::error("Interaksi tidak ditemukan.", 404);
        }

        if ($currentUser['role'] !== 'Administrator' && $interaction['owner_id'] !== $currentUser['id']) {
            ApiResponse::error("Akses ditolak. Anda bukan pembuat link voting ini.", 403);
        }

        return $interaction;
    }

    /**
     * Validasi struktur satu aturan IF-ELSE.
     * Return array error message atau null bila valid.
     */
    private static function validateRuleInput(array $input, array $interaction, array $questionsById): ?string {
        $targetId = trim((string)($input['target_question_id'] ?? ''));
        if ($targetId === '' || !isset($questionsById[$targetId])) {
            return "target_question_id wajib diisi dan harus berupa pertanyaan voting aktif pada interaksi ini.";
        }

        $choice = trim((string)($input['recommended_choice'] ?? ''));
        if ($choice === '') {
            return "recommended_choice (kandidat hasil rekomendasi) wajib diisi.";
        }
        $targetOptions = $questionsById[$targetId]['options'] ?? [];
        if (!in_array($choice, $targetOptions, true)) {
            return "Kandidat '{$choice}' tidak ada pada opsi pertanyaan target.";
        }

        $conditions = $input['conditions'] ?? [];
        if (!is_array($conditions)) {
            return "conditions harus berupa array aturan IF.";
        }
        foreach ($conditions as $i => $cond) {
            $cond = (array)$cond;
            $qid = trim((string)($cond['question_id'] ?? ''));
            if ($qid === '' || !isset($questionsById[$qid])) {
                return "Kondisi #" . ($i + 1) . ": question_id tidak valid atau bukan pertanyaan interaksi ini.";
            }
            if ($qid === $targetId) {
                return "Kondisi #" . ($i + 1) . ": pertanyaan kriteria tidak boleh sama dengan pertanyaan target.";
            }
            $op = strtolower(trim((string)($cond['operator'] ?? 'eq')));
            if (!in_array($op, Recommendation::OPERATORS, true)) {
                return "Kondisi #" . ($i + 1) . ": operator '{$op}' tidak didukung. Gunakan: " . implode(', ', Recommendation::OPERATORS) . ".";
            }
            if (!array_key_exists('value', $cond) || $cond['value'] === null || $cond['value'] === '') {
                return "Kondisi #" . ($i + 1) . ": value wajib diisi.";
            }
        }

        return null;
    }

    /**
     * GET /interactions/{id}/recommendation/rules
     * Daftar aturan IF-ELSE milik interaksi.
     */
    public static function listRules(string $interactionId): void {
        $currentUser = AuthMiddleware::authenticate();
        $db = Database::getConnection();

        self::checkOwnership($db, $interactionId, $currentUser);
        Recommendation::ensureTablesExist($db);

        $rules = Recommendation::getRulesByInteraction($db, $interactionId, false);
        ApiResponse::json($rules, 200);
    }

    /**
     * POST /interactions/{id}/recommendation/rules
     * Tambah aturan rekomendasi baru.
     */
    public static function createRule(string $interactionId): void {
        $currentUser = AuthMiddleware::authenticate();
        $db = Database::getConnection();

        $interaction = self::checkOwnership($db, $interactionId, $currentUser);

        if ($interaction['kind'] !== 'vote') {
            ApiResponse::error("Aturan rekomendasi hanya dapat dibuat untuk interaksi jenis 'vote'.", 400);
        }

        $input = json_decode(file_get_contents('php://input'), true) ?: [];

        $questions = VotingQuestion::getByInteraction($db, $interactionId, true);
        $questionsById = [];
        foreach ($questions as $q) {
            $questionsById[$q['id']] = $q;
        }
        if (empty($questionsById)) {
            ApiResponse::error("Interaksi ini belum memiliki pertanyaan voting aktif.", 422);
        }

        $error = self::validateRuleInput($input, $interaction, $questionsById);
        if ($error !== null) {
            ApiResponse::error($error, 422);
        }

        $rule = Recommendation::createRule($db, $interactionId, $input);
        ApiResponse::json($rule, 201);
    }

    /**
     * PATCH /interactions/{id}/recommendation/rules/{rid}
     */
    public static function updateRule(string $interactionId, string $ruleId): void {
        $currentUser = AuthMiddleware::authenticate();
        $db = Database::getConnection();

        $interaction = self::checkOwnership($db, $interactionId, $currentUser);

        $rule = Recommendation::findRuleById($db, $ruleId);
        if (!$rule || $rule['interaction_id'] !== $interactionId) {
            ApiResponse::error("Aturan rekomendasi tidak ditemukan.", 404);
        }

        $input = json_decode(file_get_contents('php://input'), true) ?: [];

        // Bila target/kondisi/kandidat diubah, validasi ulang terhadap state gabungan
        $questions = VotingQuestion::getByInteraction($db, $interactionId, true);
        $questionsById = [];
        foreach ($questions as $q) {
            $questionsById[$q['id']] = $q;
        }

        $merged = array_merge($rule, $input);
        $error = self::validateRuleInput($merged, $interaction, $questionsById);
        if ($error !== null) {
            ApiResponse::error($error, 422);
        }

        $updated = Recommendation::updateRule($db, $ruleId, $input);
        ApiResponse::json($updated, 200);
    }

    /**
     * DELETE /interactions/{id}/recommendation/rules/{rid}
     */
    public static function deleteRule(string $interactionId, string $ruleId): void {
        $currentUser = AuthMiddleware::authenticate();
        $db = Database::getConnection();

        self::checkOwnership($db, $interactionId, $currentUser);

        $rule = Recommendation::findRuleById($db, $ruleId);
        if (!$rule || $rule['interaction_id'] !== $interactionId) {
            ApiResponse::error("Aturan rekomendasi tidak ditemukan.", 404);
        }

        Recommendation::deleteRule($db, $ruleId);
        ApiResponse::noContent();
    }

    /**
     * GET /interactions/{id}/recommendation/results
     * Hasil rekomendasi per pengisian (mode recommendation/manual),
     * dengan tanggapan difilter sesuai hak akses privasi.
     */
    public static function listResults(string $interactionId): void {
        $currentUser = AuthMiddleware::authenticate();
        $db = Database::getConnection();

        $interaction = self::checkOwnership($db, $interactionId, $currentUser);

        $rows = Recommendation::getResultsByInteraction($db, $interactionId);

        $results = array_map(function ($row) use ($currentUser, $interaction) {
            $result = Recommendation::formatResult($row);

            // Sertakan ringkasan tanggapan dengan filter privasi yang sama
            // seperti daftar responses biasa.
            $responseRow = [
                'id' => $row['response_id'],
                'interaction_id' => $row['interaction_id'],
                'name' => $row['identity_name'] ?? null,
                'choice' => $row['resp_choice'] ?? null,
                'message' => $row['resp_message'] ?? null,
                'status' => $row['resp_status'] ?? 'Baru',
                'reply' => $row['resp_reply'] ?? null,
                'shared' => $row['resp_shared'] ?? 0,
                'is_anonymous' => $row['resp_is_anonymous'] ?? 0,
                'created_at' => $row['responded_at'] ?? null,
            ];
            $result['response'] = ResponseModel::formatWithPrivacy($responseRow, $currentUser, $interaction);

            return $result;
        }, $rows);

        ApiResponse::json($results, 200);
    }
}
