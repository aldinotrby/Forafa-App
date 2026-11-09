<?php
/**
 * Interaction Model
 */

declare(strict_types=1);

require_once __DIR__ . '/../utils/Slug.php';

class Interaction {
    /**
     * Format interaction row for internal / auth API response
     */
    public static function format(array $row): array {
        $options = $row['options'] ?? '[]';
        if (is_string($options)) {
            $options = json_decode($options, true) ?: [];
        }

        return [
            'id' => $row['id'],
            'owner_id' => $row['owner_id'],
            'kind' => $row['kind'],
            'title' => $row['title'],
            'description' => $row['description'] ?? '',
            'slug' => $row['slug'],
            'active' => (bool)$row['active'],
            'start' => $row['start'] ?? null,
            'end' => $row['end'] ?? null,
            'options' => is_array($options) ? array_values($options) : [],
            'created_at' => !empty($row['created_at'])
                ? gmdate('Y-m-d\TH:i:s\Z', strtotime($row['created_at']))
                : null,
        ];
    }

    /**
     * Format interaction row for public visitor portal
     */
    public static function formatPublic(array $row): array {
        $options = $row['options'] ?? '[]';
        if (is_string($options)) {
            $options = json_decode($options, true) ?: [];
        }

        return [
            'id' => $row['id'],
            'kind' => $row['kind'],
            'title' => $row['title'],
            'description' => $row['description'] ?? '',
            'slug' => $row['slug'],
            'active' => (bool)$row['active'],
            'start' => $row['start'] ?? null,
            'end' => $row['end'] ?? null,
            'options' => is_array($options) ? array_values($options) : [],
            'is_closed' => self::isClosed($row),
        ];
    }

    /**
     * Determine if an interaction is closed based on active flag and start/end dates
     */
    public static function isClosed(array $row): bool {
        if (empty($row['active'])) {
            return true;
        }

        $today = gmdate('Y-m-d');
        if (!empty($row['start']) && $today < $row['start']) {
            return true;
        }
        if (!empty($row['end']) && $today > $row['end']) {
            return true;
        }

        return false;
    }

    public static function findById(PDO $db, string $id): ?array {
        $stmt = $db->prepare("SELECT * FROM interactions WHERE id = :id");
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function findBySlug(PDO $db, string $slug): ?array {
        $stmt = $db->prepare("SELECT * FROM interactions WHERE slug = :slug");
        $stmt->execute([':slug' => $slug]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function getByOwner(PDO $db, string $ownerId, ?string $kind = null, int $skip = 0, int $limit = 100): array {
        $sql = "SELECT * FROM interactions WHERE owner_id = :owner_id";
        $params = [':owner_id' => $ownerId];

        if ($kind !== null) {
            $sql .= " AND kind = :kind";
            $params[':kind'] = $kind;
        }

        $sql .= " ORDER BY created_at DESC LIMIT :limit OFFSET :skip";
        $stmt = $db->prepare($sql);
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':skip', $skip, PDO::PARAM_INT);
        $stmt->execute();

        return array_map([self::class, 'format'], $stmt->fetchAll());
    }

    public static function getAll(PDO $db, ?string $kind = null, int $skip = 0, int $limit = 100): array {
        $sql = "SELECT * FROM interactions";
        $params = [];

        if ($kind !== null) {
            $sql .= " WHERE kind = :kind";
            $params[':kind'] = $kind;
        }

        $sql .= " ORDER BY created_at DESC LIMIT :limit OFFSET :skip";
        $stmt = $db->prepare($sql);
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':skip', $skip, PDO::PARAM_INT);
        $stmt->execute();

        return array_map([self::class, 'format'], $stmt->fetchAll());
    }

    public static function create(PDO $db, array $data, string $ownerId, ?string $customId = null): array {
        $id = $customId ?? ('i_' . bin2hex(random_bytes(4)));
        $baseSlug = !empty($data['slug']) ? Slug::create($data['slug']) : Slug::create($data['title']);
        $finalSlug = Slug::makeUnique($db, $baseSlug);

        $options = $data['options'] ?? [];
        $optionsJson = is_string($options) ? $options : json_encode(array_values((array)$options), JSON_UNESCAPED_UNICODE);
        $now = gmdate('Y-m-d H:i:s');
        $active = isset($data['active']) ? (int)(bool)$data['active'] : 1;

        $stmt = $db->prepare("
            INSERT INTO interactions (id, owner_id, kind, title, description, slug, active, start, end, options, created_at)
            VALUES (:id, :owner_id, :kind, :title, :description, :slug, :active, :start, :end, :options, :created_at)
        ");
        $stmt->execute([
            ':id' => $id,
            ':owner_id' => $ownerId,
            ':kind' => $data['kind'],
            ':title' => $data['title'],
            ':description' => $data['description'] ?? '',
            ':slug' => $finalSlug,
            ':active' => $active,
            ':start' => !empty($data['start']) ? $data['start'] : null,
            ':end' => !empty($data['end']) ? $data['end'] : null,
            ':options' => $optionsJson,
            ':created_at' => $now,
        ]);

        return self::format([
            'id' => $id,
            'owner_id' => $ownerId,
            'kind' => $data['kind'],
            'title' => $data['title'],
            'description' => $data['description'] ?? '',
            'slug' => $finalSlug,
            'active' => $active,
            'start' => $data['start'] ?? null,
            'end' => $data['end'] ?? null,
            'options' => $optionsJson,
            'created_at' => $now,
        ]);
    }

    public static function update(PDO $db, string $id, array $data): array {
        $fields = [];
        $params = [':id' => $id];

        if (array_key_exists('title', $data)) {
            $fields[] = "title = :title";
            $params[':title'] = $data['title'];
        }
        if (array_key_exists('description', $data)) {
            $fields[] = "description = :description";
            $params[':description'] = $data['description'];
        }
        if (array_key_exists('active', $data)) {
            $fields[] = "active = :active";
            $params[':active'] = (int)(bool)$data['active'];
        }
        if (array_key_exists('start', $data)) {
            $fields[] = "start = :start";
            $params[':start'] = $data['start'];
        }
        if (array_key_exists('end', $data)) {
            $fields[] = "end = :end";
            $params[':end'] = $data['end'];
        }
        if (array_key_exists('options', $data)) {
            $fields[] = "options = :options";
            $opts = $data['options'];
            $params[':options'] = is_string($opts) ? $opts : json_encode(array_values((array)$opts), JSON_UNESCAPED_UNICODE);
        }

        if (!empty($fields)) {
            $sql = "UPDATE interactions SET " . implode(', ', $fields) . " WHERE id = :id";
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
        }

        $row = self::findById($db, $id);
        return self::format($row);
    }

    public static function delete(PDO $db, string $id): void {
        $stmt = $db->prepare("DELETE FROM interactions WHERE id = :id");
        $stmt->execute([':id' => $id]);
    }
}
