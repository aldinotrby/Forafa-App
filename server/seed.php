<?php
/**
 * Forafa-App — Standalone Database Seeder Script
 * Run via terminal: php seed.php
 */

declare(strict_types=1);

require_once __DIR__ . '/src/config/database.php';
require_once __DIR__ . '/src/models/User.php';
require_once __DIR__ . '/src/models/Interaction.php';
require_once __DIR__ . '/src/models/Response.php';

try {
    echo "🌱 Memulai seeding data awal ke MySQL..." . PHP_EOL;

    $db = Database::getConnection();

    // Check if users already seeded
    $stmt = $db->query("SELECT COUNT(*) AS total FROM users");
    $count = (int)($stmt->fetch()['total'] ?? 0);

    if ($count > 0) {
        echo "ℹ️ Database sudah memiliki {$count} data user. Seeding dilewati agar tidak menimpa data." . PHP_EOL;
        echo "💡 Jika ingin mengulang dari awal, silakan jalankan: php setup.php" . PHP_EOL;
        exit(0);
    }

    // Run setup if empty
    require __DIR__ . '/setup.php';

} catch (Throwable $e) {
    echo "❌ Error seeding: " . $e->getMessage() . PHP_EOL;
    exit(1);
}
