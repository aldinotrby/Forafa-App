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

        $dsn = "mysql:host={$dbConfig['host']};port={$dbConfig['port']};charset={$dbConfig['charset']}";
        if ($selectDb) {
            $dsn .= ";dbname={$dbConfig['database']}";
        }

        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES {$dbConfig['charset']} COLLATE {$dbConfig['charset']}_unicode_ci",
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
