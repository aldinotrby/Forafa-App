<?php
/**
 * User Model
 */

declare(strict_types=1);

class User {
    /**
     * Format user array for API output (exclude password_hash, ISO timestamp)
     */
    public static function format(array $row): array {
        return [
            'id' => $row['id'],
            'username' => $row['username'],
            'email' => $row['email'],
            'role' => $row['role'],
            'created_at' => !empty($row['created_at'])
                ? gmdate('Y-m-d\TH:i:s\Z', strtotime($row['created_at']))
                : null,
        ];
    }

    public static function findById(PDO $db, string $id): ?array {
        $stmt = $db->prepare("SELECT * FROM users WHERE id = :id");
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function findByUsername(PDO $db, string $username): ?array {
        $stmt = $db->prepare("SELECT * FROM users WHERE LOWER(username) = LOWER(:username)");
        $stmt->execute([':username' => $username]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function findByEmail(PDO $db, string $email): ?array {
        $stmt = $db->prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(:email)");
        $stmt->execute([':email' => $email]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function findByUsernameOrEmail(PDO $db, string $identifier): ?array {
        $stmt = $db->prepare("SELECT * FROM users WHERE LOWER(username) = LOWER(:id1) OR LOWER(email) = LOWER(:id2)");
        $stmt->execute([':id1' => $identifier, ':id2' => $identifier]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function getAll(PDO $db, int $skip = 0, int $limit = 100): array {
        $stmt = $db->prepare("SELECT * FROM users ORDER BY created_at ASC LIMIT :limit OFFSET :skip");
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':skip', $skip, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll();
        return array_map([self::class, 'format'], $rows);
    }

    public static function create(PDO $db, array $data): array {
        $id = 'u_' . bin2hex(random_bytes(4));
        $hash = password_hash($data['password'], PASSWORD_BCRYPT);
        $role = $data['role'] ?? 'User';
        $now = gmdate('Y-m-d H:i:s');

        $stmt = $db->prepare("
            INSERT INTO users (id, username, email, password_hash, role, created_at)
            VALUES (:id, :username, :email, :password_hash, :role, :created_at)
        ");
        $stmt->execute([
            ':id' => $id,
            ':username' => $data['username'],
            ':email' => $data['email'],
            ':password_hash' => $hash,
            ':role' => $role,
            ':created_at' => $now,
        ]);

        return [
            'id' => $id,
            'username' => $data['username'],
            'email' => $data['email'],
            'role' => $role,
            'created_at' => gmdate('Y-m-d\TH:i:s\Z', strtotime($now)),
        ];
    }

    public static function update(PDO $db, string $id, array $data): array {
        $fields = [];
        $params = [':id' => $id];

        if (isset($data['username'])) {
            $fields[] = "username = :username";
            $params[':username'] = $data['username'];
        }
        if (isset($data['email'])) {
            $fields[] = "email = :email";
            $params[':email'] = $data['email'];
        }
        if (isset($data['role'])) {
            $fields[] = "role = :role";
            $params[':role'] = $data['role'];
        }
        if (isset($data['password'])) {
            $fields[] = "password_hash = :password_hash";
            $params[':password_hash'] = password_hash($data['password'], PASSWORD_BCRYPT);
        }

        if (!empty($fields)) {
            $sql = "UPDATE users SET " . implode(', ', $fields) . " WHERE id = :id";
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
        }

        $row = self::findById($db, $id);
        return self::format($row);
    }

    public static function delete(PDO $db, string $id): void {
        $stmt = $db->prepare("DELETE FROM users WHERE id = :id");
        $stmt->execute([':id' => $id]);
    }
}
