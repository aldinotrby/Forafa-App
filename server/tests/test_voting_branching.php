<?php
/**
 * Test Suite for Voting Branching System
 * Tests:
 * 1. Creating questions structure in database
 * 2. Linking multiple questions to a single voting link
 * 3. Position relationships (ketua, wakil, sekretaris, bendahara)
 * 4. Question ordering (sort_order & reorder)
 * 5. Active and inactive question conditions (is_active)
 * 6. Answer validation & conflict prevention (preventing duplicate roles for same candidate)
 */

declare(strict_types=1);

require_once __DIR__ . '/../src/models/User.php';
require_once __DIR__ . '/../src/models/Interaction.php';
require_once __DIR__ . '/../src/models/VotingQuestion.php';
require_once __DIR__ . '/../src/models/Response.php';

echo "=== RUNNING VOTING BRANCHING & CONFLICT VALIDATION TESTS ===" . PHP_EOL;

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

// Initialize tables via models
ResponseModel::ensureTablesExist($db);
VotingQuestion::ensureTablesExist($db);

// Seed Interaction: Pemilihan Pengurus RT
$interactionId = 'i_rt_2026';
$stmtInt = $db->prepare("INSERT INTO interactions VALUES (:id, 'u_budi', 'vote', 'Pemilihan Pengurus RT 05', 'Pilih pengurus RT', 'pemilihan-pengurus-rt', 1, null, null, '[]', :now)");
$stmtInt->execute([':id' => $interactionId, ':now' => date('Y-m-d H:i:s')]);

echo "✅ Test 1: Created voting interaction link" . PHP_EOL;

// -----------------------------------------------------------------------------
// Test 2: Add multiple questions (Ketua, Wakil, Sekretaris, Bendahara) to one link
// -----------------------------------------------------------------------------
$qKetua = VotingQuestion::create($db, $interactionId, [
    'role_key' => 'ketua',
    'title' => 'Pilih Ketua RT',
    'options' => ['Pak Suryo', 'Bu Ratna', 'Pak Hasan'],
    'sort_order' => 1,
    'is_active' => 1,
]);

$qWakil = VotingQuestion::create($db, $interactionId, [
    'role_key' => 'wakil',
    'title' => 'Pilih Wakil Ketua RT',
    'options' => ['Pak Suryo', 'Bu Ratna', 'Pak Hasan'],
    'sort_order' => 2,
    'is_active' => 1,
    'depends_on_question_id' => $qKetua['id'],
]);

$qSekretaris = VotingQuestion::create($db, $interactionId, [
    'role_key' => 'sekretaris',
    'title' => 'Pilih Sekretaris RT',
    'options' => ['Bu Ani', 'Pak Joko', 'Siti'],
    'sort_order' => 3,
    'is_active' => 1,
    'depends_on_question_id' => $qKetua['id'],
]);

$qBendahara = VotingQuestion::create($db, $interactionId, [
    'role_key' => 'bendahara',
    'title' => 'Pilih Bendahara RT',
    'options' => ['Bu Dewi', 'Pak Hendra', 'Siti'],
    'sort_order' => 4,
    'is_active' => 1,
    'depends_on_question_id' => $qKetua['id'],
]);

$allQuestions = VotingQuestion::getByInteraction($db, $interactionId, false);
assert(count($allQuestions) === 4, "Must have 4 questions linked to the interaction");
echo "✅ Test 2: Successfully linked 4 questions (Ketua, Wakil, Sekretaris, Bendahara) in one link" . PHP_EOL;

// -----------------------------------------------------------------------------
// Test 3: Question Ordering & Reordering
// -----------------------------------------------------------------------------
assert($allQuestions[0]['role_key'] === 'ketua', "First question must be ketua");
assert($allQuestions[1]['role_key'] === 'wakil', "Second question must be wakil");
assert($allQuestions[2]['role_key'] === 'sekretaris', "Third question must be sekretaris");
assert($allQuestions[3]['role_key'] === 'bendahara', "Fourth question must be bendahara");

// Reorder: put Sekretaris before Wakil
VotingQuestion::reorder($db, $interactionId, [
    $qKetua['id'],
    $qSekretaris['id'],
    $qWakil['id'],
    $qBendahara['id'],
]);

$reordered = VotingQuestion::getByInteraction($db, $interactionId, false);
assert($reordered[1]['role_key'] === 'sekretaris', "Second question should now be sekretaris after reorder");
assert($reordered[2]['role_key'] === 'wakil', "Third question should now be wakil after reorder");
echo "✅ Test 3: Question ordering and reordering verified" . PHP_EOL;

// Restore original order
VotingQuestion::reorder($db, $interactionId, [
    $qKetua['id'],
    $qWakil['id'],
    $qSekretaris['id'],
    $qBendahara['id'],
]);

// -----------------------------------------------------------------------------
// Test 4: Question Active / Inactive State Conditions
// -----------------------------------------------------------------------------
// Deactivate Bendahara question
VotingQuestion::update($db, $qBendahara['id'], ['is_active' => 0]);

$activeOnly = VotingQuestion::getByInteraction($db, $interactionId, true);
assert(count($activeOnly) === 3, "Only 3 active questions should be returned");
$activeRoleKeys = array_column($activeOnly, 'role_key');
assert(!in_array('bendahara', $activeRoleKeys, true), "Inactive question bendahara must be excluded");
echo "✅ Test 4: Active and inactive question conditions verified" . PHP_EOL;

// Reactivate Bendahara question
VotingQuestion::update($db, $qBendahara['id'], ['is_active' => 1]);
$activeQuestions = VotingQuestion::getByInteraction($db, $interactionId, true);
assert(count($activeQuestions) === 4, "All 4 questions active again");

// -----------------------------------------------------------------------------
// Test 5: Answer Validation - Valid Non-Conflicting Choices
// -----------------------------------------------------------------------------
$validAnswers = [
    $qKetua['id'] => 'Pak Suryo',
    $qWakil['id'] => 'Bu Ratna',
    $qSekretaris['id'] => 'Bu Ani',
    $qBendahara['id'] => 'Bu Dewi',
];

$validErr = VotingQuestion::validateAnswers($activeQuestions, $validAnswers);
assert($validErr === null, "Valid distinct choices must have no conflict");
echo "✅ Test 5: Valid distinct choices successfully validated without errors" . PHP_EOL;

// -----------------------------------------------------------------------------
// Test 6: Answer Validation - CONFLICT: Same candidate for Ketua and Wakil!
// -----------------------------------------------------------------------------
$conflictingAnswers1 = [
    $qKetua['id'] => 'Pak Suryo',
    $qWakil['id'] => 'Pak Suryo', // CONFLICT! Same candidate chosen for both!
    $qSekretaris['id'] => 'Bu Ani',
    $qBendahara['id'] => 'Bu Dewi',
];

$err1 = VotingQuestion::validateAnswers($activeQuestions, $conflictingAnswers1);
assert($err1 !== null, "Must detect conflict when same candidate is selected for Ketua and Wakil");
assert(str_contains($err1, 'Pilihan bertentangan') && str_contains($err1, 'Pak Suryo'), "Error must detail conflicting candidate");
echo "✅ Test 6: Conflicting choice detected: candidate cannot hold both Ketua and Wakil" . PHP_EOL;

// -----------------------------------------------------------------------------
// Test 7: Answer Validation - CONFLICT: Same candidate for Sekretaris and Bendahara!
// -----------------------------------------------------------------------------
$conflictingAnswers2 = [
    $qKetua['id'] => 'Pak Suryo',
    $qWakil['id'] => 'Bu Ratna',
    $qSekretaris['id'] => 'Siti',
    $qBendahara['id'] => 'Siti', // CONFLICT! Siti cannot hold both Sekretaris and Bendahara!
];

$err2 = VotingQuestion::validateAnswers($activeQuestions, $conflictingAnswers2);
assert($err2 !== null, "Must detect conflict when same candidate is selected for Sekretaris and Bendahara");
assert(str_contains($err2, 'Pilihan bertentangan') && str_contains($err2, 'Siti'), "Error must detail conflicting candidate Siti");
echo "✅ Test 7: Conflicting choice detected: candidate cannot hold both Sekretaris and Bendahara" . PHP_EOL;

// -----------------------------------------------------------------------------
// Test 8: Answer Validation - Invalid Candidate Option
// -----------------------------------------------------------------------------
$invalidCandidateAnswers = [
    $qKetua['id'] => 'Pak Bambang', // Not in ['Pak Suryo', 'Bu Ratna', 'Pak Hasan']
    $qWakil['id'] => 'Bu Ratna',
    $qSekretaris['id'] => 'Bu Ani',
    $qBendahara['id'] => 'Bu Dewi',
];

$err3 = VotingQuestion::validateAnswers($activeQuestions, $invalidCandidateAnswers);
assert($err3 !== null, "Must reject candidate not in available options");
assert(str_contains($err3, 'tidak valid'), "Error must mention invalid option");
echo "✅ Test 8: Invalid candidate option rejected" . PHP_EOL;

// -----------------------------------------------------------------------------
// Test 9: Answer Validation - Missing / Incomplete Answer
// -----------------------------------------------------------------------------
$incompleteAnswers = [
    $qKetua['id'] => 'Pak Suryo',
    $qWakil['id'] => 'Bu Ratna',
    // Sekretaris missing!
    $qBendahara['id'] => 'Bu Dewi',
];

$err4 = VotingQuestion::validateAnswers($activeQuestions, $incompleteAnswers);
assert($err4 !== null, "Must reject incomplete answers");
assert(str_contains($err4, 'wajib dijawab'), "Error must indicate question is required");
echo "✅ Test 9: Incomplete answers for active questions rejected" . PHP_EOL;

// -----------------------------------------------------------------------------
// Test 10: Saving Granular Answers & Loading via ResponseModel
// -----------------------------------------------------------------------------
$response = ResponseModel::create($db, [
    'interaction_id' => $interactionId,
    'name' => 'Warga 1',
    'choice' => 'Ketua: Pak Suryo, Wakil: Bu Ratna, Sekretaris: Bu Ani, Bendahara: Bu Dewi',
    'is_anonymous' => false,
]);

$saved = VotingQuestion::saveAnswers($db, $response['id'], $activeQuestions, $validAnswers);
assert(count($saved) === 4, "Must save 4 answers");

$fetchedResp = ResponseModel::findById($db, $response['id']);
assert(!empty($fetchedResp['answers']), "Fetched response must contain answers");
assert(count($fetchedResp['answers']) === 4, "Must contain all 4 answers");
assert($fetchedResp['answers'][0]['choice'] === 'Pak Suryo', "First answer must be Pak Suryo");
assert($fetchedResp['answers'][1]['choice'] === 'Bu Ratna', "Second answer must be Bu Ratna");
echo "✅ Test 10: Granular answers saved and successfully loaded with response" . PHP_EOL;

echo "🎉 ALL VOTING BRANCHING & CONFLICT VALIDATION TESTS PASSED SUCCESSFULLY!" . PHP_EOL;

