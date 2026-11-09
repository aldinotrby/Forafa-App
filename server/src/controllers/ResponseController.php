<?php
/**
 * Responses Management Controller
 * Enforces creator access control and strict identity privacy filtering.
 */

declare(strict_types=1);

require_once __DIR__ . '/../models/Interaction.php';
require_once __DIR__ . '/../models/Response.php';
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../middlewares/AuthMiddleware.php';
require_once __DIR__ . '/../config/database.php';

class ResponseController {
    /**
     * GET /responses
     * Lists responses with privacy filtering applied.
     */
    public static function list(): void {
        $currentUser = AuthMiddleware::authenticate();

        $interactionId = !empty($_GET['interaction_id']) ? trim($_GET['interaction_id']) : null;
        $status = !empty($_GET['status']) ? trim($_GET['status']) : null;
        $search = !empty($_GET['search']) ? trim($_GET['search']) : (!empty($_GET['q']) ? trim($_GET['q']) : null);
        $skip = max(0, (int)($_GET['skip'] ?? 0));
        $limit = max(1, min(1000, (int)($_GET['limit'] ?? 500)));

        $db = Database::getConnection();
        ResponseModel::ensureTablesExist($db);

        // 1. Single interaction requested
        if ($interactionId !== null) {
            $interaction = Interaction::findById($db, $interactionId);
            if (!$interaction) {
                ApiResponse::error("Interaksi tidak ditemukan.", 404);
            }

            // Hak akses pembuat link
            if ($currentUser['role'] !== 'Administrator' && $interaction['owner_id'] !== $currentUser['id']) {
                ApiResponse::error("Akses ditolak. Anda bukan pembuat link interaksi ini.", 403);
            }

            $sql = "
                SELECT r.*, ri.name AS identity_name, COALESCE(r.is_anonymous, ri.is_anonymous, 0) AS is_anonymous
                FROM responses r
                LEFT JOIN response_identities ri ON ri.response_id = r.id
                WHERE r.interaction_id = :interaction_id
            ";
            $params = [':interaction_id' => $interactionId];

            if ($status !== null) {
                $sql .= " AND r.status = :status";
                $params[':status'] = $status;
            }
            if ($search !== null) {
                $sql .= " AND (LOWER(r.message) LIKE :search OR LOWER(ri.name) LIKE :search OR LOWER(r.choice) LIKE :search)";
                $params[':search'] = '%' . strtolower($search) . '%';
            }

            $sql .= " ORDER BY r.created_at DESC LIMIT :limit OFFSET :skip";
            $stmt = $db->prepare($sql);
            foreach ($params as $k => $v) {
                $stmt->bindValue($k, $v);
            }
            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
            $stmt->bindValue(':skip', $skip, PDO::PARAM_INT);
            $stmt->execute();

            $rawRows = $stmt->fetchAll();
            $responses = array_map(function($r) use ($currentUser, $interaction) {
                return ResponseModel::formatWithPrivacy($r, $currentUser, $interaction);
            }, $rawRows);

            ApiResponse::json($responses, 200);
        }

        // 2. All interactions allowed for the user
        $interactionMap = [];
        if ($currentUser['role'] === 'Administrator') {
            $allInteractions = Interaction::getAll($db, null, 0, 5000);
            foreach ($allInteractions as $i) {
                $interactionMap[$i['id']] = $i;
            }
            $ids = array_column($allInteractions, 'id');
        } else {
            $userInteractions = Interaction::getByOwner($db, $currentUser['id'], null, 0, 5000);
            foreach ($userInteractions as $i) {
                $interactionMap[$i['id']] = $i;
            }
            $ids = array_column($userInteractions, 'id');
        }

        if (empty($ids)) {
            ApiResponse::json([], 200);
        }

        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $sql = "
            SELECT r.*, ri.name AS identity_name, COALESCE(r.is_anonymous, ri.is_anonymous, 0) AS is_anonymous
            FROM responses r
            LEFT JOIN response_identities ri ON ri.response_id = r.id
            WHERE r.interaction_id IN ($placeholders)
        ";
        $params = $ids;

        if ($status !== null) {
            $sql .= " AND r.status = ?";
            $params[] = $status;
        }
        if ($search !== null) {
            $sql .= " AND (LOWER(r.message) LIKE ? OR LOWER(ri.name) LIKE ? OR LOWER(r.choice) LIKE ?)";
            $term = '%' . strtolower($search) . '%';
            $params[] = $term;
            $params[] = $term;
            $params[] = $term;
        }

        $sql .= " ORDER BY r.created_at DESC LIMIT ? OFFSET ?";
        $stmt = $db->prepare($sql);
        $idx = 1;
        foreach ($params as $val) {
            $stmt->bindValue($idx++, $val, PDO::PARAM_STR);
        }
        $stmt->bindValue($idx++, $limit, PDO::PARAM_INT);
        $stmt->bindValue($idx++, $skip, PDO::PARAM_INT);
        $stmt->execute();

        $rawRows = $stmt->fetchAll();
        $responses = array_map(function($r) use ($currentUser, $interactionMap) {
            $interaction = $interactionMap[$r['interaction_id']] ?? null;
            return ResponseModel::formatWithPrivacy($r, $currentUser, $interaction);
        }, $rawRows);

        ApiResponse::json($responses, 200);
    }

    /**
     * PATCH /responses/{id}
     * Update status or reply. Restricted to creator or Administrator.
     */
    public static function update(string $id): void {
        $currentUser = AuthMiddleware::authenticate();

        $db = Database::getConnection();
        $response = ResponseModel::findById($db, $id);

        if (!$response) {
            ApiResponse::error("Respons tidak ditemukan.", 404);
        }

        $interaction = Interaction::findById($db, $response['interaction_id']);
        if (!$interaction) {
            ApiResponse::error("Interaksi terkait tidak ditemukan.", 404);
        }

        if ($currentUser['role'] !== 'Administrator' && $interaction['owner_id'] !== $currentUser['id']) {
            ApiResponse::error("Akses ditolak. Anda bukan pembuat link interaksi ini.", 403);
        }

        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $updated = ResponseModel::update($db, $id, $input);

        // Apply privacy filtering
        $formatted = ResponseModel::formatWithPrivacy($updated, $currentUser, $interaction);
        ApiResponse::json($formatted, 200);
    }

    /**
     * DELETE /responses/{id}
     * Delete response. Restricted to creator or Administrator.
     */
    public static function delete(string $id): void {
        $currentUser = AuthMiddleware::authenticate();

        $db = Database::getConnection();
        $response = ResponseModel::findById($db, $id);

        if (!$response) {
            ApiResponse::error("Respons tidak ditemukan.", 404);
        }

        $interaction = Interaction::findById($db, $response['interaction_id']);
        if (!$interaction) {
            ApiResponse::error("Interaksi terkait tidak ditemukan.", 404);
        }

        if ($currentUser['role'] !== 'Administrator' && $interaction['owner_id'] !== $currentUser['id']) {
            ApiResponse::error("Akses ditolak. Anda bukan pembuat link interaksi ini.", 403);
        }

        ResponseModel::delete($db, $id);

        ApiResponse::noContent();
    }

    /**
     * GET /responses/export/csv
     * Export responses to CSV. Enforces privacy masking for anonymous participants.
     */
    public static function exportCsv(): void {
        $currentUser = AuthMiddleware::authenticate();

        $interactionId = !empty($_GET['interaction_id']) ? trim($_GET['interaction_id']) : null;
        if (!$interactionId) {
            ApiResponse::error("Parameter interaction_id wajib disertakan.", 422);
        }

        $db = Database::getConnection();
        $interaction = Interaction::findById($db, $interactionId);

        if (!$interaction) {
            ApiResponse::error("Interaksi tidak ditemukan.", 404);
        }

        if ($currentUser['role'] !== 'Administrator' && $interaction['owner_id'] !== $currentUser['id']) {
            ApiResponse::error("Akses ditolak. Anda bukan pembuat link interaksi ini.", 403);
        }

        $rawResponses = ResponseModel::getByInteraction($db, $interactionId, 0, 10000);

        // Terapkan filter privasi pada data CSV
        $filteredResponses = array_map(function($r) use ($currentUser, $interaction) {
            return ResponseModel::formatWithPrivacy($r, $currentUser, $interaction);
        }, $rawResponses);

        $csv = ResponseModel::generateCsv($filteredResponses, $interaction['title']);

        $filename = 'responses-' . ($interaction['slug'] ?? $interactionId) . '.csv';
        ApiResponse::csv($csv, $filename);
    }
}
