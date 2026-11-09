# 🗄️ Forafa-App — Database Schema & Data Dictionary

Dokumen kamus data (*Data Dictionary*) dan spesifikasi skema relasional untuk basis data **Forafa-App**.

---

## 📐 Ringkasan Relasi Antar Tabel (Entity Relationship)

```
<<<<<<< HEAD
[ users ] (1) <────── (N) [ interactions ] (1) <────── (N) [ responses ]
   id                        owner_id                     interaction_id
```

* **1 User -> Many Interactions**: Satu pengguna (User/Admin) dapat membuat banyak formulir interaksi.
* **1 Interaction -> Many Responses**: Satu formulir interaksi dapat menampung banyak respon dari pengunjung masyarakat.
* **On Delete Cascade**: Jika user dihapus, seluruh interaksi miliknya terhapus otomatis. Jika interaksi dihapus, seluruh respon terkait terhapus otomatis.
=======
[ users ] (1) <────── (N) [ sessions ]
   id                        user_id

[ users ] (1) <────── (N) [ interactions ] (1) <────── (N) [ voting_questions ]
   id                        owner_id      │                     interaction_id
                                           │                           │
                                           │ (1)                       │ (1)
                                           ▼ (N)                       ▼ (N)
                                    [ responses ] (1) <────── (N) [ voting_answers ]
                                       │    id                         response_id
                                       │
                                       │ (1)
                                       ▼ (1)
                             [ response_identities ]
                                   response_id
```

* **1 User -> Many Sessions**: Satu pengguna dapat memiliki banyak session aktif (multi-device) dengan regenerasi session dan pencabutan hak akses (*revocation*).
* **1 User -> Many Interactions**: Satu pengguna (User/Admin) dapat membuat banyak formulir interaksi.
* **1 Interaction -> Many Voting Questions**: Satu link interaksi voting dapat menampung beberapa pertanyaan bertingkat/percabangan (Ketua, Wakil, Sekretaris, Bendahara, dll).
* **1 Interaction -> Many Responses**: Satu formulir interaksi menampung banyak respon dari pengunjung.
* **1 Response -> 1 Response Identity (Pemisahan Identitas)**: Memisahkan data jawaban voting dari identitas pengisi untuk menjamin kerahasiaan (*secret ballot*).
* **1 Response -> Many Voting Answers**: Menampung jawaban granular per pertanyaan dalam satu paket respon voting.
* **On Delete Cascade**: Jika user/interaksi dihapus, seluruh pertanyaan, respon, identitas, dan jawaban terkait terhapus otomatis.
>>>>>>> be/server

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

<<<<<<< HEAD
## 📋 2. Tabel: `interactions`
=======
## 📋 2. Tabel: `sessions`
Menyimpan session aktif pengguna untuk pengelolaan autentikasi, validasi tab, regenerasi session, dan pencabutan hak akses (*revocation*) saat logout.

| Nama Kolom | Tipe Data | Nullable | Default | Keterangan & Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(64)` | NO | - | **Primary Key**. ID Session unik (Format: `sess_[hex]`) |
| `user_id` | `VARCHAR(50)` | NO | - | **Foreign Key** -> `users(id)` ON DELETE CASCADE. Indeks: `idx_sessions_user_id` |
| `token_hash` | `VARCHAR(64)` | NO | - | **Unique Index** (`uk_sessions_token_hash`). SHA-256 hash dari bearer token |
| `ip_address` | `VARCHAR(45)` | YES | `NULL` | Alamat IPv4/IPv6 client untuk audit keamanan |
| `user_agent` | `TEXT` | YES | `NULL` | Browser dan perangkat client |
| `payload` | `JSON` | YES | `NULL` | Metadata session tambahan (role, device info) |
| `last_activity_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP` | Waktu aktivitas terakhir untuk menghitung *idle timeout* |
| `expires_at` | `DATETIME` | NO | - | Batas waktu kedaluwarsa absolut session. Indeks: `idx_sessions_expires_at` |
| `is_active` | `TINYINT(1)` | NO | `1` | Status session (1 = Aktif, 0 = Dicabut/Keluar/Regenerasi) |
| `created_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP` | Waktu pembuatan session |

---

## 📋 3. Tabel: `interactions`
>>>>>>> be/server
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
<<<<<<< HEAD
| `options` | `JSON` | NO | `[]` | Opsi pilihan voting atau kategori (JSON array) |
=======
| `options` | `JSON` | NO | `[]` | Opsi pilihan voting atau kategori default (JSON array) |
>>>>>>> be/server
| `created_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP` | Waktu pembuatan formulir |

---

<<<<<<< HEAD
## 📋 3. Tabel: `responses`
Menyimpan data masukan suara, aspirasi, atau pesan anonim dari masyarakat publik.
=======
## 📋 4. Tabel: `voting_questions`
Menyimpan struktur pertanyaan bertingkat dan percabangan dalam satu link voting (misal relasi pemilihan Ketua, Wakil, Sekretaris, Bendahara, dll).

| Nama Kolom | Tipe Data | Nullable | Default | Keterangan & Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(50)` | NO | - | **Primary Key**. Format: `vq_[hex]` |
| `interaction_id` | `VARCHAR(50)` | NO | - | **Foreign Key** -> `interactions(id)` ON DELETE CASCADE. Indeks: `idx_voting_questions_interaction` |
| `role_key` | `VARCHAR(50)` | NO | `'custom'` | Posisi/jabatan: `'ketua'`, `'wakil'`, `'sekretaris'`, `'bendahara'`, `'custom'` |
| `title` | `VARCHAR(255)` | NO | - | Judul pertanyaan (misal: "Pilih Ketua RT") |
| `description` | `TEXT` | YES | `NULL` | Deskripsi atau petunjuk pemilihan |
| `options` | `JSON` | NO | - | Daftar pilihan kandidat (JSON array) |
| `sort_order` | `INT` | NO | `1` | Nomor urut penampilan pertanyaan. Indeks: `idx_voting_questions_sort_order` |
| `is_active` | `TINYINT(1)` | NO | `1` | Kondisi pertanyaan aktif (1 = Ditampilkan & Wajib diisi, 0 = Nonaktif). Indeks: `idx_voting_questions_is_active` |
| `depends_on_question_id` | `VARCHAR(50)` | YES | `NULL` | **Foreign Key** -> `voting_questions(id)` ON DELETE SET NULL. Relasi dependensi/hierarki pertanyaan |
| `created_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP` | Waktu pembuatan pertanyaan |

---

## 📋 5. Tabel: `responses`
Menyimpan data masukan suara, aspirasi, atau pesan anonim dari masyarakat publik (Data Jawaban Voting).
>>>>>>> be/server

| Nama Kolom | Tipe Data | Nullable | Default | Keterangan & Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(50)` | NO | - | **Primary Key**. Format: `r_[hex]` |
| `interaction_id` | `VARCHAR(50)` | NO | - | **Foreign Key** -> `interactions(id)` ON DELETE CASCADE. Indeks: `idx_responses_interaction_id` |
<<<<<<< HEAD
| `name` | `VARCHAR(100)` | YES | `NULL` | Nama pengirim (opsional / `NULL` jika anonim) |
| `choice` | `VARCHAR(255)` | YES | `NULL` | Pilihan vote yang dipilih (untuk formulir jenis `'vote'`) |
=======
| `name` | `VARCHAR(100)` | YES | `NULL` | Nama pengirim (bernilai `NULL` jika memilih anonymous) |
| `choice` | `VARCHAR(255)` | YES | `NULL` | Pilihan vote yang dipilih atau ringkasan pilihan kepengurusan |
>>>>>>> be/server
| `message` | `TEXT` | YES | `NULL` | Pesan aspirasi atau saran (untuk `'feedback'` & `'anon'`) |
| `status` | `VARCHAR(30)` | NO | `'Baru'` | Status tindak lanjut: `'Baru'`, `'Dibaca'`, `'Diproses'`, `'Selesai'` |
| `reply` | `TEXT` | YES | `NULL` | Balasan atau tanggapan resmi dari pemilik formulir |
| `shared` | `TINYINT(1)` | NO | `0` | Apakah balasan dipublikasikan (1 = Ya, 0 = Tidak) |
<<<<<<< HEAD
| `created_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP` | Waktu submit respon oleh pengunjung |
=======
| `is_anonymous` | `TINYINT(1)` | NO | `0` | Pilihan privasi: 1 = Anonymous, 0 = Nama Asli. Indeks: `idx_responses_is_anonymous` |
| `created_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP` | Waktu submit respon oleh pengunjung |

---

## 📋 6. Tabel: `response_identities`
Menyimpan data identitas peserta pemilih secara terpisah dari tabel jawaban voting untuk menegakkan privasi dan kerahasiaan suara pemilih (*secret ballot*).

| Nama Kolom | Tipe Data | Nullable | Default | Keterangan & Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(50)` | NO | - | **Primary Key**. Format: `ri_[hex]` |
| `response_id` | `VARCHAR(50)` | NO | - | **Foreign Key** -> `responses(id)` ON DELETE CASCADE. **Unique Index** (`uk_response_identities_response`) |
| `interaction_id` | `VARCHAR(50)` | NO | - | **Foreign Key** -> `interactions(id)` ON DELETE CASCADE. Indeks: `idx_response_identities_interaction` |
| `name` | `VARCHAR(100)` | YES | `NULL` | Nama asli yang dimasukkan responden (jika ada) |
| `is_anonymous` | `TINYINT(1)` | NO | `0` | Status privasi pemilih (1 = Memilih Anonymous, 0 = Memperlihatkan Nama). Indeks: `idx_response_identities_is_anonymous` |
| `created_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP` | Waktu pencatatan identitas |

---

## 📋 7. Tabel: `voting_answers`
Menyimpan rincian pilihan jawaban pemilih untuk masing-masing pertanyaan bertingkat dalam satu paket respon.

| Nama Kolom | Tipe Data | Nullable | Default | Keterangan & Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(50)` | NO | - | **Primary Key**. Format: `va_[hex]` |
| `response_id` | `VARCHAR(50)` | NO | - | **Foreign Key** -> `responses(id)` ON DELETE CASCADE. Indeks: `idx_voting_answers_response` |
| `question_id` | `VARCHAR(50)` | NO | - | **Foreign Key** -> `voting_questions(id)` ON DELETE CASCADE. Indeks: `idx_voting_answers_question` |
| `role_key` | `VARCHAR(50)` | NO | - | Posisi kepengurusan yang dipilih (`ketua`, `wakil`, `sekretaris`, `bendahara`) |
| `choice` | `VARCHAR(255)` | NO | - | Nama kandidat yang dipilih untuk posisi tersebut |
| `created_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP` | Waktu penyimpanan jawaban |
>>>>>>> be/server
