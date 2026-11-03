<?php
/**
 * WhatsApp OTP Controller
 * Handles sending and verifying OTP codes for voter verification and anti-spam protection.
 */

declare(strict_types=1);

require_once __DIR__ . '/../models/Interaction.php';
require_once __DIR__ . '/../models/OTP.php';
require_once __DIR__ . '/../models/Participant.php';
require_once __DIR__ . '/../middlewares/RateLimitMiddleware.php';
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/config.php';

class OtpController {
    /**
     * POST /public/{slug}/otp/send
     * Sends OTP to WhatsApp number for a specific voting interaction
     */
    public static function send(string $slug): void {
        $db = Database::getConnection();
        $interaction = Interaction::findBySlug($db, $slug);

        if (!$interaction) {
            ApiResponse::error("Link interaksi tidak ditemukan.", 404);
        }

        if (Interaction::isClosed($interaction)) {
            ApiResponse::error("Interaksi ini sedang ditutup atau di luar periode aktif.", 400);
        }

        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $phone = trim($input['phone'] ?? $input['phone_number'] ?? '');

        if (empty($phone)) {
            ApiResponse::error("Nomor WhatsApp wajib diisi.", 422);
        }

        $cleanPhone = OTP::normalizePhoneNumber($phone);

        // 1. Enforce Rate Limiting for OTP sending (Max 3 sends per phone per 10 minutes)
        $config = require __DIR__ . '/../config/config.php';
        $maxOtpRequests = (int)($config['rate_limit']['otp_max_requests'] ?? 3);
        RateLimitMiddleware::enforce('send_otp', $maxOtpRequests, 600, $cleanPhone);

        // 2. Check if this WhatsApp number has ALREADY voted in this interaction
        if (Participant::hasVoted($db, $interaction['id'], Participant::TYPE_WHATSAPP, $cleanPhone)) {
            ApiResponse::error("Nomor WhatsApp ini sudah pernah digunakan untuk mengisi voting ini. Setiap nomor hanya dapat mengisi satu kali.", 409);
        }

        try {
            $result = OTP::createAndSend($db, $cleanPhone, $interaction['id']);
            ApiResponse::json([
                'status' => 'success',
                'message' => "Kode OTP WhatsApp berhasil dikirim ke nomor {$cleanPhone}.",
                'data' => $result,
            ], 200);
        } catch (Throwable $e) {
            ApiResponse::error($e->getMessage(), 422);
        }
    }

    /**
     * POST /public/{slug}/otp/verify
     * Verifies the OTP code submitted by the user
     */
    public static function verify(string $slug): void {
        $db = Database::getConnection();
        $interaction = Interaction::findBySlug($db, $slug);

        if (!$interaction) {
            ApiResponse::error("Link interaksi tidak ditemukan.", 404);
        }

        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $phone = trim($input['phone'] ?? $input['phone_number'] ?? '');
        $code = trim($input['code'] ?? $input['otp'] ?? '');

        if (empty($phone) || empty($code)) {
            ApiResponse::error("Nomor WhatsApp dan kode OTP wajib diisi.", 422);
        }

        $cleanPhone = OTP::normalizePhoneNumber($phone);
        $result = OTP::verify($db, $cleanPhone, $code, $interaction['id']);

        if (!$result['valid']) {
            ApiResponse::error($result['error'] ?? "Verifikasi OTP gagal.", 422);
        }

        ApiResponse::json($result, 200);
    }
}

