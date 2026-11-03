<?php
/**
 * Lightweight Native PHP JWT (JSON Web Token) Implementation (HS256)
 * No third-party packages required.
 */

declare(strict_types=1);

class JWT {
    /**
     * Encode payload into JWT string
     */
    public static function encode(array $payload, string $secret): string {
        $header = [
            'alg' => 'HS256',
            'typ' => 'JWT',
        ];

        $headerEncoded = self::base64UrlEncode(json_encode($header, JSON_UNESCAPED_SLASHES));
        $payloadEncoded = self::base64UrlEncode(json_encode($payload, JSON_UNESCAPED_SLASHES));

        $signature = hash_hmac('sha256', "{$headerEncoded}.{$payloadEncoded}", $secret, true);
        $signatureEncoded = self::base64UrlEncode($signature);

        return "{$headerEncoded}.{$payloadEncoded}.{$signatureEncoded}";
    }

    /**
     * Decode and verify JWT string. Returns payload array or null if invalid/expired.
     */
    public static function decode(string $token, string $secret): ?array {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }

        [$headerEncoded, $payloadEncoded, $signatureEncoded] = $parts;

        $headerJson = self::base64UrlDecode($headerEncoded);
        $payloadJson = self::base64UrlDecode($payloadEncoded);
        $signature = self::base64UrlDecode($signatureEncoded);

        if (!$headerJson || !$payloadJson) {
            return null;
        }

        $header = json_decode($headerJson, true);
        if (!is_array($header) || ($header['alg'] ?? '') !== 'HS256') {
            return null;
        }

        // Verify signature using constant-time comparison
        $expectedSignature = hash_hmac('sha256', "{$headerEncoded}.{$payloadEncoded}", $secret, true);
        if (!hash_equals($expectedSignature, $signature)) {
            return null;
        }

        $payload = json_decode($payloadJson, true);
        if (!is_array($payload)) {
            return null;
        }

        // Verify expiration
        if (isset($payload['exp']) && time() >= (int)$payload['exp']) {
            return null;
        }

        return $payload;
    }

    private static function base64UrlEncode(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $data): string|false {
        $remainder = strlen($data) % 4;
        if ($remainder) {
            $data .= str_repeat('=', 4 - $remainder);
        }
        return base64_decode(strtr($data, '-_', '+/'));
    }
}
