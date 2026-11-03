<?php
/**
 * Analytics & Statistics Controller
 * Applies privacy filtering so anonymous responders remain anonymous across summaries.
 */

declare(strict_types=1);

require_once __DIR__ . '/../models/Interaction.php';
require_once __DIR__ . '/../models/Response.php';
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../middlewares/AuthMiddleware.php';
require_once __DIR__ . '/../config/database.php';

class AnalyticsController {
    /**
     * GET /analytics/overview (Administrator Only)
     */
    public static function overview(): void {
        $adminUser = AuthMiddleware::requireAdmin();

        $db = Database::getConnection();
        ResponseModel::ensureTablesExist($db);

        // 1. Total regular users
        $stmtUsers = $db->query("SELECT COUNT(*) AS total FROM users WHERE role = 'User'");
        $totalUsers = (int)($stmtUsers->fetch()['total'] ?? 0);

        // 2. All interactions
        $allInteractions = $db->query("SELECT id, kind, title FROM interactions")->fetchAll();
        $totalInteractions = count($allInteractions);

        $interactionKindMap = [];
        $interactionTitleMap = [];
        $byKind = [
            'vote' => ['total_interactions' => 0, 'total_responses' => 0],
            'feedback' => ['total_interactions' => 0, 'total_responses' => 0],
            'anon' => ['total_interactions' => 0, 'total_responses' => 0],
        ];

        foreach ($allInteractions as $i) {
            $interactionKindMap[$i['id']] = $i['kind'];
            $interactionTitleMap[$i['id']] = $i['title'];
            if (isset($byKind[$i['kind']])) {
                $byKind[$i['kind']]['total_interactions']++;
            }
        }

        // 3. All responses count
        $allResponses = $db->query("SELECT id, interaction_id FROM responses")->fetchAll();
        $totalResponses = count($allResponses);

        foreach ($allResponses as $r) {
            $kind = $interactionKindMap[$r['interaction_id']] ?? null;
            if ($kind && isset($byKind[$kind])) {
                $byKind[$kind]['total_responses']++;
            }
        }

        // 4. Recent responses (limit 8) with privacy masking for admin
        $stmtRecent = $db->query("
            SELECT r.*, ri.name AS identity_name, COALESCE(r.is_anonymous, ri.is_anonymous, 0) AS is_anonymous
            FROM responses r
            LEFT JOIN response_identities ri ON ri.response_id = r.id
            ORDER BY r.created_at DESC 
            LIMIT 8
        ");
        $recentRows = $stmtRecent->fetchAll();
        $recentResponses = array_map(function($r) use ($interactionTitleMap, $adminUser) {
            $formatted = ResponseModel::formatWithPrivacy($r, $adminUser);
            $formatted['interaction_title'] = $interactionTitleMap[$r['interaction_id']] ?? 'Interaksi';
            return $formatted;
        }, $recentRows);

        ApiResponse::json([
            'total_users' => $totalUsers,
            'total_interactions' => $totalInteractions,
            'total_responses' => $totalResponses,
            'by_kind' => $byKind,
            'recent_responses' => $recentResponses,
        ], 200);
    }

    /**
     * GET /analytics/user-stats (Authenticated User / Admin)
     */
    public static function userStats(): void {
        $currentUser = AuthMiddleware::authenticate();
        $userId = $currentUser['id'];

        $db = Database::getConnection();
        ResponseModel::ensureTablesExist($db);

        // 1. User's interactions
        $stmt = $db->prepare("SELECT id, kind, title FROM interactions WHERE owner_id = :owner_id");
        $stmt->execute([':owner_id' => $userId]);
        $userInteractions = $stmt->fetchAll();

        $totalInteractions = count($userInteractions);
        $interactionIds = array_column($userInteractions, 'id');

        $byKind = [
            'vote' => ['total_interactions' => 0, 'total_responses' => 0],
            'feedback' => ['total_interactions' => 0, 'total_responses' => 0],
            'anon' => ['total_interactions' => 0, 'total_responses' => 0],
        ];

        $interactionKindMap = [];
        $interactionTitleMap = [];

        foreach ($userInteractions as $i) {
            $interactionKindMap[$i['id']] = $i['kind'];
            $interactionTitleMap[$i['id']] = $i['title'];
            if (isset($byKind[$i['kind']])) {
                $byKind[$i['kind']]['total_interactions']++;
            }
        }

        $totalResponses = 0;
        $recentResponses = [];

        if (!empty($interactionIds)) {
            $placeholders = implode(',', array_fill(0, count($interactionIds), '?'));
            
            // Total responses count
            $stmtCount = $db->prepare("SELECT COUNT(*) AS total FROM responses WHERE interaction_id IN ($placeholders)");
            $stmtCount->execute($interactionIds);
            $totalResponses = (int)($stmtCount->fetch()['total'] ?? 0);

            // Group by kind count
            $stmtAllResp = $db->prepare("SELECT interaction_id FROM responses WHERE interaction_id IN ($placeholders)");
            $stmtAllResp->execute($interactionIds);
            foreach ($stmtAllResp->fetchAll() as $r) {
                $kind = $interactionKindMap[$r['interaction_id']] ?? null;
                if ($kind && isset($byKind[$kind])) {
                    $byKind[$kind]['total_responses']++;
                }
            }

            // Recent responses for this user's interactions with privacy masking
            $stmtRecent = $db->prepare("
                SELECT r.*, ri.name AS identity_name, COALESCE(r.is_anonymous, ri.is_anonymous, 0) AS is_anonymous
                FROM responses r
                LEFT JOIN response_identities ri ON ri.response_id = r.id
                WHERE r.interaction_id IN ($placeholders) 
                ORDER BY r.created_at DESC 
                LIMIT 8
            ");
            $stmtRecent->execute($interactionIds);
            $recentRows = $stmtRecent->fetchAll();
            $recentResponses = array_map(function($r) use ($interactionTitleMap, $currentUser) {
                $formatted = ResponseModel::formatWithPrivacy($r, $currentUser);
                $formatted['interaction_title'] = $interactionTitleMap[$r['interaction_id']] ?? 'Interaksi';
                return $formatted;
            }, $recentRows);
        }

        ApiResponse::json([
            'total_interactions' => $totalInteractions,
            'total_responses' => $totalResponses,
            'by_kind' => $byKind,
            'recent_responses' => $recentResponses,
        ], 200);
    }
}
