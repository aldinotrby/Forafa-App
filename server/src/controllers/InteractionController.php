<?php
/**
 * Interaction Controller (Voting, Feedback, Anonymous Messages)
 * Enforces creator access control and privacy policies.
 */

declare(strict_types=1);

require_once __DIR__ . '/../models/Interaction.php';
require_once __DIR__ . '/../models/Response.php';
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../middlewares/AuthMiddleware.php';
require_once __DIR__ . '/../config/database.php';

class InteractionController {
    /**
     * GET /interactions
     * Lists interactions owned by the user (or all if Administrator)
     */
    public static function list(): void {
        $currentUser = AuthMiddleware::authenticate();

        $kind = !empty($_GET['kind']) ? trim($_GET['kind']) : null;
        $ownerId = !empty($_GET['owner_id']) ? trim($_GET['owner_id']) : null;
        $search = !empty($_GET['search']) ? trim($_GET['search']) : (!empty($_GET['q']) ? trim($_GET['q']) : null);
        $active = isset($_GET['active']) ? (int)(bool)$_GET['active'] : null;
        $skip = max(0, (int)($_GET['skip'] ?? 0));
        $limit = max(1, min(500, (int)($_GET['limit'] ?? 100)));

        $db = Database::getConnection();

        $sql = "SELECT * FROM interactions WHERE 1=1";
        $params = [];

        // Hak akses: Pembuat link hanya melihat miliknya sendiri, Admin dapat melihat semua/filter
        if ($currentUser['role'] === 'Administrator') {
            if ($ownerId !== null) {
                $sql .= " AND owner_id = :owner_id";
                $params[':owner_id'] = $ownerId;
            }
        } else {
            $sql .= " AND owner_id = :owner_id";
            $params[':owner_id'] = $currentUser['id'];
        }

        if ($kind !== null) {
            $sql .= " AND kind = :kind";
            $params[':kind'] = $kind;
        }

        if ($active !== null) {
            $sql .= " AND active = :active";
            $params[':active'] = $active;
        }

        if ($search !== null) {
            $sql .= " AND (LOWER(title) LIKE :search OR LOWER(description) LIKE :search OR LOWER(slug) LIKE :search)";
            $params[':search'] = '%' . strtolower($search) . '%';
        }

        $sql .= " ORDER BY created_at DESC LIMIT :limit OFFSET :skip";

        $stmt = $db->prepare($sql);
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':skip', $skip, PDO::PARAM_INT);
        $stmt->execute();

        $interactions = array_map([Interaction::class, 'format'], $stmt->fetchAll());
        ApiResponse::json($interactions, 200);
    }

    /**
     * POST /interactions
     * Creates a new interaction. Automatically sets owner_id to current user.
     */
    public static function create(): void {
        $currentUser = AuthMiddleware::authenticate();

        $input = json_decode(file_get_contents('php://input'), true) ?: [];

        $kind = trim($input['kind'] ?? '');
        $title = trim($input['title'] ?? '');

        if (!in_array($kind, ['vote', 'feedback', 'anon'], true)) {
            ApiResponse::error("Tipe formulir harus salah satu dari: vote, feedback, atau anon.", 422);
        }

        if (empty($title)) {
            ApiResponse::error("Judul formulir interaksi wajib diisi.", 422);
        }

        $targetOwnerId = $currentUser['id'];
        if ($currentUser['role'] === 'Administrator' && !empty($input['owner_id'])) {
            $targetOwnerId = trim($input['owner_id']);
        }

        $db = Database::getConnection();
        $created = Interaction::create($db, $input, $targetOwnerId);

        ApiResponse::json($created, 201);
    }

    /**
     * GET /interactions/{id}
     * Detail interaction. Restricted to creator or Administrator.
     */
    public static function getDetail(string $id): void {
        $currentUser = AuthMiddleware::authenticate();

        $db = Database::getConnection();
        $row = Interaction::findById($db, $id);

        if (!$row) {
            ApiResponse::error("Interaksi tidak ditemukan.", 404);
        }

        if ($currentUser['role'] !== 'Administrator' && $row['owner_id'] !== $currentUser['id']) {
            ApiResponse::error("Akses ditolak. Anda bukan pembuat link interaksi ini.", 403);
        }

        ApiResponse::json(Interaction::format($row), 200);
    }

    /**
     * PATCH /interactions/{id}
     * Update interaction. Restricted to creator or Administrator.
     */
    public static function update(string $id): void {
        $currentUser = AuthMiddleware::authenticate();

        $db = Database::getConnection();
        $row = Interaction::findById($db, $id);

        if (!$row) {
            ApiResponse::error("Interaksi tidak ditemukan.", 404);
        }

        if ($currentUser['role'] !== 'Administrator' && $row['owner_id'] !== $currentUser['id']) {
            ApiResponse::error("Akses ditolak. Anda bukan pembuat link interaksi ini.", 403);
        }

        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $updated = Interaction::update($db, $id, $input);

        ApiResponse::json($updated, 200);
    }

    /**
     * DELETE /interactions/{id}
     * Delete interaction. Restricted to creator or Administrator.
     */
    public static function delete(string $id): void {
        $currentUser = AuthMiddleware::authenticate();

        $db = Database::getConnection();
        $row = Interaction::findById($db, $id);

        if (!$row) {
            ApiResponse::error("Interaksi tidak ditemukan.", 404);
        }

        if ($currentUser['role'] !== 'Administrator' && $row['owner_id'] !== $currentUser['id']) {
            ApiResponse::error("Akses ditolak. Anda bukan pembuat link interaksi ini.", 403);
        }

        Interaction::delete($db, $id);

        ApiResponse::noContent();
    }

    /**
     * GET /interactions/{id}/responses
     * Responses for specific interaction. Restricted to creator or Administrator.
     * Enforces privacy:
     * - Admin cannot see identity of respondents who chose anonymous.
     * - Creator can only see identity if respondent chose to show name.
     */
    public static function getResponses(string $id): void {
        $currentUser = AuthMiddleware::authenticate();

        $db = Database::getConnection();
        $interaction = Interaction::findById($db, $id);

        if (!$interaction) {
            ApiResponse::error("Interaksi tidak ditemukan.", 404);
        }

        if ($currentUser['role'] !== 'Administrator' && $interaction['owner_id'] !== $currentUser['id']) {
            ApiResponse::error("Akses ditolak. Hanya pembuat link atau Administrator yang dapat melihat tanggapan.", 403);
        }

        $skip = max(0, (int)($_GET['skip'] ?? 0));
        $limit = max(1, min(1000, (int)($_GET['limit'] ?? 200)));

        $rawResponses = ResponseModel::getByInteraction($db, $id, $skip, $limit);

        // Terapkan filter privasi identitas
        $responses = array_map(function($r) use ($currentUser, $interaction) {
            return ResponseModel::formatWithPrivacy($r, $currentUser, $interaction);
        }, $rawResponses);

        ApiResponse::json($responses, 200);
    }
}
