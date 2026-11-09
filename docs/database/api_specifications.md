# 📑 Forafa-App — RESTful API Contract & Specifications

Dokumen spesifikasi teknis API (*API Contract*) antara **Backend API** dan **Frontend (React)** untuk aplikasi **Forafa-App**.

---

## 🌐 1. Konvensi Umum & Spesifikasi Protokol

* **Base URL**: `http://localhost:8000/api/v1`
* **Content-Type**: `application/json` (Kecuali endpoint export file CSV: `text/csv`)
* **Format Timestamp**: ISO 8601 UTC (Contoh: `2026-10-07T07:45:00.000Z`)

### Header Otentikasi
Semua *protected endpoints* mewajibkan header HTTP Authorization berbasis Bearer Token:
```http
Authorization: Bearer <JWT_ACCESS_TOKEN>
```

### Standar Format Error Response
```json
{
  "detail": "Pesan kesalahan yang mudah dipahami oleh pengguna / frontend"
}
```

---

<<<<<<< HEAD
## 🔐 2. Modul Autentikasi (`/api/v1/auth`)
=======
## 🔐 2. Modul Autentikasi & Pengelolaan Session (`/api/v1/auth`)

Sistem autentikasi Forafa-App mengintegrasikan Bearer Token JWT dengan **Server-side Session Management** pada basis data untuk mendukung:
1. **Siklus Hidup Login & Logout**: Pembuatan session terdaftar di server dan pembatalan (*revocation*) permanen saat logout.
2. **Session Expiration**: Pembatasan masa berlaku session absolut (contoh: 24 jam) serta *idle timeout* (contoh: 120 menit tanpa aktivitas).
3. **Session Regeneration**: Regenerasi identifier session baru saat login berhasil guna menangkal serangan *Session Fixation*.
4. **Validasi Session Saat Membuka Tab Kembali**: Endpoint khusus untuk verifikasi session dan sinkronisasi lintas tab browser (*cross-tab sync*).

---
>>>>>>> be/server

### 2.1 Registrasi Akun Baru
* **Method & URL**: `POST /api/v1/auth/register`
* **Akses**: Publik
* **Request Body**:
  ```json
  {
    "username": "rina_mekar",
    "email": "rina@desa-mekar.id",
    "password": "rina12345",
    "role": "User"
  }
  ```
* **Validation Rules**:
  * `username`: 3-20 karakter, alfanumerik & underscore (`^[a-zA-Z0-9_]+$`)
  * `email`: Format email valid & belum terdaftar
  * `password`: Minimal 8 karakter
* **Response `201 Created`**:
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
    "token_type": "bearer",
    "user": {
      "id": "u_a1b2c3d4",
      "username": "rina_mekar",
      "email": "rina@desa-mekar.id",
      "role": "User",
      "created_at": "2026-10-07T07:45:00Z"
<<<<<<< HEAD
=======
    },
    "session": {
      "id": "sess_8f3a9e2...",
      "expires_at": "2026-10-08T07:45:00Z",
      "expires_in_seconds": 86400,
      "idle_timeout_seconds": 7200
>>>>>>> be/server
    }
  }
  ```

<<<<<<< HEAD
### 2.2 Login Pengguna & Administrator
* **Method & URL**: `POST /api/v1/auth/login`
* **Akses**: Publik
=======
---

### 2.2 Login Pengguna & Administrator (Dengan Session Regeneration)
* **Method & URL**: `POST /api/v1/auth/login`
* **Akses**: Publik
* **Fitur Keamanan**:
  * Melakukan verifikasi kredensial (`password_verify`).
  * Menerapkan **Session Regeneration**: jika ada session lama dari perangkat/browser terkait, session lama segera dicabut (*revoked*), dan identifier session baru dibuat secara kriptografis (`bin2hex(random_bytes(16))`).
>>>>>>> be/server
* **Request Body**:
  ```json
  {
    "id": "rina_mekar",
    "password": "rina12345"
  }
  ```
* **Response `200 OK`**:
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
    "token_type": "bearer",
    "user": {
      "id": "u2",
      "username": "rina",
      "email": "rina@desa-mekar.id",
      "role": "User",
      "created_at": "2026-10-07T07:45:00Z"
<<<<<<< HEAD
=======
    },
    "session": {
      "id": "sess_a81b2c...",
      "expires_at": "2026-10-08T07:45:00Z",
      "expires_in_seconds": 86400,
      "idle_timeout_seconds": 7200
>>>>>>> be/server
    }
  }
  ```

<<<<<<< HEAD
### 2.3 Logout Sistem
* **Method & URL**: `POST /api/v1/auth/logout`
* **Akses**: Publik / Login
* **Response `200 OK`**:
  ```json
  {
    "message": "Berhasil keluar sistem (Logout)."
  }
  ```

### 2.4 Profil Pengguna yang Sedang Login
=======
---

### 2.3 Logout Sistem (Penghapusan & Revokasi Session)
* **Method & URL**: `POST /api/v1/auth/logout`
* **Akses**: Publik / Login (`Bearer Token`)
* **Mekanisme**:
  * Menghapus / menandai status `is_active = 0` pada session pengguna di database server, sehingga token tidak dapat disalahgunakan lagi.
  * Menghancurkan session native PHP (`session_destroy()`) dan membersihkan cookie session.
* **Response `200 OK`**:
  ```json
  {
    "message": "Berhasil keluar sistem (Logout). Session telah dihapus dan dinonaktifkan."
  }
  ```

---

### 2.4 Validasi Session Aktif (Saat Tab Dibuka Kembali / Focus)
* **Method & URL**: `GET /api/v1/auth/session` (Alias: `GET /api/v1/auth/validate-session`)
* **Akses**: Wajib Login (`Bearer Token`)
* **Tujuan**:
  * Dipanggil oleh Frontend ketika tab dibuka kembali (`document.visibilityState === 'visible'`) atau ketika jendela mendapatkan fokus (`window.onfocus`).
  * Memverifikasi apakah session masih berstatus aktif, belum dicabut karena logout di tab/perangkat lain, dan belum melewati *idle timeout*.
  * Jika valid, waktu aktivitas terakhir (`last_activity_at`) otomatis diperbarui.
* **Response `200 OK` (Session Valid)**:
  ```json
  {
    "valid": true,
    "message": "Session aktif dan valid.",
    "user": {
      "id": "u2",
      "username": "rina",
      "email": "rina@desa-mekar.id",
      "role": "User",
      "created_at": "2026-10-07T07:45:00Z"
    },
    "session": {
      "id": "sess_a81b2c...",
      "expires_at": "2026-10-08T07:45:00Z",
      "last_activity_at": "2026-10-07T08:15:00Z",
      "remaining_seconds": 84600
    }
  }
  ```
* **Response `401 Unauthorized` (Session Kadaluwarsa / Dicabut)**:
  ```json
  {
    "detail": "Session telah kedaluwarsa atau telah keluar. Silakan login kembali."
  }
  ```

---

### 2.5 Profil Pengguna yang Sedang Login
>>>>>>> be/server
* **Method & URL**: `GET /api/v1/auth/me`
* **Akses**: Wajib Login (`Bearer Token`)
* **Response `200 OK`**:
  ```json
  {
    "id": "u2",
    "username": "rina",
    "email": "rina@desa-mekar.id",
    "role": "User",
    "created_at": "2026-10-07T07:45:00Z"
  }
  ```

---

## 👥 3. Modul Manajemen Pengguna (`/api/v1/users`)

### 3.1 Daftar Pengguna (Admin Only)
* **Method & URL**: `GET /api/v1/users`
* **Query Params**: `skip` (int), `limit` (int), `search` (string), `role` (string)
* **Response `200 OK`**: List data pengguna tanpa hash password.

### 3.2 Tambah Pengguna Baru (Admin Only)
* **Method & URL**: `POST /api/v1/users`
* **Request Body**: `username`, `email`, `password`, `role` (`Administrator` | `User`)
* **Response `201 Created`**: Objek pengguna baru.

### 3.3 Detail Pengguna
* **Method & URL**: `GET /api/v1/users/{id}`
* **Response `200 OK`**: Objek pengguna.

### 3.4 Perbarui Profil Pengguna
* **Method & URL**: `PATCH /api/v1/users/{id}`
* **Request Body**: `username`?, `email`?, `role`?, `password`?
* **Response `200 OK`**: Objek pengguna terupdate.

### 3.5 Reset Password (Admin Only)
* **Method & URL**: `POST /api/v1/users/{id}/reset-password`
* **Request Body**: `{"new_password": "..."}`
* **Response `200 OK`**: Pesan konfirmasi sukses.

### 3.6 Hapus Pengguna (Admin Only)
* **Method & URL**: `DELETE /api/v1/users/{id}`
* **Response `204 No Content`**

---

<<<<<<< HEAD
## 🗳️ 4. Modul Formulir Interaksi (`/api/v1/interactions`)
=======
## 🗳️ 4. Modul Formulir Interaksi & Percabangan Voting (`/api/v1/interactions`)

Modul ini mengelola hak akses pembuat link voting (*link creator access control*) serta konfigurasi pertanyaan bertingkat:
* Pengguna hanya dapat melihat, mengedit, dan menghapus formulir voting yang mereka buat sendiri (`owner_id = user.id`).
* Pengguna lain yang bukan pembuat link voting ditolak dengan kode `403 Forbidden`.
>>>>>>> be/server

### 4.1 Daftar Interaksi
* **Method & URL**: `GET /api/v1/interactions`
* **Query Params**: `kind` (`vote` | `feedback` | `anon`), `owner_id`, `search`, `active`, `skip`, `limit`
<<<<<<< HEAD
* **Response `200 OK`**: List formulir interaksi milik user (atau semua jika Admin).
=======
* **Akses**: Pengguna Biasa hanya mendapatkan formulir miliknya sendiri; Administrator dapat melihat semua atau memfilter berdasarkan `owner_id`.
* **Response `200 OK`**: List formulir interaksi.
>>>>>>> be/server

### 4.2 Buat Formulir Interaksi Baru
* **Method & URL**: `POST /api/v1/interactions`
* **Request Body**:
  ```json
  {
    "kind": "vote",
<<<<<<< HEAD
    "title": "Pemilihan Desain Lapangan Warga",
    "description": "Pilih salah satu dari konsep desain ruang terbuka hijau.",
    "slug": "lapangan-warga-2026",
    "start": "2026-10-01",
    "end": "2026-10-31",
    "options": ["Konsep Minimalis", "Konsep Taman Anak", "Konsep Sport Hub"]
=======
    "title": "Pemilihan Pengurus RT 2026-2028",
    "description": "Pemilihan paket kepengurusan RT.",
    "slug": "pemilihan-pengurus-rt",
    "start": "2026-10-01",
    "end": "2026-10-31",
    "options": ["Pak Suryo", "Bu Ratna", "Pak Hasan"]
>>>>>>> be/server
  }
  ```
* **Response `201 Created`**

### 4.3 Detail Formulir Interaksi
* **Method & URL**: `GET /api/v1/interactions/{id}`
<<<<<<< HEAD

### 4.4 Perbarui Formulir Interaksi
* **Method & URL**: `PATCH /api/v1/interactions/{id}`

### 4.5 Hapus Formulir Interaksi
* **Method & URL**: `DELETE /api/v1/interactions/{id}`

### 4.6 Tanggapan untuk Interaksi Tertentu
* **Method & URL**: `GET /api/v1/interactions/{id}/responses`

---

## 📬 5. Modul Tanggapan / Respons (`/api/v1/responses`)
=======
* **Akses**: Pembuat link (`owner_id`) atau Administrator.

### 4.4 Perbarui Formulir Interaksi
* **Method & URL**: `PATCH /api/v1/interactions/{id}`
* **Akses**: Pembuat link (`owner_id`) atau Administrator.

### 4.5 Hapus Formulir Interaksi
* **Method & URL**: `DELETE /api/v1/interactions/{id}`
* **Akses**: Pembuat link (`owner_id`) atau Administrator.

### 4.6 Tanggapan untuk Interaksi Tertentu
* **Method & URL**: `GET /api/v1/interactions/{id}/responses`
* **Akses**: Pembuat link (`owner_id`) atau Administrator.

---

### 4.7 Daftar Pertanyaan Voting dalam Link
* **Method & URL**: `GET /api/v1/interactions/{id}/questions`
* **Akses**: Pembuat link (`owner_id`) atau Administrator.
* **Response `200 OK`**: List pertanyaan terurut sesuai `sort_order`.
  ```json
  [
    {
      "id": "vq_1",
      "interaction_id": "i4",
      "role_key": "ketua",
      "role_label": "Ketua",
      "title": "Pilih Ketua RT",
      "description": "Pilih kandidat Ketua RT",
      "options": ["Pak Suryo", "Bu Ratna", "Pak Hasan"],
      "sort_order": 1,
      "is_active": true,
      "depends_on_question_id": null
    },
    {
      "id": "vq_2",
      "interaction_id": "i4",
      "role_key": "wakil",
      "role_label": "Wakil Ketua",
      "title": "Pilih Wakil Ketua RT",
      "description": "Pilih kandidat pendamping",
      "options": ["Pak Suryo", "Bu Ratna", "Pak Hasan"],
      "sort_order": 2,
      "is_active": true,
      "depends_on_question_id": "vq_1"
    }
  ]
  ```

### 4.8 Tambah Pertanyaan Voting Baru
* **Method & URL**: `POST /api/v1/interactions/{id}/questions`
* **Akses**: Pembuat link (`owner_id`) atau Administrator.
* **Request Body**:
  ```json
  {
    "role_key": "sekretaris",
    "title": "Pilih Sekretaris RT",
    "description": "Pengelola administrasi warga",
    "options": ["Bu Ani", "Pak Joko", "Siti"],
    "sort_order": 3,
    "is_active": true,
    "depends_on_question_id": "vq_1"
  }
  ```
* **Response `201 Created`**: Objek pertanyaan baru.

### 4.9 Detail Pertanyaan Voting
* **Method & URL**: `GET /api/v1/interactions/{id}/questions/{qid}`
* **Akses**: Pembuat link (`owner_id`) atau Administrator.

### 4.10 Perbarui Pertanyaan Voting (Kondisi Aktif/Nonaktif, Urutan, Opsi)
* **Method & URL**: `PATCH /api/v1/interactions/{id}/questions/{qid}`
* **Akses**: Pembuat link (`owner_id`) atau Administrator.
* **Request Body**:
  ```json
  {
    "is_active": false,
    "sort_order": 2,
    "title": "Pilih Wakil Ketua RT (Revisi)"
  }
  ```
* **Response `200 OK`**: Objek pertanyaan terupdate.

### 4.11 Atur Urutan Pertanyaan Voting (Batch Reorder)
* **Method & URL**: `POST /api/v1/interactions/{id}/questions/reorder`
* **Akses**: Pembuat link (`owner_id`) atau Administrator.
* **Request Body**:
  ```json
  {
    "order": ["vq_1", "vq_3", "vq_2", "vq_4"]
  }
  ```
* **Response `200 OK`**: Daftar pertanyaan terurut baru.

### 4.12 Hapus Pertanyaan Voting
* **Method & URL**: `DELETE /api/v1/interactions/{id}/questions/{qid}`
* **Akses**: Pembuat link (`owner_id`) atau Administrator.
* **Response `204 No Content`**

---

## 📬 5. Modul Tanggapan & Privasi Identitas (`/api/v1/responses`)

Modul ini mengimplementasikan pemisahan fisik antara **Data Jawaban Voting** (tabel `responses` dan `voting_answers`) dan **Data Identitas Pemilih** (tabel `response_identities`), serta penegakan privasi identitas pemilih:

1. **Menyimpan Pilihan Anonymous atau Nama Asli**: Field `is_anonymous` disimpan sebagai preferensi privasi responden.
2. **Pemisahan Data Identitas**: Data identitas disimpan terisolasi di tabel `response_identities`. Pada tabel `responses`, kolom nama dikosongkan (`NULL`) untuk pengisi anonymous.
3. **Penyensoran Identitas untuk Admin**: Admin tidak dapat melihat identitas pengisi yang memilih anonymous (`name: null`).
4. **Penyensoran Identitas untuk Pembuat Link**: Pembuat link hanya dapat melihat identitas responden jika responden memilih memperlihatkan nama (`is_anonymous: false`).
>>>>>>> be/server

### 5.1 Daftar Semua Tanggapan
* **Method & URL**: `GET /api/v1/responses`
* **Query Params**: `interaction_id`, `status` (`Baru` | `Dibaca` | `Diproses` | `Selesai`), `search`, `skip`, `limit`
<<<<<<< HEAD

### 5.2 Perbarui Status & Balasan Tanggapan
* **Method & URL**: `PATCH /api/v1/responses/{id}`
* **Request Body**: `{"status": "Diproses", "reply": "...", "shared": true}`

### 5.3 Hapus Tanggapan
* **Method & URL**: `DELETE /api/v1/responses/{id}`

### 5.4 Ekspor Data Tanggapan ke CSV
* **Method & URL**: `GET /api/v1/responses/export/csv?interaction_id={id}`
=======
* **Akses**: Pembuat link (hanya untuk interaksi miliknya) atau Administrator.
* **Response `200 OK`**:
  ```json
  [
    {
      "id": "r_1234abcd",
      "interaction_id": "i4",
      "iid": "i4",
      "name": "Budi Santoso",
      "is_anonymous": false,
      "choice": "Ketua: Bu Ratna, Wakil: Pak Suryo, Sekretaris: Bu Ani, Bendahara: Bu Dewi",
      "answers": [
        { "question_id": "vq_1", "role_key": "ketua", "role_label": "Ketua", "choice": "Bu Ratna" },
        { "question_id": "vq_2", "role_key": "wakil", "role_label": "Wakil Ketua", "choice": "Pak Suryo" },
        { "question_id": "vq_3", "role_key": "sekretaris", "role_label": "Sekretaris", "choice": "Bu Ani" },
        { "question_id": "vq_4", "role_key": "bendahara", "role_label": "Bendahara", "choice": "Bu Dewi" }
      ],
      "status": "Baru",
      "reply": null,
      "shared": false,
      "created_at": "2026-10-07T07:45:00Z"
    }
  ]
  ```

### 5.2 Perbarui Status & Balasan Tanggapan
* **Method & URL**: `PATCH /api/v1/responses/{id}`
* **Akses**: Pembuat link atau Administrator.

### 5.3 Hapus Tanggapan
* **Method & URL**: `DELETE /api/v1/responses/{id}`
* **Akses**: Pembuat link atau Administrator.

### 5.4 Ekspor Data Tanggapan ke CSV (Dengan Masking Privasi)
* **Method & URL**: `GET /api/v1/responses/export/csv?interaction_id={id}`
* **Akses**: Pembuat link atau Administrator.
>>>>>>> be/server
* **Header Response**: `Content-Type: text/csv`

---

## 🌍 6. Modul Portal Publik Pengunjung (`/api/v1/public`)

### 6.1 Buka Tampilan Publik via Slug
* **Method & URL**: `GET /api/v1/public/{slug}`
* **Akses**: Bebas (Tanpa Login)
<<<<<<< HEAD

### 6.2 Kirim Suara / Masukan / Pesan Anonim
* **Method & URL**: `POST /api/v1/public/{slug}/submit`
* **Akses**: Bebas (Tanpa Login)
* **Request Body (Vote)**:
  ```json
  {
    "choice": "Konsep Taman Anak",
    "name": "Budi Santoso"
  }
  ```
* **Response `201 Created`**
=======
* **Response `200 OK`**: Mengembalikan interaksi dan daftar `questions` aktif terurut.
  ```json
  {
    "id": "i4",
    "kind": "vote",
    "title": "Pilih pengurus RT baru",
    "slug": "pilih-ketua-rt",
    "active": true,
    "has_multi_questions": true,
    "questions": [
      {
        "id": "vq_1",
        "role_key": "ketua",
        "role_label": "Ketua",
        "title": "Pilih Ketua RT",
        "options": ["Pak Suryo", "Bu Ratna", "Pak Hasan"],
        "sort_order": 1,
        "is_active": true
      },
      {
        "id": "vq_2",
        "role_key": "wakil",
        "role_label": "Wakil Ketua",
        "title": "Pilih Wakil Ketua RT",
        "options": ["Pak Suryo", "Bu Ratna", "Pak Hasan"],
        "sort_order": 2,
        "is_active": true
      }
    ]
  }
  ```

### 6.2 Kirim Suara Percabangan (Dengan Validasi Konflik Pilihan Bertentangan)
* **Method & URL**: `POST /api/v1/public/{slug}/submit`
* **Akses**: Bebas (Tanpa Login)
* **Request Body (Multi-Pertanyaan Percabangan)**:
  ```json
  {
    "name": "Budi Santoso",
    "is_anonymous": false,
    "answers": {
      "vq_1": "Pak Suryo",
      "vq_2": "Bu Ratna",
      "vq_3": "Bu Ani",
      "vq_4": "Bu Dewi"
    }
  }
  ```
  *(Atau menggunakan array `answers`: `[{"question_id": "vq_1", "choice": "Pak Suryo"}, ...]`)*
* **Aturan Validasi Pilihan Bertentangan (Conflict Validation)**:
  * Jika pemilih memilih kandidat yang sama pada lebih dari satu posisi (misal: "Pak Suryo" untuk Ketua dan "Pak Suryo" untuk Wakil):
    * **Response `422 Unprocessable Entity`**:
      ```json
      {
        "detail": "Pilihan bertentangan: Kandidat 'Pak Suryo' tidak dapat dipilih pada lebih dari satu posisi kepengurusan (Pilih Ketua RT dan Pilih Wakil Ketua RT)."
      }
      ```
  * Jika pilihan tidak ada dalam opsi yang tersedia pada pertanyaan terkait:
    * **Response `422 Unprocessable Entity`**:
      ```json
      {
        "detail": "Pilihan 'Pak Bambang' tidak valid untuk pertanyaan 'Pilih Ketua RT'."
      }
      ```
  * Jika ada pertanyaan aktif yang dilewati / belum dijawab:
    * **Response `422 Unprocessable Entity`**:
      ```json
      {
        "detail": "Pertanyaan 'Pilih Ketua RT' (Ketua) wajib dijawab."
      }
      ```
* **Response `201 Created` (Jika Sukses & Valid)**:
  ```json
  {
    "id": "r_9988aabb",
    "interaction_id": "i4",
    "name": "Budi Santoso",
    "is_anonymous": false,
    "choice": "Ketua: Pak Suryo, Wakil: Bu Ratna, Sekretaris: Bu Ani, Bendahara: Bu Dewi",
    "status": "Baru",
    "answers": [
      { "question_id": "vq_1", "role_key": "ketua", "role_label": "Ketua", "choice": "Pak Suryo" },
      { "question_id": "vq_2", "role_key": "wakil", "role_label": "Wakil Ketua", "choice": "Bu Ratna" },
      { "question_id": "vq_3", "role_key": "sekretaris", "role_label": "Sekretaris", "choice": "Bu Ani" },
      { "question_id": "vq_4", "role_key": "bendahara", "role_label": "Bendahara", "choice": "Bu Dewi" }
    ]
  }
  ```
>>>>>>> be/server

---

## 📊 7. Modul Analitik & Ringkasan Metrik (`/api/v1/analytics`)

### 7.1 Overview Statistik Platform (Admin Only)
* **Method & URL**: `GET /api/v1/analytics/overview`
<<<<<<< HEAD
* **Response `200 OK`**:
  ```json
  {
    "total_users": 2,
    "total_interactions": 5,
    "total_responses": 18,
    "by_kind": {
      "vote": { "total_interactions": 2, "total_responses": 12 },
      "feedback": { "total_interactions": 2, "total_responses": 4 },
      "anon": { "total_interactions": 1, "total_responses": 2 }
    },
    "recent_responses": [...]
  }
  ```
=======
>>>>>>> be/server

### 7.2 Statistik Personal User (`/api/v1/analytics/user-stats`)
* **Method & URL**: `GET /api/v1/analytics/user-stats`
* **Akses**: Wajib Login
