<?php
/**
 * Spam Protection Middleware
 * Detects automated bots, honeypot traps, unnatural submission bursts, and suspicious payloads.
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../utils/Response.php';

class SpamProtectionMiddleware {
    /**
     * Inspect request payload for bot honeypots and rapid automated submissions
     */
    public static function inspect(array $input): void {
        $config = require __DIR__ . '/../config/config.php';

        // 1. Honeypot Field Check (Bots automatically fill all input fields, while humans leave hidden fields blank)
        if (!empty($config['anti_spam']['honeypot_enabled'])) {
            $honeypotFields = ['_hp_check', 'website', 'fax_number'];
            foreach ($honeypotFields as $field) {
                if (!empty($input[$field])) {
                    ApiResponse::error("Aktivitas mencurigakan terdeteksi (Bot/Spam detected).", 400);
                }
            }
        }

        // 2. Minimum Submission Time Check (Instant submissions under 1 second indicate automated script)
        if (!empty($input['form_rendered_at'])) {
            $renderedAt = (int)$input['form_rendered_at'];
            $minSeconds = (int)($config['anti_spam']['min_submit_seconds'] ?? 1);
            $elapsed = time() - $renderedAt;

            if ($elapsed >= 0 && $elapsed < $minSeconds) {
                ApiResponse::error("Pengisian formulir terlalu cepat (dicurigai otomatisasi bot). Silakan ulangi dengan wajar.", 400);
            }
        }

        // 3. Suspicious User-Agent Check
        $userAgent = strtolower($_SERVER['HTTP_USER_AGENT'] ?? '');
        $suspiciousPatterns = ['sqlmap', 'nikto', 'havij', 'masscan', 'acunetix'];
        foreach ($suspiciousPatterns as $pattern) {
            if (str_contains($userAgent, $pattern)) {
                ApiResponse::error("Permintaan ditolak karena terdeteksi aktivitas scanner mencurigakan.", 403);
            }
        }
    }
}

