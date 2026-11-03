<?php
/**
 * Test Suite for Authentication & Session Management
 * Tests:
 * 1. Session creation
 * 2. Session regeneration after login (anti-fixation)
 * 3. Session expiration (absolute lifetime & idle timeout)
 * 4. Tab revisit validation (touch last_activity_at)
 * 5. Session revocation / destruction on logout
 */

declare(strict_types=1);

require_once __DIR__ . '/../src/models/User.php';
require_once __DIR__ . '/../src/models/Session.php';
require_once __DIR__ . '/../src/utils/JWT.php';

echo "=== RUNNING SESSION & AUTHENTICATION UNIT TESTS ===" . PHP_EOL;

// Setup in-memory SQLite database
$db = new PDO('sqlite::memory:');
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// 1. Create users table
$db->exec("
    CREATE TABLE users (
        id VARCHAR(50) PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'User',
        created_at DATETIME NOT NULL
    )
");

// 2. Initialize sessions table
Session::ensureTableExists($db);

// Seed a test user
$user = User::create($db, [
    'username' => 'testuser',
    'email' => 'test@example.com',
    'password' => 'secret12345',
    'role' => 'User',
]);

assert(!empty($user['id']), "User creation failed");
echo "✅ Test 1: User created successfully (ID: {$user['id']})" . PHP_EOL;

// Test 2: Create initial session
$secret = 'test_secret_key_1234567890123456';
$token1 = JWT::encode(['sub' => $user['id'], 'sid' => 'sess_1', 'exp' => time() + 3600], $secret);

$session1 = Session::create($db, $user['id'], $token1, 60, null, 'sess_1');
assert(!empty($session1['id']), "Session creation failed");
assert($session1['is_active'] === 1, "Session must be active initially");
echo "✅ Test 2: Initial session created (Session ID: {$session1['id']})" . PHP_EOL;

// Test 3: Session Validation (Tab reopen scenario)
$validated = Session::validate($db, $token1, 120);
assert($validated !== null, "Session 1 must be valid");
assert($validated['id'] === $session1['id'], "Validated session ID mismatch");
echo "✅ Test 3: Session successfully validated for tab reopen" . PHP_EOL;

// Test 4: Session Regeneration upon Login (Anti-Fixation)
$token2 = JWT::encode(['sub' => $user['id'], 'sid' => 'sess_2', 'exp' => time() + 3600], $secret);
$session2 = Session::regenerate($db, $user['id'], $token1, $token2, 60);

assert($session2['id'] !== $session1['id'], "Regenerated session ID must be different from previous");
echo "✅ Test 4: Session regenerated with new ID (Old: {$session1['id']}, New: {$session2['id']})" . PHP_EOL;

// Verify old session was revoked during regeneration
$oldValidated = Session::validate($db, $token1, 120);
assert($oldValidated === null, "Old session must be invalidated after regeneration");
echo "✅ Test 5: Old session token rejected after regeneration" . PHP_EOL;

// Verify new session is valid
$newValidated = Session::validate($db, $token2, 120);
assert($newValidated !== null, "New regenerated session must be valid");
echo "✅ Test 6: New regenerated session is active and valid" . PHP_EOL;

// Test 7: Expiration Check (Past expiration date)
$expiredToken = JWT::encode(['sub' => $user['id'], 'sid' => 'sess_exp', 'exp' => time() + 3600], $secret);
$expiredSession = Session::create($db, $user['id'], $expiredToken, -10, null, 'sess_exp'); // Expired 10 minutes ago
$expiredCheck = Session::validate($db, $expiredToken, 120);
assert($expiredCheck === null, "Expired session must return null");
echo "✅ Test 7: Expired session correctly rejected by lifetime check" . PHP_EOL;

// Test 8: Idle Timeout Check
$idleToken = JWT::encode(['sub' => $user['id'], 'sid' => 'sess_idle', 'exp' => time() + 3600], $secret);
$idleSession = Session::create($db, $user['id'], $idleToken, 60, null, 'sess_idle');
// Manually backdate last_activity_at to 3 hours ago
$pastTime = gmdate('Y-m-d H:i:s', time() - (180 * 60));
$db->exec("UPDATE sessions SET last_activity_at = '{$pastTime}' WHERE id = '{$idleSession['id']}'");
$idleCheck = Session::validate($db, $idleToken, 120); // 120 min idle limit
assert($idleCheck === null, "Idle timed out session must return null");
echo "✅ Test 8: Inactive session correctly rejected by idle timeout check" . PHP_EOL;

// Test 9: Logout & Session Revocation
$logoutToken = JWT::encode(['sub' => $user['id'], 'sid' => 'sess_logout', 'exp' => time() + 3600], $secret);
$logoutSession = Session::create($db, $user['id'], $logoutToken, 60, null, 'sess_logout');
assert(Session::validate($db, $logoutToken, 120) !== null, "Session must be valid before logout");

// User logs out
$revoked = Session::revoke($db, $logoutToken);
assert($revoked === true, "Session revocation should return true");

// Attempt to use revoked session
$afterLogout = Session::validate($db, $logoutToken, 120);
assert($afterLogout === null, "Revoked session must be completely rejected after logout");
echo "✅ Test 9: Session successfully deleted/revoked upon logout" . PHP_EOL;

echo "🎉 ALL TESTS PASSED SUCCESSFULLY!" . PHP_EOL;
