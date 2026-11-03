-- ==============================================================================
-- Forafa-App Database Schema & Initial Seed Data (MySQL)
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS `forafa_db` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `forafa_db`;

-- ------------------------------------------------------------------------------
-- Table Cleanup
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `voting_answers`;
DROP TABLE IF EXISTS `voting_questions`;
DROP TABLE IF EXISTS `response_identities`;
DROP TABLE IF EXISTS `responses`;
DROP TABLE IF EXISTS `interactions`;
DROP TABLE IF EXISTS `sessions`;
DROP TABLE IF EXISTS `users`;

-- ------------------------------------------------------------------------------
-- 1. Table: users
-- ------------------------------------------------------------------------------
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
-- 2. Table: sessions
-- ------------------------------------------------------------------------------
CREATE TABLE `sessions` (
  `id` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(50) NOT NULL,
  `token_hash` VARCHAR(64) NOT NULL,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` TEXT NULL,
  `payload` JSON NULL,
  `last_activity_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` DATETIME NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sessions_token_hash` (`token_hash`),
  KEY `idx_sessions_user_id` (`user_id`),
  KEY `idx_sessions_expires_at` (`expires_at`),
  CONSTRAINT `fk_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 3. Table: interactions
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
-- 4. Table: voting_questions (Pertanyaan Bertingkat & Percabangan Voting)
-- ------------------------------------------------------------------------------
CREATE TABLE `voting_questions` (
  `id` VARCHAR(50) NOT NULL,
  `interaction_id` VARCHAR(50) NOT NULL,
  `role_key` VARCHAR(50) NOT NULL DEFAULT 'custom',
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `options` JSON NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 1,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `depends_on_question_id` VARCHAR(50) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_voting_questions_interaction` (`interaction_id`),
  KEY `idx_voting_questions_sort_order` (`sort_order`),
  KEY `idx_voting_questions_is_active` (`is_active`),
  CONSTRAINT `fk_voting_questions_interaction` FOREIGN KEY (`interaction_id`) REFERENCES `interactions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_voting_questions_depends` FOREIGN KEY (`depends_on_question_id`) REFERENCES `voting_questions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 5. Table: responses (Data Jawaban Voting / Masukan)
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
  `is_anonymous` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_responses_interaction_id` (`interaction_id`),
  KEY `idx_responses_is_anonymous` (`is_anonymous`),
  CONSTRAINT `fk_responses_interaction` FOREIGN KEY (`interaction_id`) REFERENCES `interactions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 6. Table: response_identities (Pemisahan Data Identitas Pemilih)
-- ------------------------------------------------------------------------------
CREATE TABLE `response_identities` (
  `id` VARCHAR(50) NOT NULL,
  `response_id` VARCHAR(50) NOT NULL,
  `interaction_id` VARCHAR(50) NOT NULL,
  `name` VARCHAR(100) NULL,
  `is_anonymous` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_response_identities_response` (`response_id`),
  KEY `idx_response_identities_interaction` (`interaction_id`),
  KEY `idx_response_identities_is_anonymous` (`is_anonymous`),
  CONSTRAINT `fk_response_identities_response` FOREIGN KEY (`response_id`) REFERENCES `responses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_response_identities_interaction` FOREIGN KEY (`interaction_id`) REFERENCES `interactions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 7. Table: voting_answers (Jawaban Granular Per Pertanyaan Kepengurusan)
-- ------------------------------------------------------------------------------
CREATE TABLE `voting_answers` (
  `id` VARCHAR(50) NOT NULL,
  `response_id` VARCHAR(50) NOT NULL,
  `question_id` VARCHAR(50) NOT NULL,
  `role_key` VARCHAR(50) NOT NULL,
  `choice` VARCHAR(255) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_voting_answers_response` (`response_id`),
  KEY `idx_voting_answers_question` (`question_id`),
  CONSTRAINT `fk_voting_answers_response` FOREIGN KEY (`response_id`) REFERENCES `responses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_voting_answers_question` FOREIGN KEY (`question_id`) REFERENCES `voting_questions` (`id`) ON DELETE CASCADE
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
('i4', 'u3', 'vote', 'Pilih pengurus RT baru', 'Pemilihan lengkap kepengurusan RT periode 2026-2028.', 'pilih-ketua-rt', 1, DATE_FORMAT(NOW() - INTERVAL 1 DAY, '%Y-%m-%d'), DATE_FORMAT(NOW() + INTERVAL 7 DAY, '%Y-%m-%d'), '["Pak Suryo", "Bu Ratna", "Pak Hasan"]', NOW() - INTERVAL 1 DAY),
('i5', 'u3', 'feedback', 'Masukan kebersihan lingkungan', 'Sampaikan saran untuk program kebersihan RW.', 'kebersihan-rw', 1, DATE_FORMAT(NOW() - INTERVAL 5 DAY, '%Y-%m-%d'), DATE_FORMAT(NOW() + INTERVAL 25 DAY, '%Y-%m-%d'), '["Jadwal", "Peralatan", "Petugas"]', NOW() - INTERVAL 5 DAY);

-- Seed Voting Questions for i4 (Relasi Ketua, Wakil, Sekretaris, Bendahara)
INSERT INTO `voting_questions` (`id`, `interaction_id`, `role_key`, `title`, `description`, `options`, `sort_order`, `is_active`, `depends_on_question_id`, `created_at`) VALUES
('vq_1', 'i4', 'ketua', 'Pilih Ketua RT', 'Pilih kandidat terbaik untuk posisi Ketua RT', '["Pak Suryo", "Bu Ratna", "Pak Hasan"]', 1, 1, NULL, NOW() - INTERVAL 1 DAY),
('vq_2', 'i4', 'wakil', 'Pilih Wakil Ketua RT', 'Pilih kandidat untuk mendampingi Ketua RT (tidak boleh sama dengan pilihan Ketua)', '["Pak Suryo", "Bu Ratna", "Pak Hasan"]', 2, 1, 'vq_1', NOW() - INTERVAL 1 DAY),
('vq_3', 'i4', 'sekretaris', 'Pilih Sekretaris RT', 'Pilih penanggung jawab administrasi warga', '["Bu Ani", "Pak Joko", "Siti"]', 3, 1, 'vq_1', NOW() - INTERVAL 1 DAY),
('vq_4', 'i4', 'bendahara', 'Pilih Bendahara RT', 'Pilih pengelola keuangan warga (tidak boleh sama dengan pilihan Sekretaris)', '["Bu Dewi", "Pak Hendra", "Siti"]', 4, 1, 'vq_1', NOW() - INTERVAL 1 DAY);

-- Seed Responses (Jawaban Voting)
INSERT INTO `responses` (`id`, `interaction_id`, `name`, `choice`, `message`, `status`, `reply`, `shared`, `is_anonymous`, `created_at`) VALUES
('v0', 'i1', 'Budi', 'Taman Mekar Asri', NULL, 'Baru', NULL, 0, 0, NOW() - INTERVAL 50 HOUR),
('v1', 'i1', 'Sari', 'Taman Mekar Asri', NULL, 'Baru', NULL, 0, 0, NOW() - INTERVAL 45 HOUR),
('v2', 'i1', 'Dewi', 'Taman Bhineka', NULL, 'Baru', NULL, 0, 0, NOW() - INTERVAL 40 HOUR),
('v3', 'i1', 'Agus', 'Taman Mekar Asri', NULL, 'Baru', NULL, 0, 0, NOW() - INTERVAL 35 HOUR),
('v4', 'i1', 'Maya', 'Taman Sudirman Hijau', NULL, 'Baru', NULL, 0, 0, NOW() - INTERVAL 30 HOUR),
('v5', 'i1', NULL, 'Taman Bhineka', NULL, 'Baru', NULL, 0, 1, NOW() - INTERVAL 25 HOUR),
('v6', 'i1', NULL, 'Taman Mekar Asri', NULL, 'Baru', NULL, 0, 1, NOW() - INTERVAL 20 HOUR),
('v7', 'i1', 'Rizal', 'Taman Cahaya', NULL, 'Baru', NULL, 0, 0, NOW() - INTERVAL 15 HOUR),
('v8', 'i1', 'Tono', 'Taman Bhineka', NULL, 'Baru', NULL, 0, 0, NOW() - INTERVAL 10 HOUR),
('v9', 'i1', 'Putri', 'Taman Mekar Asri', NULL, 'Baru', NULL, 0, 0, NOW() - INTERVAL 6 HOUR),
('v10', 'i1', 'Yoga', 'Taman Sudirman Hijau', NULL, 'Baru', NULL, 0, 0, NOW() - INTERVAL 3 HOUR),
('v11', 'i1', 'Nia', 'Taman Mekar Asri', NULL, 'Baru', NULL, 0, 0, NOW() - INTERVAL 1 HOUR),

('f1', 'i2', 'Bu Ani', NULL, 'Jadwal posyandu sering bentrok dengan jam kerja, mohon ada sesi sore.', 'Baru', NULL, 0, 0, NOW() - INTERVAL 2 HOUR),
('f2', 'i2', 'Pak Dedi', NULL, 'Ruang tunggu kurang kursi untuk lansia.', 'Dibaca', NULL, 0, 0, NOW() - INTERVAL 20 HOUR),
('f3', 'i2', 'Mita', NULL, 'Petugas sangat ramah, terima kasih!', 'Selesai', 'Terima kasih atas apresiasinya, Bu Mita.', 1, 0, NOW() - INTERVAL 60 HOUR),
('f4', 'i2', 'Joko', NULL, 'Tolong tambah papan informasi jadwal imunisasi.', 'Diproses', 'Sedang kami siapkan minggu ini.', 1, 0, NOW() - INTERVAL 90 HOUR),

('a1', 'i3', NULL, NULL, 'Lampu jalan di gang mawar sudah seminggu mati.', 'Baru', NULL, 0, 1, NOW() - INTERVAL 4 HOUR),
('a2', 'i3', NULL, NULL, 'Iuran kebersihan sebaiknya dilaporkan terbuka tiap bulan.', 'Dibaca', NULL, 0, 1, NOW() - INTERVAL 30 HOUR),

('v20', 'i4', 'Wati', 'Ketua: Bu Ratna, Wakil: Pak Suryo, Sekretaris: Bu Ani, Bendahara: Bu Dewi', NULL, 'Baru', NULL, 0, 0, NOW() - INTERVAL 3 HOUR),
('v21', 'i4', NULL, 'Ketua: Pak Suryo, Wakil: Bu Ratna, Sekretaris: Siti, Bendahara: Bu Dewi', NULL, 'Baru', NULL, 0, 1, NOW() - INTERVAL 5 HOUR),
('v22', 'i4', 'Dwi', 'Ketua: Bu Ratna, Wakil: Pak Hasan, Sekretaris: Pak Joko, Bendahara: Pak Hendra', NULL, 'Baru', NULL, 0, 0, NOW() - INTERVAL 8 HOUR),

('fb10', 'i5', 'Pak Bambang', NULL, 'Perlu tambah tempat sampah di depan masjid.', 'Baru', NULL, 0, 0, NOW() - INTERVAL 6 HOUR);

-- Seed Response Identities (Data Identitas Terpisah)
INSERT INTO `response_identities` (`id`, `response_id`, `interaction_id`, `name`, `is_anonymous`, `created_at`) VALUES
('ri_v0', 'v0', 'i1', 'Budi', 0, NOW() - INTERVAL 50 HOUR),
('ri_v1', 'v1', 'i1', 'Sari', 0, NOW() - INTERVAL 45 HOUR),
('ri_v2', 'v2', 'i1', 'Dewi', 0, NOW() - INTERVAL 40 HOUR),
('ri_v3', 'v3', 'i1', 'Agus', 0, NOW() - INTERVAL 35 HOUR),
('ri_v4', 'v4', 'i1', 'Maya', 0, NOW() - INTERVAL 30 HOUR),
('ri_v5', 'v5', 'i1', 'Hendra', 1, NOW() - INTERVAL 25 HOUR),
('ri_v6', 'v6', 'i1', 'Lina', 1, NOW() - INTERVAL 20 HOUR),
('ri_v7', 'v7', 'i1', 'Rizal', 0, NOW() - INTERVAL 15 HOUR),
('ri_v8', 'v8', 'i1', 'Tono', 0, NOW() - INTERVAL 10 HOUR),
('ri_v9', 'v9', 'i1', 'Putri', 0, NOW() - INTERVAL 6 HOUR),
('ri_v10', 'v10', 'i1', 'Yoga', 0, NOW() - INTERVAL 3 HOUR),
('ri_v11', 'v11', 'i1', 'Nia', 0, NOW() - INTERVAL 1 HOUR),

('ri_f1', 'f1', 'i2', 'Bu Ani', 0, NOW() - INTERVAL 2 HOUR),
('ri_f2', 'f2', 'i2', 'Pak Dedi', 0, NOW() - INTERVAL 20 HOUR),
('ri_f3', 'f3', 'i2', 'Mita', 0, NOW() - INTERVAL 60 HOUR),
('ri_f4', 'f4', 'i2', 'Joko', 0, NOW() - INTERVAL 90 HOUR),

('ri_a1', 'a1', 'i3', NULL, 1, NOW() - INTERVAL 4 HOUR),
('ri_a2', 'a2', 'i3', NULL, 1, NOW() - INTERVAL 30 HOUR),

('ri_v20', 'v20', 'i4', 'Wati', 0, NOW() - INTERVAL 3 HOUR),
('ri_v21', 'v21', 'i4', 'Slamet', 1, NOW() - INTERVAL 5 HOUR),
('ri_v22', 'v22', 'i4', 'Dwi', 0, NOW() - INTERVAL 8 HOUR),

('ri_fb10', 'fb10', 'i5', 'Pak Bambang', 0, NOW() - INTERVAL 6 HOUR);

-- Seed Voting Answers for v20
INSERT INTO `voting_answers` (`id`, `response_id`, `question_id`, `role_key`, `choice`, `created_at`) VALUES
('va_v20_1', 'v20', 'vq_1', 'ketua', 'Bu Ratna', NOW() - INTERVAL 3 HOUR),
('va_v20_2', 'v20', 'vq_2', 'wakil', 'Pak Suryo', NOW() - INTERVAL 3 HOUR),
('va_v20_3', 'v20', 'vq_3', 'sekretaris', 'Bu Ani', NOW() - INTERVAL 3 HOUR),
('va_v20_4', 'v20', 'vq_4', 'bendahara', 'Bu Dewi', NOW() - INTERVAL 3 HOUR);
