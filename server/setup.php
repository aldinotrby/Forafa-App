<?php
/**
 * Forafa-App — Database Setup & Migration Script
 * Run via terminal: php setup.php
 * Or via browser: http://localhost:8000/setup.php
 */

declare(strict_types=1);

require_once __DIR__ . '/src/config/database.php';

$isCli = (php_sapi_name() === 'cli');

function output(string $msg, bool $isCli): void {
    if ($isCli) {
        echo $msg . PHP_EOL;
    } else {
        echo nl2br(htmlspecialchars($msg)) . "<br>";
    }
}

try {
    output("🚀 Memulai inisialisasi database MySQL untuk Forafa-App...", $isCli);

    $config = require __DIR__ . '/src/config/config.php';
    $dbConfig = $config['db'];

    // 1. Connect without selecting database to ensure database exists
    output("📡 Menghubungkan ke server MySQL ({$dbConfig['host']}:{$dbConfig['port']})...", $isCli);
    $pdoRoot = Database::getConnection(false);

    $dbName = $dbConfig['database'];
    $pdoRoot->exec("CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    output("✅ Database `{$dbName}` siap digunakan.", $isCli);

    // 2. Connect directly to the database
    $pdo = Database::getConnection(true);

    // 3. Read and execute database.sql
    $sqlFile = __DIR__ . '/database.sql';
    if (!file_exists($sqlFile)) {
        throw new Exception("File database.sql tidak ditemukan!");
    }

    output("📄 Membaca dan mengeksekusi skema database.sql...", $isCli);
    $sql = file_get_contents($sqlFile);

    // Execute SQL script
    $pdo->exec($sql);

    output("🎉 Inisialisasi database berhasil!", $isCli);
    output("--------------------------------------------------", $isCli);
    output("Tabel yang dibuat:", $isCli);
    output(" - users", $isCli);
    output(" - interactions", $isCli);
    output(" - responses", $isCli);
    output("", $isCli);
    output("Akun bawaan yang tersedia:", $isCli);
    output(" - Administrator : admin / admin12345 (admin@forafa.app)", $isCli);
    output(" - User 1        : rina / rina12345 (rina@desa-mekar.id)", $isCli);
    output(" - User 2        : budi_rw / budi12345 (budi@rw05.id)", $isCli);
    output("--------------------------------------------------", $isCli);

} catch (Throwable $e) {
    output("❌ Terjadi kesalahan: " . $e->getMessage(), $isCli);
    output("💡 Pastikan server MySQL (Laragon/XAMPP) sudah aktif di port 3306.", $isCli);
    if ($isCli) {
        exit(1);
    }
}
