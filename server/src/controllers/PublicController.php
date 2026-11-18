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
require_once __DIR__ . '/../models/Recommendation.php';
require_once __DIR__ . '/../models/Session.php';
require_once __DIR__ . '/../middlewares/RateLimitMiddleware.php';
require_once __DIR__ . '/../middlewares/SpamProtectionMiddleware.php';
require_once __DIR__ . '/../middlewares/AuthMiddleware.php';
require_once __DIR__ . '/../utils/JWT.php';
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

        // ------------------------------------------------------------------
        // ANTI-SPAM: deteksi honeypot, submit terlalu cepat, dan UA scanner
        // ------------------------------------------------------------------
        SpamProtectionMiddleware::inspect($input);

        // ------------------------------------------------------------------
        // RATE LIMITING: batasi frekuensi submit per IP
        // ------------------------------------------------------------------
        $config = require __DIR__ . '/../config/config.php';
        $maxSubmit = (int)($config['rate_limit']['submit_max_requests'] ?? 5);
        RateLimitMiddleware::enforce('submit_public', $maxSubmit, 60);

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
        $verifiedPhone = null;
        $verifiedGoogleKey = null;
        $recommendationApplied = null;

        // Soft auth: tautkan pengiriman ke akun pengguna bila sedang login
        // (berlaku untuk semua jenis: vote, feedback, maupun anon).
        $sessionUser = self::resolveSessionUser($db);

        // ------------------------------------------------------------------
        // VERIFIKASI IDENTITAS (khusus voting):
        // - OTP WhatsApp wajib & token harus valid untuk interaksi ini
        // - Satu akun (login session, termasuk Google) hanya boleh 1x vote
        // - Satu nomor WhatsApp / satu akun Google hanya boleh 1x vote
        //
        // Kontrak input (frontend main): verifikasi dikirim sebagai objek
        //   verification: { type: 'whatsapp'|'google',
        //                 identifier: 'wa:<nomor62>' | 'google:<sub>',
        //                 token: <verification_token OTP> }
        // Field top-level lama (phone / verification_token / otp_token)
        // tetap diterima sebagai fallback (kompatibilitas be/server).
        // Google tidak memakai token OTP: key google:<sub> sudah divalidasi
        // di client lewat Google Identity Services.
        // ------------------------------------------------------------------
        $verification = is_array($input['verification'] ?? null) ? $input['verification'] : [];
        $verifyType = strtolower(trim((string)($verification['type'] ?? $input['verifiedVia'] ?? $input['verified_via'] ?? '')));
        $verifyIdentifier = trim((string)($verification['identifier'] ?? $input['voterKey'] ?? $input['voter_key'] ?? ''));
        $verifyToken = trim((string)($verification['token'] ?? $input['verification_token'] ?? $input['otp_token'] ?? ''));

        if ($kind === 'vote') {
            if ($verifyType === 'google') {
                $verifiedGoogleKey = $verifyIdentifier !== '' ? $verifyIdentifier : trim((string)($input['voterKey'] ?? ''));
                if ($verifiedGoogleKey === '' || !str_starts_with($verifiedGoogleKey, 'google:')) {
                    ApiResponse::error("Verifikasi Google wajib untuk voting. Login dengan Google terlebih dahulu.", 422);
                }

                // 1 akun Google = 1 vote per interaksi
                if (Participant::hasVoted($db, $interaction['id'], Participant::TYPE_GOOGLE, $verifiedGoogleKey)) {
                    ApiResponse::error("Akun Google ini sudah pernah digunakan untuk mengisi voting ini. Setiap akun hanya dapat mengisi satu kali.", 409);
                }
            } else {
                // WhatsApp (default): nomor bisa datang dari verification.identifier
                // ('wa:628...'), atau field top-level phone / phone_number.
                $phone = trim((string)($input['phone'] ?? $input['phone_number'] ?? ''));
                if ($phone === '' && str_starts_with($verifyIdentifier, 'wa:')) {
                    $phone = substr($verifyIdentifier, 3);
                }
                $otpToken = $verifyToken;

                if ($phone === '' || $otpToken === '') {
                    ApiResponse::error("Verifikasi OTP WhatsApp wajib untuk voting. Kirim dan verifikasi kode OTP terlebih dahulu.", 422);
                }

                if (!OTP::validateToken($db, $phone, $otpToken, $interaction['id'])) {
                    ApiResponse::error("Token verifikasi OTP tidak valid atau telah kedaluwarsa. Silakan verifikasi ulang nomor WhatsApp.", 422);
                }

                $verifiedPhone = OTP::normalizePhoneNumber($phone);

                // 1 WhatsApp number = 1 vote per interaction
                if (Participant::hasVoted($db, $interaction['id'], Participant::TYPE_WHATSAPP, $verifiedPhone)) {
                    ApiResponse::error("Nomor WhatsApp ini sudah pernah digunakan untuk mengisi voting ini. Setiap nomor hanya dapat mengisi satu kali.", 409);
                }
            }

            // 1 akun hanya boleh 1x vote (session login, termasuk Google login)
            if ($sessionUser && Participant::hasVoted($db, $interaction['id'], Participant::TYPE_USER, (string)$sessionUser['id'])) {
                ApiResponse::error("Akun ini sudah pernah mengisi voting ini. Setiap akun hanya dapat mengisi satu kali.", 409);
            }
        }

        // Validasi Percabangan Voting (Multi-question)
        if ($kind === 'vote') {
            $activeQuestions = VotingQuestion::getByInteraction($db, $interaction['id'], true);

            if (!empty($activeQuestions)) {
                // Interaksi memiliki serangkaian pertanyaan dalam satu link
                if (empty($submittedAnswers) || (!is_array($submittedAnswers) && !is_object($submittedAnswers))) {
                    ApiResponse::error("Jawaban voting ('answers') wajib diisi untuk semua pertanyaan aktif.", 422);
                }

                // ------------------------------------------------------------------
                // LOGIKA REKOMENDASI IF-ELSE
                // Pengisi dapat memilih mode 'recommendation' (posisi target diisi
                // oleh aturan) atau 'manual' (memilih sendiri seperti biasa).
                // ------------------------------------------------------------------
                Recommendation::ensureTablesExist($db);
                $recommendationEnabled = !empty($interaction['recommendation_enabled']);
                $useRecommendation = !empty($input['use_recommendation']) || !empty($input['recommendation']);

                if ($useRecommendation) {
                    if (!$recommendationEnabled) {
                        ApiResponse::error("Fitur rekomendasi tidak diaktifkan untuk interaksi ini.", 400);
                    }

                    $recRules = Recommendation::getRulesByInteraction($db, $interaction['id'], true);
                    if (empty($recRules)) {
                        ApiResponse::error("Belum ada aturan rekomendasi yang aktif untuk interaksi ini.", 422);
                    }

                    $eval = Recommendation::evaluate($recRules, $activeQuestions, (array)$submittedAnswers);
                    if ($eval === null) {
                        ApiResponse::error("Aturan rekomendasi tidak sesuai dengan pertanyaan voting aktif.", 422);
                    }
                    if (!empty($eval['missing_targets'])) {
                        $missingTitles = [];
                        foreach ($activeQuestions as $q) {
                            if (in_array($q['id'], $eval['missing_targets'], true)) {
                                $missingTitles[] = "'{$q['title']}'";
                            }
                        }
                        ApiResponse::error(
                            "Tidak ada aturan rekomendasi yang cocok untuk pertanyaan " . implode(', ', $missingTitles) .
                            ". Silakan gunakan mode pemilihan manual.",
                            422
                        );
                    }

                    // Gabungkan jawaban kriteria dengan hasil rekomendasi,
                    // lalu validasi seperti pengisian manual biasa.
                    $submittedAnswers = Recommendation::mergeRecommendations($eval['answers'], $eval['recommendations']);
                    $recommendationApplied = [
                        'mode' => Recommendation::MODE_RECOMMENDATION,
                        'recommendations' => $eval['recommendations'],
                        'matched_rule_ids' => $eval['matched_rule_ids'],
                    ];
                } elseif ($recommendationEnabled) {
                    // Keputusan kembali memilih manual tetap dicatat
                    $recommendationApplied = ['mode' => Recommendation::MODE_MANUAL];
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
            'user_id' => $sessionUser['id'] ?? null,
        ]);

        // Kunci partisipasi (anti pengisian berulang) sebelum menyimpan jawaban.
        // Unique key di interaction_participants mencegah race condition / double-submit.
        if ($kind === 'vote' && ($verifiedPhone !== null || $verifiedGoogleKey !== null)) {
            if ($verifiedPhone !== null) {
                $locked = Participant::recordVote($db, $interaction['id'], Participant::TYPE_WHATSAPP, $verifiedPhone, $response['id']);
                if (!$locked) {
                    ResponseModel::delete($db, $response['id']);
                    ApiResponse::error("Nomor WhatsApp ini sudah pernah digunakan untuk mengisi voting ini.", 409);
                }
            }

            if ($verifiedGoogleKey !== null) {
                $lockedGoogle = Participant::recordVote($db, $interaction['id'], Participant::TYPE_GOOGLE, $verifiedGoogleKey, $response['id']);
                if (!$lockedGoogle) {
                    ResponseModel::delete($db, $response['id']);
                    ApiResponse::error("Akun Google ini sudah pernah digunakan untuk mengisi voting ini.", 409);
                }
            }

            if ($sessionUser) {
                Participant::recordVote($db, $interaction['id'], Participant::TYPE_USER, (string)$sessionUser['id'], $response['id']);
            }
        }

        // Simpan per-question answers jika ada
        if ($kind === 'vote' && !empty($activeQuestions) && !empty($submittedAnswers)) {
            $savedAnswers = VotingQuestion::saveAnswers($db, $response['id'], $activeQuestions, (array)$submittedAnswers);
            $response['answers'] = $savedAnswers;
        }

        // Simpan hasil rekomendasi / keputusan mode (recommendation atau manual)
        if ($recommendationApplied !== null) {
            Recommendation::saveResult(
                $db,
                $response['id'],
                $interaction['id'],
                $recommendationApplied['mode'],
                $recommendationApplied['recommendations'] ?? null,
                $recommendationApplied['matched_rule_ids'] ?? []
            );
            $response['recommendation'] = $recommendationApplied;
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

    /**
     * Soft authentication: validasi Bearer token + session bila dikirim.
     * Mengembalikan data user bila session valid, null bila tidak ada/gagal
     * (tidak menghentikan request — submit publik tetap anonim).
     */
    private static function resolveSessionUser(PDO $db): ?array {
        $token = AuthMiddleware::getBearerToken();
        if (!$token) {
            return null;
        }

        $config = require __DIR__ . '/../config/config.php';
        $payload = JWT::decode($token, $config['jwt']['secret']);
        if (!$payload || empty($payload['sub'])) {
            return null;
        }

        $idleMinutes = (int)($config['session']['idle_minutes'] ?? 120);
        if (!Session::validate($db, $token, $idleMinutes)) {
            return null;
        }

        $stmt = $db->prepare("SELECT id, username, email, role FROM users WHERE id = :id");
        $stmt->execute([':id' => $payload['sub']]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        return $user ?: null;
    }
}
