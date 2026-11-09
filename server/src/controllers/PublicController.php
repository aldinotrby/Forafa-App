<?php
/**
 * Public Visitor Portal Controller (No Authentication Required)
 * Supports anonymous voting, real-name choice submission,
 * multi-question voting branching, and conflict validation.
 */

declare(strict_types=1);

require_once __DIR__ . '/../models/Interaction.php';
require_once __DIR__ . '/../models/Response.php';
require_once __DIR__ . '/../models/VotingQuestion.php';
require_once __DIR__ . '/../models/GoogleAuth.php';
require_once __DIR__ . '/../models/OTP.php';
require_once __DIR__ . '/../models/Participant.php';
require_once __DIR__ . '/../middlewares/RateLimitMiddleware.php';
require_once __DIR__ . '/../middlewares/SpamProtectionMiddleware.php';
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../config/database.php';

class PublicController {
    /**
     * GET /public/{slug}
     * Returns interaction details along with active voting questions if present
     */
    public static function getDetail(string $slug): void {
        $db = Database::getConnection();
        $row = Interaction::findBySlug($db, $slug);

        if (!$row) {
            ApiResponse::error("Link interaksi tidak ditemukan atau sudah dihapus.", 404);
        }

        $formatted = Interaction::formatPublic($row);

        // Jika jenis vote, sertakan daftar pertanyaan aktif yang terhubung dalam link ini
        if ($row['kind'] === 'vote') {
            $questions = VotingQuestion::getByInteraction($db, $row['id'], true);
            $formatted['questions'] = $questions;
            $formatted['has_multi_questions'] = !empty($questions);
        }

        ApiResponse::json($formatted, 200);
    }

    /**
     * POST /public/{slug}/submit
     * Handles vote or feedback submission with option for Anonymous or Real Name,
     * multi-question branching, and conflict validation.
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
        $submittedAnswers = $input['answers'] ?? $input['choices'] ?? null;

        // Tentukan pilihan anonymous atau nama asli
        if ($kind === 'anon') {
            $isAnonymous = true;
            $name = null;
        } elseif (isset($input['is_anonymous'])) {
            $isAnonymous = filter_var($input['is_anonymous'], FILTER_VALIDATE_BOOLEAN);
        } elseif (isset($input['privacy']) && strtolower(trim((string)$input['privacy'])) === 'anonymous') {
            $isAnonymous = true;
        } elseif (empty($name)) {
            $isAnonymous = true;
        } else {
            $isAnonymous = false;
        }

        $savedAnswers = [];

        // Validasi Percabangan Voting (Multi-question)
        if ($kind === 'vote') {
            $activeQuestions = VotingQuestion::getByInteraction($db, $interaction['id'], true);

            if (!empty($activeQuestions)) {
                // Interaksi memiliki serangkaian pertanyaan dalam satu link
                if (empty($submittedAnswers) || (!is_array($submittedAnswers) && !is_object($submittedAnswers))) {
                    ApiResponse::error("Jawaban voting ('answers') wajib diisi untuk semua pertanyaan aktif.", 422);
                }

                // VALIDASI JAWABAN AGAR TIDAK ADA PILIHAN YANG BERTENTANGAN
                $validationError = VotingQuestion::validateAnswers($activeQuestions, (array)$submittedAnswers);
                if ($validationError !== null) {
                    ApiResponse::error($validationError, 422);
                }

                // Bangun ringkasan pilihan untuk kolom choice
                $summaryParts = [];
                $norm = [];
                if (isset($submittedAnswers[0]) && is_array($submittedAnswers[0])) {
                    foreach ($submittedAnswers as $item) {
                        if (!empty($item['question_id'])) {
                            $norm[$item['question_id']] = $item['choice'] ?? '';
                        }
                    }
                } else {
                    $norm = (array)$submittedAnswers;
                }

                foreach ($activeQuestions as $q) {
                    $val = $norm[$q['id']] ?? $norm[$q['role_key']] ?? null;
                    if ($val) {
                        $summaryParts[] = "{$q['role_label']}: {$val}";
                    }
                }
                $choice = implode(', ', $summaryParts);

            } else {
                // Single-question legacy vote
                if (empty($choice)) {
                    ApiResponse::error("Pilihan vote wajib diisi.", 422);
                }

                $opts = $interaction['options'] ?? '[]';
                $optionsList = is_string($opts) ? (json_decode($opts, true) ?: []) : (array)$opts;

                if (!empty($optionsList) && !in_array($choice, $optionsList, true)) {
                    ApiResponse::error("Pilihan tidak valid untuk voting ini.", 400);
                }
            }

        } elseif ($kind === 'feedback') {
            if (empty($message)) {
                ApiResponse::error("Pesan aspirasi / masukan wajib diisi.", 422);
            }
        } elseif ($kind === 'anon') {
            if (empty($message)) {
                ApiResponse::error("Pesan rahasia anonim wajib diisi.", 422);
            }
            $name = null;
        }

        // Simpan data jawaban dan data identitas secara terpisah
        $response = ResponseModel::create($db, [
            'interaction_id' => $interaction['id'],
            'name' => !empty($name) ? $name : null,
            'choice' => !empty($choice) ? $choice : null,
            'message' => !empty($message) ? $message : null,
            'status' => 'Baru',
            'reply' => null,
            'shared' => 0,
            'is_anonymous' => $isAnonymous,
        ]);

        // Simpan per-question answers jika ada
        if ($kind === 'vote' && !empty($activeQuestions) && !empty($submittedAnswers)) {
            $savedAnswers = VotingQuestion::saveAnswers($db, $response['id'], $activeQuestions, (array)$submittedAnswers);
            $response['answers'] = $savedAnswers;
        }

        // Kontrak API (docs/api_specification.md §6.2): respon 201 dibungkus
        // pesan status + data tanggapan. Field "message" pada $response sendiri
        // adalah isi pesan dari pengunjung, jadi pesan status harus menjadi
        // field terpisah di level teratas agar tidak tertimpa/tertukar.
        ApiResponse::json([
            'message' => 'Tanggapan berhasil dikirim.',
            'response' => $response,
        ], 201);
    }
}
