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

## 🔐 2. Modul Autentikasi (`/api/v1/auth`)

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
    }
  }
  ```

### 2.2 Login Pengguna & Administrator
* **Method & URL**: `POST /api/v1/auth/login`
* **Akses**: Publik
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
    }
  }
  ```

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

## 🗳️ 4. Modul Formulir Interaksi (`/api/v1/interactions`)

### 4.1 Daftar Interaksi
* **Method & URL**: `GET /api/v1/interactions`
* **Query Params**: `kind` (`vote` | `feedback` | `anon`), `owner_id`, `search`, `active`, `skip`, `limit`
* **Response `200 OK`**: List formulir interaksi milik user (atau semua jika Admin).

### 4.2 Buat Formulir Interaksi Baru
* **Method & URL**: `POST /api/v1/interactions`
* **Request Body**:
  ```json
  {
    "kind": "vote",
    "title": "Pemilihan Desain Lapangan Warga",
    "description": "Pilih salah satu dari konsep desain ruang terbuka hijau.",
    "slug": "lapangan-warga-2026",
    "start": "2026-10-01",
    "end": "2026-10-31",
    "options": ["Konsep Minimalis", "Konsep Taman Anak", "Konsep Sport Hub"]
  }
  ```
* **Response `201 Created`**

### 4.3 Detail Formulir Interaksi
* **Method & URL**: `GET /api/v1/interactions/{id}`

### 4.4 Perbarui Formulir Interaksi
* **Method & URL**: `PATCH /api/v1/interactions/{id}`

### 4.5 Hapus Formulir Interaksi
* **Method & URL**: `DELETE /api/v1/interactions/{id}`

### 4.6 Tanggapan untuk Interaksi Tertentu
* **Method & URL**: `GET /api/v1/interactions/{id}/responses`

---

## 📬 5. Modul Tanggapan / Respons (`/api/v1/responses`)

### 5.1 Daftar Semua Tanggapan
* **Method & URL**: `GET /api/v1/responses`
* **Query Params**: `interaction_id`, `status` (`Baru` | `Dibaca` | `Diproses` | `Selesai`), `search`, `skip`, `limit`

### 5.2 Perbarui Status & Balasan Tanggapan
* **Method & URL**: `PATCH /api/v1/responses/{id}`
* **Request Body**: `{"status": "Diproses", "reply": "...", "shared": true}`

### 5.3 Hapus Tanggapan
* **Method & URL**: `DELETE /api/v1/responses/{id}`

### 5.4 Ekspor Data Tanggapan ke CSV
* **Method & URL**: `GET /api/v1/responses/export/csv?interaction_id={id}`
* **Header Response**: `Content-Type: text/csv`

---

## 🌍 6. Modul Portal Publik Pengunjung (`/api/v1/public`)

### 6.1 Buka Tampilan Publik via Slug
* **Method & URL**: `GET /api/v1/public/{slug}`
* **Akses**: Bebas (Tanpa Login)

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

---

## 📊 7. Modul Analitik & Ringkasan Metrik (`/api/v1/analytics`)

### 7.1 Overview Statistik Platform (Admin Only)
* **Method & URL**: `GET /api/v1/analytics/overview`
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

### 7.2 Statistik Personal User (`/api/v1/analytics/user-stats`)
* **Method & URL**: `GET /api/v1/analytics/user-stats`
* **Akses**: Wajib Login
