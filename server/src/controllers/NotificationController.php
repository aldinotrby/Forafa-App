<?php
/**
 * Notifications Controller
 * Notifikasi privat per akun pengguna (mis. balasan dari pembuat link).
 */

declare(strict_types=1);

require_once __DIR__ . '/../models/Notification.php';
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../middlewares/AuthMiddleware.php';
require_once __DIR__ . '/../config/database.php';

class NotificationController {
    /**
     * GET /notifications
     * Daftar notifikasi milik pengguna yang login.
     * Query opsional: ?unread=1 untuk notifikasi yang belum dibaca.
     */
    public static function list(): void {
        $currentUser = AuthMiddleware::authenticate();

        $unreadOnly = !empty($_GET['unread']) && strtolower((string)$_GET['unread']) !== '0';
        $limit = max(1, min(200, (int)($_GET['limit'] ?? 100)));

        $db = Database::getConnection();
        $notifications = Notification::getByUser($db, $currentUser['id'], $unreadOnly, $limit);

        ApiResponse::json($notifications, 200);
    }

    /**
     * GET /notifications/unread-count
     * Jumlah notifikasi belum dibaca.
     */
    public static function unreadCount(): void {
        $currentUser = AuthMiddleware::authenticate();

        $db = Database::getConnection();
        ApiResponse::json(['unread' => Notification::unreadCount($db, $currentUser['id'])], 200);
    }

    /**
     * POST /notifications/{id}/read
     * Tandai satu notifikasi sebagai dibaca (hanya milik sendiri).
     */
    public static function markRead(string $id): void {
        $currentUser = AuthMiddleware::authenticate();

        $db = Database::getConnection();
        $ok = Notification::markRead($db, $id, $currentUser['id']);

        if (!$ok) {
            ApiResponse::error("Notifikasi tidak ditemukan.", 404);
        }

        ApiResponse::json(['message' => 'Notifikasi ditandai sudah dibaca.'], 200);
    }

    /**
     * POST /notifications/read-all
     * Tandai semua notifikasi pengguna sebagai dibaca.
     */
    public static function markAllRead(): void {
        $currentUser = AuthMiddleware::authenticate();

        $db = Database::getConnection();
        $updated = Notification::markAllRead($db, $currentUser['id']);

        ApiResponse::json(['message' => 'Semua notifikasi ditandai sudah dibaca.', 'updated' => $updated], 200);
    }
}
