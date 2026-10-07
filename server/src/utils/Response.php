<?php
/**
 * HTTP Response Helper
 */

declare(strict_types=1);

class ApiResponse {
    /**
     * Send JSON response and exit
     */
    public static function json(mixed $data, int $statusCode = 200): void {
        http_response_code($statusCode);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    /**
     * Send standard error response and exit
     */
    public static function error(string $message, int $statusCode = 400): void {
        self::json(['detail' => $message], $statusCode);
    }

    /**
     * Send empty 204 No Content response and exit
     */
    public static function noContent(): void {
        http_response_code(204);
        exit;
    }

    /**
     * Send CSV file download and exit
     */
    public static function csv(string $content, string $filename = 'export.csv'): void {
        http_response_code(200);
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Pragma: no-cache');
        header('Expires: 0');
        echo $content;
        exit;
    }
}
