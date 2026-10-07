# 🚀 Forafa-App — Fullstack Platform

Platform Partisipasi Publik: Voting, Kritik & Saran, dan Pesan Anonim.

---

## 📁 Struktur Repositori & Direktori Server

```text
forafa-app/
├── server/
│   ├── src/
│   │   ├── config/
│   │   │   ├── config.php            # Konfigurasi global & pemuat .env
│   │   │   └── database.php          # Koneksi database PDO MySQL (Singleton)
│   │   ├── controllers/
│   │   │   ├── AnalyticsController.php   # Statistik agregasi platform & user
│   │   │   ├── AuthController.php        # Register, Login, Logout, & Me
│   │   │   ├── InteractionController.php # CRUD Voting, Feedback, & Anon
│   │   │   ├── PublicController.php      # Portal publik pengunjung
│   │   │   ├── ResponseController.php    # Manajemen tanggapan & ekspor CSV
│   │   │   └── UserController.php        # Manajemen akun pengguna (Admin)
│   │   ├── middlewares/
│   │   │   ├── AuthMiddleware.php        # Validasi Bearer Token JWT & RBAC
│   │   │   └── CorsMiddleware.php        # Pengaturan CORS & preflight OPTIONS
│   │   ├── models/
│   │   │   ├── Interaction.php           # Logika interaksi & periode aktif
│   │   │   ├── Response.php              # Logika tanggapan & generator CSV
│   │   │   └── User.php                  # Logika pengguna & Bcrypt hashing
│   │   ├── routes/
│   │   │   ├── Router.php                # Route dispatcher
│   │   │   └── api.php                   # Pendaftaran seluruh endpoint API
│   │   ├── utils/
│   │   │   ├── JWT.php                   # Encoder & Decoder JWT Native HS256
│   │   │   ├── Response.php              # Helper output JSON & CSV
│   │   │   └── Slug.php                  # Generator URL slug ramah & unik
│   │   ├── app.js                        # Node runner bridge
│   │   └── index.php                     # Entry point front controller
│   ├── tests/                            # Direktori automated testing
│   ├── .env.example                      # Template variabel lingkungan
│   ├── .env                              # File konfigurasi aktif lokal
│   ├── .htaccess                         # Konfigurasi rewrite Apache
│   ├── database.sql                      # Skema DDL & seed data bawaan
│   ├── index.php                         # Root forwarder
│   ├── package.json                      # Konfigurasi server runner
│   ├── router.php                        # Router untuk PHP CLI built-in server
│   ├── seed.php                          # Script seeder data awal
│   └── setup.php                         # Script inisialisasi database otomatis
├── docs/
│   ├── api_specifications.md             # Dokumen spesifikasi teknis API lengkap
│   ├── database_schema.md                # Data Dictionary & kamus tabel
│   └── database_schema.sql               # Baseline DDL Schema script
└── README.md                             # Panduan ini
```

---

## ⚙️ Persyaratan Sistem (*Prerequisites*)

* **PHP 8.1 / 8.2 / 8.3+** (dengan ekstensi `pdo_mysql`, `openssl`, `json`, `mbstring`)
* **MySQL 8.0+** atau **MariaDB 10.4+** (atau Cloud Database seperti Aiven, Clever Cloud, Supabase)
* Direkomendasikan menggunakan **Laragon** atau **XAMPP** di Windows.

---

## 🛠️ Panduan Menjalankan Backend (*Quickstart*)

### 1. Inisialisasi Database
Pastikan MySQL sudah berjalan (misal: tombol **Start All** di Laragon), lalu jalankan:
```bash
cd server
php setup.php
```
Script otomatis membuat database `forafa_db`, tabel `users`, `interactions`, dan `responses`, serta mengisi data awal akun default:
* **Administrator**: `admin` / `admin12345` (`admin@forafa.app`)
* **User 1**: `rina` / `rina12345` (`rina@desa-mekar.id`)
* **User 2**: `budi_rw` / `budi12345` (`budi@rw05.id`)

### 2. Konfigurasi Variabel Lingkungan (`.env`)
Salin template konfigurasi:
```bash
cp .env.example .env
```
Default konfigurasi lokal:
```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=forafa_db
DB_USERNAME=root
DB_PASSWORD=

JWT_SECRET=forafa_secret_key_native_php_2026_change_in_production
JWT_EXPIRE_MINUTES=1440
API_PREFIX=/api/v1
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000
```

### 3. Menjalankan Server Backend
Jalankan server pengembangan lokal menggunakan salah satu cara berikut:

#### Cara A: PHP CLI Built-in Server (Paling Cepat)
```bash
cd server
php -S 0.0.0.0:8000 router.php
```

#### Cara B: Menggunakan npm runner
```bash
cd server
npm run dev:php
# Atau via Node bridge:
node src/app.js
```

API sekarang aktif di:
👉 **`http://localhost:8000/api/v1`**  
👉 Health Check: **`http://localhost:8000/health`**
