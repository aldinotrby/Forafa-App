-- ==============================================================================
-- Forafa-App Database Schema & Initial Seed Data (MySQL)
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS `forafa_db` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `forafa_db`;

-- ------------------------------------------------------------------------------
-- 1. Table: users
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `responses`;
DROP TABLE IF EXISTS `interactions`;
DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
  `id` VARCHAR(50) NOT NULL,
  `username` VARCHAR(50) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` VARCHAR(20) NOT NULL DEFAULT 'User',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_username` (`username`),
  UNIQUE KEY `uk_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 2. Table: interactions
-- ------------------------------------------------------------------------------
CREATE TABLE `interactions` (
  `id` VARCHAR(50) NOT NULL,
  `owner_id` VARCHAR(50) NOT NULL,
  `kind` VARCHAR(20) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `slug` VARCHAR(100) NOT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `start` VARCHAR(30) NULL,
  `end` VARCHAR(30) NULL,
  `options` JSON NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_interactions_slug` (`slug`),
  KEY `idx_interactions_owner_id` (`owner_id`),
  CONSTRAINT `fk_interactions_owner` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 3. Table: responses
-- ------------------------------------------------------------------------------
CREATE TABLE `responses` (
  `id` VARCHAR(50) NOT NULL,
  `interaction_id` VARCHAR(50) NOT NULL,
  `name` VARCHAR(100) NULL,
  `choice` VARCHAR(255) NULL,
  `message` TEXT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'Baru',
  `reply` TEXT NULL,
  `shared` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_responses_interaction_id` (`interaction_id`),
  CONSTRAINT `fk_responses_interaction` FOREIGN KEY (`interaction_id`) REFERENCES `interactions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- SEED DATA
-- ------------------------------------------------------------------------------

-- Seed Users (Passwords: admin12345, rina12345, budi12345)
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `role`, `created_at`) VALUES
('u1', 'admin', 'admin@forafa.app', '$2y$10$jDdwQk2WUnbUM5XFJCQoB./vsH9.F7yOQnVCw.xKyB0vjKNvnJhce', 'Administrator', NOW() - INTERVAL 40 DAY),
('u2', 'rina', 'rina@desa-mekar.id', '$2y$10$lltfLgnPLT4jc1NswDoLyedNK9OVsdLj0x7/gIPRqNFl5y2EFNNQC', 'User', NOW() - INTERVAL 33 DAY),
('u3', 'budi_rw', 'budi@rw05.id', '$2y$10$VqqUhYBx1T4VgjY/VFK25e8OBpWVsv17383couDyfUJK2sANEqQDK', 'User', NOW() - INTERVAL 25 DAY);

-- Seed Interactions
INSERT INTO `interactions` (`id`, `owner_id`, `kind`, `title`, `description`, `slug`, `active`, `start`, `end`, `options`, `created_at`) VALUES
('i1', 'u2', 'vote', 'Pilih nama taman baru RW 05', 'Warga memilih satu nama untuk taman yang baru diresmikan.', 'taman-rw05', 1, DATE_FORMAT(NOW() - INTERVAL 3 DAY, '%Y-%m-%d'), DATE_FORMAT(NOW() + INTERVAL 10 DAY, '%Y-%m-%d'), '["Taman Mekar Asri", "Taman Bhineka", "Taman Sudirman Hijau", "Taman Cahaya"]', NOW() - INTERVAL 3 DAY),
('i2', 'u2', 'feedback', 'Kritik & Saran layanan posyandu', 'Sampaikan masukan agar layanan posyandu semakin nyaman.', 'posyandu', 1, DATE_FORMAT(NOW() - INTERVAL 14 DAY, '%Y-%m-%d'), DATE_FORMAT(NOW() + INTERVAL 30 DAY, '%Y-%m-%d'), '["Jadwal", "Fasilitas", "Petugas"]', NOW() - INTERVAL 8 DAY),
('i3', 'u2', 'anon', 'Kotak suara warga', 'Tulis apa saja tanpa menampilkan identitas Anda.', 'kotak-suara', 1, DATE_FORMAT(NOW() - INTERVAL 30 DAY, '%Y-%m-%d'), DATE_FORMAT(NOW() + INTERVAL 60 DAY, '%Y-%m-%d'), '[]', NOW() - INTERVAL 16 DAY),
('i4', 'u3', 'vote', 'Pilih ketua RT baru', 'Pemilihan ketua RT periode 2026-2028.', 'pilih-ketua-rt', 1, DATE_FORMAT(NOW() - INTERVAL 1 DAY, '%Y-%m-%d'), DATE_FORMAT(NOW() + INTERVAL 7 DAY, '%Y-%m-%d'), '["Pak Suryo", "Bu Ratna", "Pak Hasan"]', NOW() - INTERVAL 1 DAY),
('i5', 'u3', 'feedback', 'Masukan kebersihan lingkungan', 'Sampaikan saran untuk program kebersihan RW.', 'kebersihan-rw', 1, DATE_FORMAT(NOW() - INTERVAL 5 DAY, '%Y-%m-%d'), DATE_FORMAT(NOW() + INTERVAL 25 DAY, '%Y-%m-%d'), '["Jadwal", "Peralatan", "Petugas"]', NOW() - INTERVAL 5 DAY);

-- Seed Responses
INSERT INTO `responses` (`id`, `interaction_id`, `name`, `choice`, `message`, `status`, `reply`, `shared`, `created_at`) VALUES
('v0', 'i1', 'Budi', 'Taman Mekar Asri', NULL, 'Baru', NULL, 0, NOW() - INTERVAL 50 HOUR),
('v1', 'i1', 'Sari', 'Taman Mekar Asri', NULL, 'Baru', NULL, 0, NOW() - INTERVAL 45 HOUR),
('v2', 'i1', 'Dewi', 'Taman Bhineka', NULL, 'Baru', NULL, 0, NOW() - INTERVAL 40 HOUR),
('v3', 'i1', 'Agus', 'Taman Mekar Asri', NULL, 'Baru', NULL, 0, NOW() - INTERVAL 35 HOUR),
('v4', 'i1', 'Maya', 'Taman Sudirman Hijau', NULL, 'Baru', NULL, 0, NOW() - INTERVAL 30 HOUR),
('v5', 'i1', 'Hendra', 'Taman Bhineka', NULL, 'Baru', NULL, 0, NOW() - INTERVAL 25 HOUR),
('v6', 'i1', 'Lina', 'Taman Mekar Asri', NULL, 'Baru', NULL, 0, NOW() - INTERVAL 20 HOUR),
('v7', 'i1', 'Rizal', 'Taman Cahaya', NULL, 'Baru', NULL, 0, NOW() - INTERVAL 15 HOUR),
('v8', 'i1', 'Tono', 'Taman Bhineka', NULL, 'Baru', NULL, 0, NOW() - INTERVAL 10 HOUR),
('v9', 'i1', 'Putri', 'Taman Mekar Asri', NULL, 'Baru', NULL, 0, NOW() - INTERVAL 6 HOUR),
('v10', 'i1', 'Yoga', 'Taman Sudirman Hijau', NULL, 'Baru', NULL, 0, NOW() - INTERVAL 3 HOUR),
('v11', 'i1', 'Nia', 'Taman Mekar Asri', NULL, 'Baru', NULL, 0, NOW() - INTERVAL 1 HOUR),

('f1', 'i2', 'Bu Ani', NULL, 'Jadwal posyandu sering bentrok dengan jam kerja, mohon ada sesi sore.', 'Baru', NULL, 0, NOW() - INTERVAL 2 HOUR),
('f2', 'i2', 'Pak Dedi', NULL, 'Ruang tunggu kurang kursi untuk lansia.', 'Dibaca', NULL, 0, NOW() - INTERVAL 20 HOUR),
('f3', 'i2', 'Mita', NULL, 'Petugas sangat ramah, terima kasih!', 'Selesai', 'Terima kasih atas apresiasinya, Bu Mita.', 1, NOW() - INTERVAL 60 HOUR),
('f4', 'i2', 'Joko', NULL, 'Tolong tambah papan informasi jadwal imunisasi.', 'Diproses', 'Sedang kami siapkan minggu ini.', 1, NOW() - INTERVAL 90 HOUR),

('a1', 'i3', NULL, NULL, 'Lampu jalan di gang mawar sudah seminggu mati.', 'Baru', NULL, 0, NOW() - INTERVAL 4 HOUR),
('a2', 'i3', NULL, NULL, 'Iuran kebersihan sebaiknya dilaporkan terbuka tiap bulan.', 'Dibaca', NULL, 0, NOW() - INTERVAL 30 HOUR),

('v20', 'i4', 'Wati', 'Bu Ratna', NULL, 'Baru', NULL, 0, NOW() - INTERVAL 3 HOUR),
('v21', 'i4', 'Slamet', 'Pak Suryo', NULL, 'Baru', NULL, 0, NOW() - INTERVAL 5 HOUR),
('v22', 'i4', 'Dwi', 'Bu Ratna', NULL, 'Baru', NULL, 0, NOW() - INTERVAL 8 HOUR),

('fb10', 'i5', 'Pak Bambang', NULL, 'Perlu tambah tempat sampah di depan masjid.', 'Baru', NULL, 0, NOW() - INTERVAL 6 HOUR);
