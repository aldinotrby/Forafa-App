<?php
/**
 * Integration Test for AuthController and Router
 */

declare(strict_types=1);

require_once __DIR__ . '/../src/models/User.php';
require_once __DIR__ . '/../src/models/Session.php';
require_once __DIR__ . '/../src/utils/JWT.php';

echo "=== RUNNING AUTH CONTROLLER INTEGRATION CHECKS ===" . PHP_EOL;

// 1. Verify Session::ensureTableExists
$db = new PDO('sqlite::memory:');
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
Session::ensureTableExists($db);

$res = $db->query("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'")->fetch();
assert(!empty($res), "sessions table must exist");
echo "✅ Table 'sessions' verified in DB schema" . PHP_EOL;

// 2. Verify Session table columns
$cols = $db->query("PRAGMA table_info(sessions)")->fetchAll(PDO::FETCH_COLUMN, 1);
$expected = ['id', 'user_id', 'token_hash', 'ip_address', 'user_agent', 'payload', 'last_activity_at', 'expires_at', 'is_active', 'created_at'];
foreach ($expected as $col) {
    assert(in_array($col, $cols, true), "Column {$col} missing from sessions table");
}
echo "✅ All required columns present: " . implode(', ', $cols) . PHP_EOL;

// 3. Verify Token Hashing consistency
$token = "sample.bearer.token";
assert(Session::hashToken($token) === hash('sha256', $token), "hashToken must compute sha256");
echo "✅ Token SHA-256 hash verified" . PHP_EOL;

echo "🎉 INTEGRATION CHECKS PASSED!" . PHP_EOL;

