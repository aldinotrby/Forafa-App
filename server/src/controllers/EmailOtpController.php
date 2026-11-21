<?php
/**
 * Email OTP Controller — kirim & verifikasi kode 5 digit untuk pendaftaran.
 *
 * POST /auth/email-otp/send   { email }            -> kode dikirim dari forafagroup@gmail.com
 * POST /auth/email-otp/verify { email, code }      -> verification_token sekali pakai
 *
 * Tidak ada kode demo: bila SMTP belum dikonfigurasi atau pengiriman
 * gagal, send mengembalikan 503/502 dengan pesan yang menjelaskan
 * cara memperbaikinya — kode tidak pernah ditampilkan di respons.
 */

declare(strict_types=1);

require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../models/EmailOtp.php';
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../config/database.php';

class EmailOtpController
{
    /** POST /auth/email-otp/send */
    public static function send(): void
    {
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $email = strtolower(trim($input['email'] ?? ''));

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            ApiResponse::error('Format email tidak valid.', 422);
        }

        $db = Database::getConnection();

        if (User::findByEmail($db, $email)) {
            ApiResponse::error('Email sudah terdaftar. Silakan login.', 400);
        }

        try {
            $result = EmailOtp::createAndSend($db, $email);
        } catch (InvalidArgumentException $e) {
            ApiResponse::error($e->getMessage(), 422);
        } catch (RuntimeException $e) {
            $code = $e->getCode();
            ApiResponse::error($e->getMessage(), in_array($code, [429, 502, 503], true) ? $code : 400);
        }

        ApiResponse::json([
            'message' => "Kode verifikasi 5 digit telah dikirim ke {$email} dari forafagroup@gmail.com. Periksa inbox (dan folder spam).",
            'email' => $result['email'],
            'expires_in_seconds' => $result['expires_in_seconds'],
            'expires_at' => $result['expires_at'],
            'resend_after_seconds' => $result['resend_after_seconds'],
        ], 200);
    }

    /** POST /auth/email-otp/verify */
    public static function verify(): void
    {
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $email = strtolower(trim($input['email'] ?? ''));
        $code = trim((string)($input['code'] ?? ''));

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            ApiResponse::error('Format email tidak valid.', 422);
        }

        $db = Database::getConnection();
        $result = EmailOtp::verify($db, $email, $code);

        if (!($result['valid'] ?? false)) {
            ApiResponse::error($result['error'] ?? 'Kode verifikasi tidak valid.', 400);
        }

        ApiResponse::json([
            'message' => 'Email terverifikasi. Silakan lanjutkan pendaftaran.',
            'email' => $result['email'],
            'verification_token' => $result['verification_token'],
            'token_expires_in_seconds' => $result['token_expires_in_seconds'],
        ], 200);
    }
}
