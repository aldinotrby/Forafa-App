<?php
/**
 * Database Connection Manager (PDO MySQL Singleton)
 */

declare(strict_types=1);

class Database {
    private static ?PDO $instance = null;

    /**
     * Get or initialize PDO MySQL connection
     */
    public static function getConnection(bool $selectDb = true): PDO {
        if (self::$instance !== null && $selectDb) {
            return self::$instance;
        }

        $config = require __DIR__ . '/config.php';
        $dbConfig = $config['db'];

        // Guard: PDO::MYSQL_ATTR_INIT_COMMAND hanya ada kalau ekstensi
        // pdo_mysql termuat. Tanpa guard ini, array $options di bawah
        // melempar "Undefined constant PDO::MYSQL_ATTR_INIT_COMMAND"
        // SEBELUM try/catch tercapai, dan setup.php lalu keliru menyalahkan
        // server MySQL. Pesan ini memberi tahu penyebab sebenarnya.
        if (!extension_loaded('pdo_mysql') || !in_array('mysql', PDO::getAvailableDrivers(), true)) {
            throw new Exception(
                'Ekstensi pdo_mysql belum aktif di PHP ini. Jalankan setup dari terminal Laragon, '
                . 'aktifkan extension=pdo_mysql di php.ini CLI, atau jalankan: php -d extension=pdo_mysql setup.php'
            );
        }

        $dsn = "mysql:host={$dbConfig['host']};port={$dbConfig['port']};charset={$dbConfig['charset']}";
        if ($selectDb) {
            $dsn .= ";dbname={$dbConfig['database']}";
        }

        // PHP 8.5 men-deprecate PDO::MYSQL_ATTR_INIT_COMMAND; pakai
        // Pdo\Mysql::ATTR_INIT_COMMAND kalau tersedia, fallback ke konstanta
        // lama (aman di sini karena guard pdo_mysql di atas sudah lolos).
        $initCommandAttr = defined('Pdo\\Mysql::ATTR_INIT_COMMAND')
            ? Pdo\Mysql::ATTR_INIT_COMMAND
            : PDO::MYSQL_ATTR_INIT_COMMAND;

        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            $initCommandAttr => "SET NAMES {$dbConfig['charset']} COLLATE {$dbConfig['charset']}_unicode_ci",
        ];

        try {
            $pdo = new PDO($dsn, $dbConfig['username'], $dbConfig['password'], $options);
            if ($selectDb) {
                self::$instance = $pdo;
            }
            return $pdo;
        } catch (PDOException $e) {
            throw new Exception("Koneksi database MySQL gagal: " . $e->getMessage(), (int)$e->getCode());
        }
    }
}
