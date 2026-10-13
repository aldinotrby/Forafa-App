<?php
/**
 * Slug Utility for URL-friendly and unique slugs
 */

declare(strict_types=1);

class Slug {
    /**
     * Create clean URL slug from string
     */
    public static function create(string $text): string {
        if (function_exists('iconv')) {
            $text = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text) ?: $text;
        }

        $text = strtolower($text);
        $text = preg_replace('/[^a-z0-9]+/i', '-', $text);
        $text = trim((string)$text, '-');

        if ($text === '') {
            $text = bin2hex(random_bytes(3));
        }

        return $text;
    }

    /**
     * Ensure slug is unique in interactions table
     */
    public static function makeUnique(PDO $db, string $baseSlug, ?string $currentId = null): string {
        $slug = $baseSlug;
        $counter = 1;

        while (true) {
            $sql = "SELECT id FROM interactions WHERE slug = :slug";
            $params = [':slug' => $slug];

            if ($currentId !== null) {
                $sql .= " AND id != :id";
                $params[':id'] = $currentId;
            }

            $stmt = $db->prepare($sql);
            $stmt->execute($params);

            if (!$stmt->fetch()) {
                return $slug;
            }

            $slug = "{$baseSlug}-{$counter}";
            $counter++;
        }
    }
}
