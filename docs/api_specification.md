# 📑 Forafa-App — Master RESTful API Specification & Integration Contract

Dokumen spesifikasi teknis dan kontrak integrasi resmi (*Official Integration Contract*) antara **Frontend Client (React + TypeScript + Vite)** dan **Backend API Service (PHP Native + MySQL)** untuk aplikasi **Forafa-App**.

Dokumen ini disusun sebagai panduan standar bagi tim **DevOps**, **Quality Assurance (QA)**, dan **Integration Engineers** untuk memastikan kompatibilitas arsitektur, pengujian otomatis, dan stabilitas deployment.

---

## 🏗️ 1. Arsitektur Sistem & Spesifikasi Protokol

### 1.1 Diagram Arsitektur Integrasi
```
┌────────────────────────────────────────────────────────┐
│            Frontend Client (React 19 + Vite)           │
│                   http://localhost:5173                │
│       [Context Store] <──────> [Vite Dev Proxy]        │
└──────────────────────────┬─────────────────────────────┘
                           │ (HTTP REST / JSON)
                           │ Proxy Target: http://localhost:8000
                           ▼
┌────────────────────────────────────────────────────────┐
│             Backend API Service (PHP Native)           │
│                   http://localhost:8000                │
│  ├── [router.php] ──> [src/index.php]                  │
│  ├── [CorsMiddleware] (Origin: http://localhost:5173)  │
│  ├── [AuthMiddleware] (Stateless JWT Verification)     │
│  └── [Controllers & Models]                            │
└──────────────────────────┬─────────────────────────────┘
                           │ (PDO MySQL Driver)
                           ▼
┌────────────────────────────────────────────────────────┐
│             Database Server (MySQL 8.0)                │
│                   port 3306 (forafa_db)                │
│       ├── users (Admin & Pengguna)                     │
│       ├── interactions (Voting, Feedback, Anon)        │
│       └── responses (Tanggapan Publik)                 │
└────────────────────────────────────────────────────────┘
```

### 1.2 Konvensi Protokol
* **Base URL Production**: `https://api.forafa.app/api/v1`
* **Base URL Local Dev**: `http://localhost:8000/api/v1`
* **Vite Proxy Dev URL**: `/api/v1` (otomatis diarahkan ke `http://localhost:8000/api/v1`)
* **Format Data**: JSON (`application/json`) untuk seluruh payload request & response (kecuali export CSV: `text/csv`).
* **Karakter Encoding**: `UTF-8`
* **Format Waktu**: ISO 8601 UTC (Contoh: `2026-10-13T12:00:00Z`).

### 1.3 Header Standar
| Header | Nilai | Keterangan |
| :--- | :--- | :--- |
| `Content-Type` | `application/json` | Wajib untuk request yang mengirimkan body JSON |
| `Accept` | `application/json` | Menandakan frontend mengharapkan respon JSON |
| `Authorization` | `Bearer <JWT_TOKEN>` | Wajib untuk semua *protected endpoints* |

### 1.4 Standar Format Respon & Error
Semua respon galat (*error*) mematuhi format standar berikut:
```json
{
  "detail": "Pesan deskripsi kesalahan dalam bahasa Indonesia yang ramah pengguna."
}
```

Daftar Kode Status HTTP yang digunakan:
* `200 OK`: Permintaan berhasil diproses.
* `201 Created`: Entitas baru berhasil dibuat.
* `204 No Content`: Entitas berhasil dihapus (tanpa response body).
* `400 Bad Request`: Validasi bisnis gagal (misal duplikasi email/username).
* `401 Unauthorized`: Token otentikasi tidak ada, kedaluwarsa, atau tidak valid.
* `403 Forbidden`: Pengguna tidak memiliki hak akses (misal non-admin mengakses fitur admin).
* `404 Not Found`: Sumber daya (user, interaksi, slug) tidak ditemukan.
* `422 Unprocessable Entity`: Validasi format input gagal (format email salah, password terlalu pendek).
* `500 Internal Server Error`: Kegagalan server / database internal.

---

## 🔐 2. Modul Otentikasi (`/api/v1/auth`)

### 2.1 Registrasi Pengguna Baru
Mendaftarkan akun baru secara mandiri. Secara default role yang diberikan adalah `User`.
* **Metode & Endpoint**: `POST /api/v1/auth/register`
* **Akses**: Publik (Tanpa Token)
* **Request Payload**:
  ```json
  {
    "username": "rina_mekar",
    "email": "rina@desa-mekar.id",
    "password": "rina12345",
    "role": "User"
  }
  ```
* **Aturan Validasi**:
  * `username`: Wajib, 3-20 karakter, regex `^[a-zA-Z0-9_]{3,20}$`.
  * `email`: Wajib, format email valid, unik (belum terdaftar).
  * `password`: Wajib, minimal 8 karakter.
* **Respon Sukses `201 Created`**:
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "user": {
      "id": "u_8f3a1b2c",
      "username": "rina_mekar",
      "email": "rina@desa-mekar.id",
      "role": "User",
      "created_at": "2026-10-13T12:00:00Z"
    }
  }
  ```
* **Respon Galat**:
  * `400 Bad Request`: `{"detail": "Email sudah terdaftar."}` atau `{"detail": "Username sudah terdaftar."}`
  * `422 Unprocessable Entity`: `{"detail": "Username harus berupa 3-20 karakter alfanumerik atau underscore."}`

### 2.2 Login Akun
Autentikasi akun menggunakan username atau email.
* **Metode & Endpoint**: `POST /api/v1/auth/login`
* **Akses**: Publik
* **Request Payload**:
  ```json
  {
    "id": "rina",
    "password": "rina12345"
  }
  ```
* **Respon Sukses `200 OK`**:
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "user": {
      "id": "u2",
      "username": "rina",
      "email": "rina@desa-mekar.id",
      "role": "User",
      "created_at": "2026-10-13T12:00:00Z"
    }
  }
  ```
* **Respon Galat**:
  * `400 Bad Request`: `{"detail": "Email/username atau password salah."}`
  * `422 Unprocessable Entity`: `{"detail": "Email/username dan password wajib diisi."}`

### 2.3 Logout Akun
Mengakhiri sesi otentikasi. Token Bearer dihapus dari sisi client storage.
* **Metode & Endpoint**: `POST /api/v1/auth/logout`
* **Akses**: Publik / Wajib Login
* **Respon Sukses `200 OK`**:
  ```json
  {
    "message": "Berhasil keluar sistem (Logout)."
  }
  ```

### 2.4 Cek Profil User Aktif
Mendapatkan identitas pengguna pemilik token JWT aktif.
* **Metode & Endpoint**: `GET /api/v1/auth/me`
* **Akses**: Wajib Login (`Authorization: Bearer <TOKEN>`)
* **Respon Sukses `200 OK`**:
  ```json
  {
    "id": "u2",
    "username": "rina",
    "email": "rina@desa-mekar.id",
    "role": "User",
    "created_at": "2026-10-13T12:00:00Z"
  }
  ```
* **Respon Galat**:
  * `401 Unauthorized`: `{"detail": "Token otentikasi tidak ditemukan atau tidak valid."}`

---

## 👥 3. Modul Manajemen Pengguna (`/api/v1/users`)

### 3.1 Daftar Semua Pengguna
* **Metode & Endpoint**: `GET /api/v1/users`
* **Akses**: Khusus Administrator
* **Query Parameters**:
  * `skip` (integer, default: 0): Offset paginasi data.
  * `limit` (integer, default: 100): Batas jumlah data.
  * `search` (string, opsional): Pencarian username atau email.
  * `role` (string, opsional): Filter role (`Administrator` / `User`).
* **Respon Sukses `200 OK`**:
  ```json
  [
    {
      "id": "u1",
      "username": "admin",
      "email": "admin@forafa.app",
      "role": "Administrator",
      "created_at": "2026-09-01T00:00:00Z"
    },
    {
      "id": "u2",
      "username": "rina",
      "email": "rina@desa-mekar.id",
      "role": "User",
      "created_at": "2026-09-10T00:00:00Z"
    }
  ]
  ```

### 3.2 Tambah Pengguna Baru (Admin)
* **Metode & Endpoint**: `POST /api/v1/users`
* **Akses**: Khusus Administrator
* **Request Payload**:
  ```json
  {
    "username": "budi_rw",
    "email": "budi@rw05.id",
    "password": "budi12345",
    "role": "User"
  }
  ```
* **Respon Sukses `201 Created`**: Objek data user baru.

### 3.3 Detail Pengguna Berdasarkan ID
* **Metode & Endpoint**: `GET /api/v1/users/{id}`
* **Akses**: Administrator atau Pengguna bersangkutan
* **Respon Sukses `200 OK`**: Objek profil pengguna.

### 3.4 Perbarui Pengguna
* **Metode & Endpoint**: `PATCH /api/v1/users/{id}`
* **Akses**: Administrator atau Pemilik Akun
* **Request Payload**:
  ```json
  {
    "username": "rina_update",
    "email": "rina_baru@desa.id"
  }
  ```
* **Respon Sukses `200 OK`**: Objek pengguna yang telah diperbarui.

### 3.5 Reset Password Pengguna (Admin)
* **Metode & Endpoint**: `POST /api/v1/users/{id}/reset-password`
* **Akses**: Khusus Administrator
* **Request Payload**:
  ```json
  {
    "new_password": "passwordBaru123"
  }
  ```
* **Respon Sukses `200 OK`**:
  ```json
  {
    "message": "Password pengguna berhasil diperbarui."
  }
  ```

### 3.6 Hapus Pengguna (Admin)
* **Metode & Endpoint**: `DELETE /api/v1/users/{id}`
* **Akses**: Khusus Administrator (Tidak dapat menghapus akun sendiri)
* **Respon Sukses `204 No Content`**

---

## 🗳️ 4. Modul Formulir Interaksi (`/api/v1/interactions`)

### 4.1 Daftar Interaksi
* **Metode & Endpoint**: `GET /api/v1/interactions`
* **Akses**: Wajib Login (User hanya melihat miliknya; Admin melihat semua)
* **Query Parameters**:
  * `kind`: Filter jenis (`vote`, `feedback`, `anon`).
  * `owner_id`: Filter ID pemilik (hanya berlaku untuk Admin).
  * `search` / `q`: Pencarian kata kunci pada judul, deskripsi, atau slug.
  * `active`: Filter status aktif (`1` atau `0`).
  * `skip`, `limit`: Paginasi.
* **Respon Sukses `200 OK`**:
  ```json
  [
    {
      "id": "i1",
      "owner_id": "u2",
      "kind": "vote",
      "title": "Pilih nama taman baru RW 05",
      "description": "Warga memilih satu nama untuk taman yang baru diresmikan.",
      "slug": "taman-rw05",
      "active": true,
      "start": "2026-10-10",
      "end": "2026-10-23",
      "options": ["Taman Mekar Asri", "Taman Bhineka", "Taman Sudirman Hijau", "Taman Cahaya"],
      "created_at": "2026-10-10T10:00:00Z"
    }
  ]
  ```

### 4.2 Buat Formulir Interaksi Baru
* **Metode & Endpoint**: `POST /api/v1/interactions`
* **Akses**: Wajib Login
* **Request Payload**:
  ```json
  {
    "kind": "vote",
    "title": "Pemilihan Desain Lapangan Warga",
    "description": "Pilih salah satu dari konsep desain ruang terbuka hijau.",
    "slug": "lapangan-warga-2026",
    "start": "2026-10-01",
    "end": "2026-10-31",
    "options": ["Konsep Minimalis", "Konsep Taman Anak", "Konsep Sport Hub"],
    "active": true
  }
  ```
* **Respon Sukses `201 Created`**: Objek interaksi baru.

### 4.3 Detail Formulir Interaksi
* **Metode & Endpoint**: `GET /api/v1/interactions/{id}`
* **Akses**: Wajib Login

### 4.4 Perbarui Formulir Interaksi
* **Metode & Endpoint**: `PATCH /api/v1/interactions/{id}`
* **Akses**: Wajib Login (Pemilik atau Admin)
* **Request Payload**: Mendukung perbaruan parsial (`title`, `description`, `active`, `start`, `end`, `options`).
* **Respon Sukses `200 OK`**

### 4.5 Hapus Formulir Interaksi
* **Metode & Endpoint**: `DELETE /api/v1/interactions/{id}`
* **Akses**: Wajib Login (Pemilik atau Admin)
* **Respon Sukses `204 No Content`**

### 4.6 Tanggapan Khusus Interaksi
* **Metode & Endpoint**: `GET /api/v1/interactions/{id}/responses`
* **Akses**: Wajib Login (Pemilik atau Admin)
* **Respon Sukses `200 OK`**: List data respon untuk formulir tersebut.

---

## 📬 5. Modul Respon / Tanggapan (`/api/v1/responses`)

### 5.1 Daftar Semua Tanggapan
* **Metode & Endpoint**: `GET /api/v1/responses`
* **Akses**: Wajib Login (User hanya melihat respon dari interaksi miliknya; Admin melihat semua)
* **Query Parameters**:
  * `interaction_id`: Filter respon berdasarkan interaksi tertentu.
  * `status`: Filter status (`Baru`, `Dibaca`, `Diproses`, `Selesai`).
  * `search`: Pencarian nama, pilihan, atau isi pesan.
* **Respon Sukses `200 OK`**:
  ```json
  [
    {
      "id": "v0",
      "interaction_id": "i1",
      "iid": "i1",
      "name": "Budi",
      "choice": "Taman Mekar Asri",
      "message": null,
      "status": "Baru",
      "reply": null,
      "shared": false,
      "created_at": "2026-10-11T12:00:00Z",
      "at": "2026-10-11T12:00:00Z"
    }
  ]
  ```

### 5.2 Perbarui Status & Balasan Tanggapan
* **Metode & Endpoint**: `PATCH /api/v1/responses/{id}`
* **Akses**: Wajib Login
* **Request Payload**:
  ```json
  {
    "status": "Diproses",
    "reply": "Terima kasih, saran telah diteruskan ke seksi kebersihan.",
    "shared": true
  }
  ```
* **Respon Sukses `200 OK`**: Objek respon terupdate.

### 5.3 Hapus Tanggapan
* **Metode & Endpoint**: `DELETE /api/v1/responses/{id}`
* **Akses**: Wajib Login
* **Respon Sukses `204 No Content`**

### 5.4 Ekspor Data Tanggapan ke CSV
* **Metode & Endpoint**: `GET /api/v1/responses/export/csv?interaction_id={id}`
* **Akses**: Wajib Login
* **Header Respon**: `Content-Type: text/csv`, `Content-Disposition: attachment; filename="responses_....csv"`
* **Respon Sukses `200 OK`**: Plain text CSV stream.

---

## 🌍 6. Modul Portal Publik Pengunjung (`/api/v1/public`)

Endpoint publik digunakan oleh masyarakat luas tanpa login / otentikasi.

### 6.1 Akses Interaksi Publik via Slug
* **Metode & Endpoint**: `GET /api/v1/public/{slug}`
* **Akses**: Bebas (Publik)
* **Respon Sukses `200 OK`**:
  ```json
  {
    "id": "i1",
    "kind": "vote",
    "title": "Pilih nama taman baru RW 05",
    "description": "Warga memilih satu nama untuk taman yang baru diresmikan.",
    "slug": "taman-rw05",
    "active": true,
    "start": "2026-10-10",
    "end": "2026-10-23",
    "options": ["Taman Mekar Asri", "Taman Bhineka", "Taman Sudirman Hijau", "Taman Cahaya"],
    "is_closed": false
  }
  ```
* **Respon Galat `404 Not Found`**:
  ```json
  {
    "detail": "Interaksi publik dengan tautan tersebut tidak ditemukan."
  }
  ```

### 6.2 Kirim Suara / Masukan / Pesan Anonim
* **Metode & Endpoint**: `POST /api/v1/public/{slug}/submit`
* **Akses**: Bebas (Publik)
* **Request Payload (Vote)**:
  ```json
  {
    "name": "Budi Santoso",
    "choice": "Taman Mekar Asri"
  }
  ```
* **Request Payload (Feedback)**:
  ```json
  {
    "name": "Ibu Siti",
    "message": "[Fasilitas] Ruang tunggu perlu ditambah kursi."
  }
  ```
* **Request Payload (Pesan Anonim)**:
  ```json
  {
    "message": "Lampu penerangan gang mawar padam sejak kemarin."
  }
  ```
* **Respon Sukses `201 Created`**:
  ```json
  {
    "message": "Tanggapan berhasil dikirim.",
    "response": {
      "id": "r_9c4e2a1b",
      "interaction_id": "i1",
      "name": "Budi Santoso",
      "choice": "Taman Mekar Asri",
      "status": "Baru",
      "created_at": "2026-10-13T12:30:00Z"
    }
  }
  ```
* **Respon Galat**:
  * `400 Bad Request`: `{"detail": "Interaksi ini sudah ditutup atau tidak aktif."}`

---

## 📊 7. Modul Analitik & Metrik (`/api/v1/analytics`)

### 7.1 Ringkasan Platform Global (Admin)
* **Metode & Endpoint**: `GET /api/v1/analytics/overview`
* **Akses**: Khusus Administrator
* **Respon Sukses `200 OK`**:
  ```json
  {
    "total_users": 3,
    "total_interactions": 5,
    "total_responses": 18,
    "by_kind": {
      "vote": { "total_interactions": 2, "total_responses": 12 },
      "feedback": { "total_interactions": 2, "total_responses": 4 },
      "anon": { "total_interactions": 1, "total_responses": 2 }
    },
    "by_status": {
      "Baru": 15,
      "Dibaca": 1,
      "Diproses": 1,
      "Selesai": 1
    },
    "recent_responses": [...]
  }
  ```

### 7.2 Statistik Personal Pengguna
* **Metode & Endpoint**: `GET /api/v1/analytics/user-stats`
* **Akses**: Wajib Login (User atau Admin)
* **Respon Sukses `200 OK`**: Metrik aggregasi khusus untuk formulir milik user yang bersangkutan.

---

## 🔄 8. Kamus Pemetaan Data (Frontend Model vs Backend Schema)

Untuk menjamin integrasi mulus tanpa modifikasi antarmuka yang merusak komponen frontend, backend dan client telah disesuaikan dengan mapping dua arah berikut:

| Frontend TypeScript Field | Backend REST JSON Field | MySQL Column Name | Tipe Data | Keterangan Kompatibilitas |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `id` | `id` | `VARCHAR(50)` | Identik (`u1`, `i1`, `r_...`) |
| `ownerId` | `owner_id` | `owner_id` | `VARCHAR(50)` | Normalisasi camelCase <-> snake_case |
| `kind` | `kind` | `kind` | `VARCHAR(20)` | `'vote'`, `'feedback'`, `'anon'` |
| `title` | `title` | `title` | `VARCHAR(255)` | Identik |
| `description` | `description` | `description` | `TEXT` | Identik |
| `slug` | `slug` | `slug` | `VARCHAR(100)` | Identik |
| `active` | `active` | `active` | `TINYINT(1)` / Boolean | Boolean casting |
| `start` | `start` | `start` | `VARCHAR(30)` | ISO Date `YYYY-MM-DD` |
| `end` | `end` | `end` | `VARCHAR(30)` | ISO Date `YYYY-MM-DD` |
| `options` | `options` | `options` | `JSON` | Otomatis di-parse ke `string[]` |
| `createdAt` | `created_at` | `created_at` | `DATETIME` | ISO 8601 UTC String |
| `iid` | `iid` & `interaction_id` | `interaction_id` | `VARCHAR(50)` | Didukung ganda oleh Backend |
| `at` | `at` & `created_at` | `created_at` | `DATETIME` | Didukung ganda oleh Backend |
| `name` | `name` | `name` | `VARCHAR(100)` | Identik |
| `choice` | `choice` | `choice` | `VARCHAR(255)` | Identik |
| `message` | `message` | `message` | `TEXT` | Identik |
| `status` | `status` | `status` | `VARCHAR(30)` | `'Baru'`, `'Dibaca'`, `'Diproses'`, `'Selesai'` |
| `reply` | `reply` | `reply` | `TEXT` | Identik |
| `shared` | `shared` | `shared` | `TINYINT(1)` / Boolean | Boolean casting |

---

## 🧪 9. Panduan Pengujian Kontrak (QA & Integration Test Matrix)

Gunakan perintah `curl` berikut untuk memvalidasi kontrak API secara otomatis pada pipeline CI/CD atau pengujian manual QA:

```bash
# 1. Health check server
curl -s -f http://localhost:8000/api/v1 | grep '"status":"ok"'

# 2. Login User
LOGIN_RES=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"id":"rina","password":"rina12345"}')
TOKEN=$(echo $LOGIN_RES | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

# 3. Akses Protected Endpoint dengan Bearer Token
curl -s -f http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"

# 4. Akses Portal Publik
curl -s -f http://localhost:8000/api/v1/public/taman-rw05

# 5. Submit Vote Publik
curl -s -f -X POST http://localhost:8000/api/v1/public/taman-rw05/submit \
  -H "Content-Type: application/json" \
  -d '{"name":"QA Tester","choice":"Taman Mekar Asri"}'
```
