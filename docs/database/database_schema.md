# 🗄️ Forafa-App — Database Schema & Data Dictionary

Dokumen kamus data (*Data Dictionary*) dan spesifikasi skema relasional untuk basis data **Forafa-App**.

---

## 📐 Ringkasan Relasi Antar Tabel (Entity Relationship)

```
[ users ] (1) <────── (N) [ interactions ] (1) <────── (N) [ responses ]
   id                        owner_id                     interaction_id
```

* **1 User -> Many Interactions**: Satu pengguna (User/Admin) dapat membuat banyak formulir interaksi.
* **1 Interaction -> Many Responses**: Satu formulir interaksi dapat menampung banyak respon dari pengunjung masyarakat.
* **On Delete Cascade**: Jika user dihapus, seluruh interaksi miliknya terhapus otomatis. Jika interaksi dihapus, seluruh respon terkait terhapus otomatis.

---

## 📋 1. Tabel: `users`
Menyimpan akun pengguna platform (Administrator dan Pengguna Biasa).

| Nama Kolom | Tipe Data | Nullable | Default | Keterangan & Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(50)` | NO | - | **Primary Key**. Format: `u1` atau `u_[hex]` |
| `username` | `VARCHAR(50)` | NO | - | **Unique Index** (`uk_users_username`). 3-20 karakter |
| `email` | `VARCHAR(255)` | NO | - | **Unique Index** (`uk_users_email`). Format email valid |
| `password_hash` | `VARCHAR(255)` | NO | - | Hash Bcrypt (`$2y$...`) |
| `role` | `VARCHAR(20)` | NO | `'User'` | Peran pengguna: `'Administrator'` atau `'User'` |
| `created_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP` | Waktu pendaftaran |

---

## 📋 2. Tabel: `interactions`
Menyimpan data master entitas bisnis utama: formulir partisipasi publik (Voting, Kritik & Saran, dan Pesan Anonim).

| Nama Kolom | Tipe Data | Nullable | Default | Keterangan & Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(50)` | NO | - | **Primary Key**. Format: `i1` atau `i_[hex]` |
| `owner_id` | `VARCHAR(50)` | NO | - | **Foreign Key** -> `users(id)` ON DELETE CASCADE. Indeks: `idx_interactions_owner_id` |
| `kind` | `VARCHAR(20)` | NO | - | Tipe formulir: `'vote'`, `'feedback'`, atau `'anon'` |
| `title` | `VARCHAR(255)` | NO | - | Judul formulir interaksi |
| `description` | `TEXT` | NO | - | Deskripsi lengkap formulir |
| `slug` | `VARCHAR(100)` | NO | - | **Unique Index** (`uk_interactions_slug`). URL slug ramah publik |
| `active` | `TINYINT(1)` | NO | `1` | Status aktif formulir (1 = Aktif, 0 = Nonaktif) |
| `start` | `VARCHAR(30)` | YES | `NULL` | Tanggal mulai aktif (Format: `YYYY-MM-DD`) |
| `end` | `VARCHAR(30)` | YES | `NULL` | Tanggal berakhir aktif (Format: `YYYY-MM-DD`) |
| `options` | `JSON` | NO | `[]` | Opsi pilihan voting atau kategori (JSON array) |
| `created_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP` | Waktu pembuatan formulir |

---

## 📋 3. Tabel: `responses`
Menyimpan data masukan suara, aspirasi, atau pesan anonim dari masyarakat publik.

| Nama Kolom | Tipe Data | Nullable | Default | Keterangan & Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(50)` | NO | - | **Primary Key**. Format: `r_[hex]` |
| `interaction_id` | `VARCHAR(50)` | NO | - | **Foreign Key** -> `interactions(id)` ON DELETE CASCADE. Indeks: `idx_responses_interaction_id` |
| `name` | `VARCHAR(100)` | YES | `NULL` | Nama pengirim (opsional / `NULL` jika anonim) |
| `choice` | `VARCHAR(255)` | YES | `NULL` | Pilihan vote yang dipilih (untuk formulir jenis `'vote'`) |
| `message` | `TEXT` | YES | `NULL` | Pesan aspirasi atau saran (untuk `'feedback'` & `'anon'`) |
| `status` | `VARCHAR(30)` | NO | `'Baru'` | Status tindak lanjut: `'Baru'`, `'Dibaca'`, `'Diproses'`, `'Selesai'` |
| `reply` | `TEXT` | YES | `NULL` | Balasan atau tanggapan resmi dari pemilik formulir |
| `shared` | `TINYINT(1)` | NO | `0` | Apakah balasan dipublikasikan (1 = Ya, 0 = Tidak) |
| `created_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP` | Waktu submit respon oleh pengunjung |
