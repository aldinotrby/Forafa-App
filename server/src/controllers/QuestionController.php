<?php
/**
 * Question Controller
 * Handles CRUD and configuration for branching voting questions under an interaction.
 * Enforces creator access control, question sequencing, role assignments, and active/inactive states.
 */

declare(strict_types=1);

require_once __DIR__ . '/../models/Interaction.php';
require_once __DIR__ . '/../models/VotingQuestion.php';
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../middlewares/AuthMiddleware.php';
require_once __DIR__ . '/../config/database.php';

class QuestionController {
    /**
     * Helper to verify interaction ownership
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
     * GET /interactions/{id}/questions
     * Returns all questions for an interaction, ordered by sort_order ASC
     */
    public static function list(string $interactionId): void {
        $currentUser = AuthMiddleware::authenticate();
        $db = Database::getConnection();

        self::checkOwnership($db, $interactionId, $currentUser);

        $questions = VotingQuestion::getByInteraction($db, $interactionId, false);
        ApiResponse::json($questions, 200);
    }

    /**
     * POST /interactions/{id}/questions
     * Add a new question linked to this voting interaction
     */
    public static function create(string $interactionId): void {
        $currentUser = AuthMiddleware::authenticate();
        $db = Database::getConnection();

        $interaction = self::checkOwnership($db, $interactionId, $currentUser);

        if ($interaction['kind'] !== 'vote') {
            ApiResponse::error("Pertanyaan bertingkat/percabangan hanya dapat ditambahkan pada interaksi jenis 'vote'.", 400);
        }

        $input = json_decode(file_get_contents('php://input'), true) ?: [];

        $title = trim($input['title'] ?? '');
        if (empty($title)) {
            ApiResponse::error("Judul pertanyaan wajib diisi.", 422);
        }

        $options = $input['options'] ?? [];
        if (empty($options) || !is_array($options)) {
            ApiResponse::error("Daftar opsi pilihan kandidat wajib berupa array dan tidak boleh kosong.", 422);
        }

        $question = VotingQuestion::create($db, $interactionId, $input);
        ApiResponse::json($question, 201);
    }

    /**
     * GET /interactions/{id}/questions/{qid}
     */
    public static function getDetail(string $interactionId, string $questionId): void {
        $currentUser = AuthMiddleware::authenticate();
        $db = Database::getConnection();

        self::checkOwnership($db, $interactionId, $currentUser);

        $question = VotingQuestion::findById($db, $questionId);
        if (!$question || $question['interaction_id'] !== $interactionId) {
            ApiResponse::error("Pertanyaan voting tidak ditemukan.", 404);
        }

        ApiResponse::json($question, 200);
    }

    /**
     * PATCH /interactions/{id}/questions/{qid}
     * Update question, including title, role_key (ketua/wakil/sekretaris/bendahara),
     * sort_order (urutan), is_active (kondisi aktif/nonaktif), and dependencies.
     */
    public static function update(string $interactionId, string $questionId): void {
        $currentUser = AuthMiddleware::authenticate();
        $db = Database::getConnection();

        self::checkOwnership($db, $interactionId, $currentUser);

        $question = VotingQuestion::findById($db, $questionId);
        if (!$question || $question['interaction_id'] !== $interactionId) {
            ApiResponse::error("Pertanyaan voting tidak ditemukan.", 404);
        }

        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $updated = VotingQuestion::update($db, $questionId, $input);

        ApiResponse::json($updated, 200);
    }

    /**
     * DELETE /interactions/{id}/questions/{qid}
     */
    public static function delete(string $interactionId, string $questionId): void {
        $currentUser = AuthMiddleware::authenticate();
        $db = Database::getConnection();

        self::checkOwnership($db, $interactionId, $currentUser);

        $question = VotingQuestion::findById($db, $questionId);
        if (!$question || $question['interaction_id'] !== $interactionId) {
            ApiResponse::error("Pertanyaan voting tidak ditemukan.", 404);
        }

        VotingQuestion::delete($db, $questionId);
        ApiResponse::noContent();
    }

    /**
     * POST /interactions/{id}/questions/reorder
     * Bulk reorder questions by providing an array of question IDs
     */
    public static function reorder(string $interactionId): void {
        $currentUser = AuthMiddleware::authenticate();
        $db = Database::getConnection();

        self::checkOwnership($db, $interactionId, $currentUser);

        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $order = $input['order'] ?? [];

        if (!is_array($order) || empty($order)) {
            ApiResponse::error("Format parameter 'order' harus berupa array ID pertanyaan.", 422);
        }

        VotingQuestion::reorder($db, $interactionId, $order);

        $reorderedList = VotingQuestion::getByInteraction($db, $interactionId, false);
        ApiResponse::json($reorderedList, 200);
    }
}

