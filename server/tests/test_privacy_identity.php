<?php
/**
 * Test Suite for Identity Privacy & Link Creator Access Controls
 * Tests:
 * 1. Storing anonymous vs real-name choice (is_anonymous)
 * 2. Separation of identity data (`response_identities`) from voting answers (`responses`)
 * 3. Link creator access control
 * 4. Admin CANNOT see identity of anonymous voters (name is masked to null)
 * 5. Link creator can ONLY see identity if respondent chose to show name (is_anonymous = 0)
 * 6. CSV export privacy masking
 */

declare(strict_types=1);

require_once __DIR__ . '/../src/models/User.php';
require_once __DIR__ . '/../src/models/Interaction.php';
require_once __DIR__ . '/../src/models/Response.php';

echo "=== RUNNING IDENTITY PRIVACY & ACCESS CONTROL TESTS ===" . PHP_EOL;

// Setup in-memory SQLite database
$db = new PDO('sqlite::memory:');
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// 1. Create tables
$db->exec("
    CREATE TABLE users (
        id VARCHAR(50) PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'User',
        created_at DATETIME NOT NULL
    );

    CREATE TABLE interactions (
        id VARCHAR(50) PRIMARY KEY,
        owner_id VARCHAR(50) NOT NULL,
        kind VARCHAR(20) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        slug VARCHAR(100) NOT NULL UNIQUE,
        active INTEGER NOT NULL DEFAULT 1,
        start VARCHAR(30) NULL,
        end VARCHAR(30) NULL,
        options TEXT NOT NULL,
        created_at DATETIME NOT NULL
    );

    CREATE TABLE responses (
        id VARCHAR(50) PRIMARY KEY,
        interaction_id VARCHAR(50) NOT NULL,
        name VARCHAR(100) NULL,
        choice VARCHAR(255) NULL,
        message TEXT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'Baru',
        reply TEXT NULL,
        shared INTEGER NOT NULL DEFAULT 0,
        is_anonymous INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL
    );
");

// Initialize response_identities table via model
ResponseModel::ensureTablesExist($db);

// Seed users: Creator 1, Creator 2, Admin
$creator1 = ['id' => 'u_creator1', 'username' => 'rina', 'role' => 'User'];
$creator2 = ['id' => 'u_creator2', 'username' => 'budi', 'role' => 'User'];
$admin = ['id' => 'u_admin', 'username' => 'admin', 'role' => 'Administrator'];

// Seed voting interaction owned by Creator 1
$voteInteraction = [
    'id' => 'i_vote1',
    'owner_id' => $creator1['id'],
    'kind' => 'vote',
    'title' => 'Pemilihan Nama Lapangan Warga',
    'description' => 'Pilih salah satu nama',
    'slug' => 'lapangan-warga',
    'active' => 1,
    'options' => json_encode(['Opsi A', 'Opsi B']),
    'created_at' => date('Y-m-d H:i:s'),
];

$stmt = $db->prepare("INSERT INTO interactions VALUES (:id, :owner_id, :kind, :title, :description, :slug, :active, null, null, :options, :created_at)");
$stmt->execute($voteInteraction);
echo "✅ Test 1: Seeded voting interaction owned by Creator 1" . PHP_EOL;

// -----------------------------------------------------------------------------
// Test 2: Submitting a vote with REAL NAME (is_anonymous = 0)
// -----------------------------------------------------------------------------
$voteReal = ResponseModel::create($db, [
    'interaction_id' => 'i_vote1',
    'name' => 'Ahmad Subagyo',
    'choice' => 'Opsi A',
    'is_anonymous' => false,
]);

assert($voteReal['is_anonymous'] === false, "is_anonymous must be false");
assert($voteReal['name'] === 'Ahmad Subagyo', "Name must be present in created object for real name");

// Verify data separation in database
$rawRespReal = $db->query("SELECT * FROM responses WHERE id = '{$voteReal['id']}'")->fetch(PDO::FETCH_ASSOC);
$rawIdentReal = $db->query("SELECT * FROM response_identities WHERE response_id = '{$voteReal['id']}'")->fetch(PDO::FETCH_ASSOC);

assert(!empty($rawIdentReal), "Identity record must exist in response_identities");
assert($rawIdentReal['name'] === 'Ahmad Subagyo', "Identity record name must match");
assert((int)$rawIdentReal['is_anonymous'] === 0, "Identity record is_anonymous must be 0");
echo "✅ Test 2: Vote with Real Name created and recorded in both separated tables" . PHP_EOL;

// -----------------------------------------------------------------------------
// Test 3: Submitting a vote with ANONYMOUS choice (is_anonymous = 1)
// -----------------------------------------------------------------------------
$voteAnon = ResponseModel::create($db, [
    'interaction_id' => 'i_vote1',
    'name' => 'Siti Rahmawati', // Name was supplied but user checked anonymous!
    'choice' => 'Opsi B',
    'is_anonymous' => true,
]);

assert($voteAnon['is_anonymous'] === true, "is_anonymous must be true");
assert($voteAnon['name'] === null, "Name must be masked to null for anonymous vote");

// Verify physical data separation in database
$rawRespAnon = $db->query("SELECT * FROM responses WHERE id = '{$voteAnon['id']}'")->fetch(PDO::FETCH_ASSOC);
$rawIdentAnon = $db->query("SELECT * FROM response_identities WHERE response_id = '{$voteAnon['id']}'")->fetch(PDO::FETCH_ASSOC);

assert($rawRespAnon['name'] === null, "In responses table, name must be NULL to decouple answer from identity");
assert((int)$rawRespAnon['is_anonymous'] === 1, "In responses table, is_anonymous must be 1");
assert(!empty($rawIdentAnon), "In response_identities table, identity record exists");
assert((int)$rawIdentAnon['is_anonymous'] === 1, "In response_identities table, is_anonymous must be 1");
echo "✅ Test 3: Data separation verified: voting answer decoupled from identity for anonymous vote" . PHP_EOL;

// -----------------------------------------------------------------------------
// Test 4: Privacy Rule - Admin CANNOT see identity of anonymous voter
// -----------------------------------------------------------------------------
$anonFetchedForAdmin = ResponseModel::findById($db, $voteAnon['id']);
$adminView = ResponseModel::formatWithPrivacy($anonFetchedForAdmin, $admin, $voteInteraction);

assert($adminView['name'] === null, "Admin MUST NOT be able to view identity of anonymous voter");
assert($adminView['is_anonymous'] === true, "is_anonymous flag must remain true");
echo "✅ Test 4: Admin strictly forbidden from seeing anonymous voter identity (name = null)" . PHP_EOL;

// -----------------------------------------------------------------------------
// Test 5: Privacy Rule - Creator CANNOT see identity of anonymous voter
// -----------------------------------------------------------------------------
$creatorViewAnon = ResponseModel::formatWithPrivacy($anonFetchedForAdmin, $creator1, $voteInteraction);

assert($creatorViewAnon['name'] === null, "Creator MUST NOT be able to view identity of anonymous voter");
assert($creatorViewAnon['is_anonymous'] === true, "is_anonymous must be true");
echo "✅ Test 5: Link creator strictly forbidden from seeing anonymous voter identity (name = null)" . PHP_EOL;

// -----------------------------------------------------------------------------
// Test 6: Privacy Rule - Creator CAN see identity if respondent chose real name
// -----------------------------------------------------------------------------
$realFetched = ResponseModel::findById($db, $voteReal['id']);
$creatorViewReal = ResponseModel::formatWithPrivacy($realFetched, $creator1, $voteInteraction);

assert($creatorViewReal['name'] === 'Ahmad Subagyo', "Creator MUST see real name when respondent chose real name");
assert($creatorViewReal['is_anonymous'] === false, "is_anonymous must be false");
echo "✅ Test 6: Link creator can see real name when respondent opted to show name" . PHP_EOL;

// -----------------------------------------------------------------------------
// Test 7: Privacy Rule - Other users (non-creator, non-admin) cannot see names
// -----------------------------------------------------------------------------
$otherUserView = ResponseModel::formatWithPrivacy($realFetched, $creator2, $voteInteraction);
assert($otherUserView['name'] === null, "Non-creator cannot see respondent name");
echo "✅ Test 7: Non-creator user cannot see respondent identity" . PHP_EOL;

// -----------------------------------------------------------------------------
// Test 8: CSV Export Privacy Masking
// -----------------------------------------------------------------------------
$responsesList = [
    ResponseModel::formatWithPrivacy($realFetched, $creator1, $voteInteraction),
    ResponseModel::formatWithPrivacy($anonFetchedForAdmin, $creator1, $voteInteraction),
];

$csvContent = ResponseModel::generateCsv($responsesList, 'Pemilihan Nama Lapangan Warga');
assert(str_contains($csvContent, 'Ahmad Subagyo'), "CSV must contain Ahmad Subagyo for real-name vote");
assert(str_contains($csvContent, 'Anonim'), "CSV must contain 'Anonim' for anonymous vote");
assert(!str_contains($csvContent, 'Siti Rahmawati'), "CSV MUST NOT contain the real name of anonymous voter!");
echo "✅ Test 8: CSV export correctly masks anonymous voter name to 'Anonim'" . PHP_EOL;

echo "🎉 ALL IDENTITY PRIVACY & ACCESS CONTROL TESTS PASSED SUCCESSFULLY!" . PHP_EOL;

