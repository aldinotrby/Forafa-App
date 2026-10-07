<?php
/**
 * Public Visitor Portal Controller (No Authentication Required)
 */

declare(strict_types=1);

require_once __DIR__ . '/../models/Interaction.php';
require_once __DIR__ . '/../models/Response.php';
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../config/database.php';

class PublicController {
    /**
     * GET /public/{slug}
     */
    public static function getDetail(string $slug): void {
        $db = Database::getConnection();
        $row = Interaction::findBySlug($db, $slug);

        if (!$row) {
            ApiResponse::error("Link interaksi tidak ditemukan atau sudah dihapus.", 404);
        }

        ApiResponse::json(Interaction::formatPublic($row), 200);
    }

    /**
     * POST /public/{slug}/submit
     */
    public static function submit(string $slug): void {
        $db = Database::getConnection();
        $interaction = Interaction::findBySlug($db, $slug);

        if (!$interaction) {
            ApiResponse::error("Link interaksi tidak ditemukan.", 404);
        }

        if (Interaction::isClosed($interaction)) {
            ApiResponse::error("Interaksi ini sedang ditutup atau di luar periode aktif.", 400);
        }

        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $kind = $interaction['kind'];

        $name = isset($input['name']) ? trim((string)$input['name']) : null;
        $choice = isset($input['choice']) ? trim((string)$input['choice']) : null;
        $message = isset($input['message']) ? trim((string)$input['message']) : null;

        if ($kind === 'vote') {
            if (empty($choice)) {
                ApiResponse::error("Pilihan vote wajib diisi.", 422);
            }

            $opts = $interaction['options'] ?? '[]';
            $optionsList = is_string($opts) ? (json_decode($opts, true) ?: []) : (array)$opts;

            if (!empty($optionsList) && !in_array($choice, $optionsList, true)) {
                ApiResponse::error("Pilihan tidak valid untuk voting ini.", 400);
            }
        } elseif ($kind === 'feedback') {
            if (empty($message)) {
                ApiResponse::error("Pesan aspirasi / masukan wajib diisi.", 422);
            }
        } elseif ($kind === 'anon') {
            if (empty($message)) {
                ApiResponse::error("Pesan rahasia anonim wajib diisi.", 422);
            }
            $name = null; // Enforce anonymity
        }

        $response = ResponseModel::create($db, [
            'interaction_id' => $interaction['id'],
            'name' => !empty($name) ? $name : null,
            'choice' => !empty($choice) ? $choice : null,
            'message' => !empty($message) ? $message : null,
            'status' => 'Baru',
            'reply' => null,
            'shared' => 0,
        ]);

        ApiResponse::json($response, 201);
    }
}
