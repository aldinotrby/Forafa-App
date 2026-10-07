<?php
/**
 * Response Model
 */

declare(strict_types=1);

class ResponseModel {
    /**
     * Format response row for frontend and API compatibility
     */
    public static function format(array $row): array {
        $isoTime = !empty($row['created_at'])
            ? gmdate('Y-m-d\TH:i:s\Z', strtotime($row['created_at']))
            : null;

        return [
            'id' => $row['id'],
            'interaction_id' => $row['interaction_id'],
            'iid' => $row['interaction_id'], // Direct frontend compatibility
            'name' => $row['name'] ?? null,
            'choice' => $row['choice'] ?? null,
            'message' => $row['message'] ?? null,
            'status' => $row['status'] ?? 'Baru',
            'reply' => $row['reply'] ?? null,
            'shared' => (bool)($row['shared'] ?? 0),
            'created_at' => $isoTime,
            'at' => $isoTime, // Direct frontend compatibility
        ];
    }

    public static function findById(PDO $db, string $id): ?array {
        $stmt = $db->prepare("SELECT * FROM responses WHERE id = :id");
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function getByInteraction(PDO $db, string $interactionId, int $skip = 0, int $limit = 200): array {
        $stmt = $db->prepare("
            SELECT * FROM responses 
            WHERE interaction_id = :interaction_id 
            ORDER BY created_at DESC 
            LIMIT :limit OFFSET :skip
        ");
        $stmt->bindValue(':interaction_id', $interactionId);
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':skip', $skip, PDO::PARAM_INT);
        $stmt->execute();

        return array_map([self::class, 'format'], $stmt->fetchAll());
    }

    public static function getByInteractions(PDO $db, array $interactionIds, int $skip = 0, int $limit = 500): array {
        if (empty($interactionIds)) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($interactionIds), '?'));
        $sql = "SELECT * FROM responses WHERE interaction_id IN ($placeholders) ORDER BY created_at DESC LIMIT ? OFFSET ?";
        
        $stmt = $db->prepare($sql);
        $paramIndex = 1;
        foreach ($interactionIds as $id) {
            $stmt->bindValue($paramIndex++, $id, PDO::PARAM_STR);
        }
        $stmt->bindValue($paramIndex++, $limit, PDO::PARAM_INT);
        $stmt->bindValue($paramIndex++, $skip, PDO::PARAM_INT);
        $stmt->execute();

        return array_map([self::class, 'format'], $stmt->fetchAll());
    }

    public static function create(PDO $db, array $data, ?string $customId = null): array {
        $id = $customId ?? ('r_' . bin2hex(random_bytes(4)));
        $now = gmdate('Y-m-d H:i:s');
        $status = $data['status'] ?? 'Baru';
        $shared = isset($data['shared']) ? (int)(bool)$data['shared'] : 0;

        $stmt = $db->prepare("
            INSERT INTO responses (id, interaction_id, name, choice, message, status, reply, shared, created_at)
            VALUES (:id, :interaction_id, :name, :choice, :message, :status, :reply, :shared, :created_at)
        ");
        $stmt->execute([
            ':id' => $id,
            ':interaction_id' => $data['interaction_id'],
            ':name' => $data['name'] ?? null,
            ':choice' => $data['choice'] ?? null,
            ':message' => $data['message'] ?? null,
            ':status' => $status,
            ':reply' => $data['reply'] ?? null,
            ':shared' => $shared,
            ':created_at' => $now,
        ]);

        return self::format([
            'id' => $id,
            'interaction_id' => $data['interaction_id'],
            'name' => $data['name'] ?? null,
            'choice' => $data['choice'] ?? null,
            'message' => $data['message'] ?? null,
            'status' => $status,
            'reply' => $data['reply'] ?? null,
            'shared' => $shared,
            'created_at' => $now,
        ]);
    }

    public static function update(PDO $db, string $id, array $data): array {
        $fields = [];
        $params = [':id' => $id];

        if (array_key_exists('status', $data)) {
            $fields[] = "status = :status";
            $params[':status'] = $data['status'];
        }
        if (array_key_exists('reply', $data)) {
            $fields[] = "reply = :reply";
            $params[':reply'] = $data['reply'];
        }
        if (array_key_exists('shared', $data)) {
            $fields[] = "shared = :shared";
            $params[':shared'] = (int)(bool)$data['shared'];
        }

        if (!empty($fields)) {
            $sql = "UPDATE responses SET " . implode(', ', $fields) . " WHERE id = :id";
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
        }

        $row = self::findById($db, $id);
        return self::format($row);
    }

    public static function delete(PDO $db, string $id): void {
        $stmt = $db->prepare("DELETE FROM responses WHERE id = :id");
        $stmt->execute([':id' => $id]);
    }

    public static function generateCsv(array $responses, string $interactionTitle = ''): string {
        $output = fopen('php://temp', 'r+');
        fputcsv($output, ['ID', 'Interaction Title', 'Pengirim / Nama', 'Pilihan Vote', 'Pesan / Masukan', 'Status', 'Tanggapan / Reply', 'Dibagikan Publik', 'Waktu']);

        foreach ($responses as $r) {
            fputcsv($output, [
                $r['id'] ?? '',
                $interactionTitle,
                $r['name'] ?? 'Anonim',
                $r['choice'] ?? '-',
                $r['message'] ?? '-',
                $r['status'] ?? 'Baru',
                $r['reply'] ?? '-',
                !empty($r['shared']) ? 'Ya' : 'Tidak',
                $r['created_at'] ?? '',
            ]);
        }

        rewind($output);
        $csv = stream_get_contents($output);
        fclose($output);
        return $csv;
    }
}
