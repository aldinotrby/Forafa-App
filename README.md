# Forafa-App

Panduan lengkap dan praktis untuk mengoperasikan serta menjalankan aplikasi **Forafa-App** (Frontend, Backend, dan Database MySQL) secara bersamaan di lingkungan lokal (*development*).

---

## 📋 Prasyarat Sistem (*Prerequisites*)

Pastikan lingkungan lokal Anda telah terpasang dependensi berikut:

1. **Node.js**: Versi `>= 18.0.0` (termasuk `npm`).
2. **PHP**: Versi `>= 8.1.0` (dengan ekstensi `pdo_mysql`, `mbstring`, `json`, dan `curl` aktif).
3. **MySQL Server**: MySQL 8.0 atau MariaDB (dapat dijalankan melalui **Laragon**, **XAMPP**, **Docker**, atau layanan sistem bawaan). Pastikan layanan MySQL aktif pada port default `3306`.

---

## 🗄️ Langkah 1: Inisialisasi & Migrasi Database MySQL

Sebelum menjalankan server untuk pertama kali, lakukan pembuatan database `forafa_db` dan pengisian tabel bawaan:

1. Buka terminal lalu masuk ke folder `server`:
   ```powershell
   cd server
   ```
2. Jalankan skrip setup database:
   ```powershell
   php setup.php
   ```
   > **Catatan:** Skrip ini secara otomatis membuat database `forafa_db`, tabel-tabel (`users`, `interactions`, `responses`), serta mengisi data awal (*seed data*).

---

## 🚀 Langkah 2: Menjalankan Backend & Frontend

Aplikasi memerlukan dua proses server yang berjalan secara berdampingan.

### Opsi A: Menggunakan 2 Terminal Terpisah (Direkomendasikan)

#### **Terminal 1: Jalankan Server Backend API (Port 8000)**
```powershell
cd server
php -S 127.0.0.1:8000 router.php
```
*Atau menggunakan runner Node:*
```powershell
npm start
```
> ✅ Server backend aktif di: **`http://localhost:8000/api/v1`**

---

#### **Terminal 2: Jalankan Server Frontend Vite (Port 5173)**
```powershell
cd client
npm install      # Jalankan jika dependensi belum terpasang
npm run dev
```
> ✅ Aplikasi frontend aktif di: **`http://localhost:5173`**

---

### Opsi B: Menjalankan Sekaligus via PowerShell (Satu Perintah)

Jika Anda ingin membuka kedua server secara langsung di jendela PowerShell terpisah:

```powershell
# Jalankan dari root direktori proyek Forafa-App:
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd server; php -S 127.0.0.1:8000 router.php"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd client; npm run dev"
```

---

## 🌐 Akses Aplikasi & Akun Demo Pengujian

Akses aplikasi melalui peramban web di alamat: **[http://localhost:5173](http://localhost:5173)**

Gunakan akun demo berikut untuk menguji berbagai peran dan fitur aplikasi:

| Peran (*Role*) | Username / Email | Password | Hak Akses Fitur |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin` *(atau `admin@forafa.app`)* | `admin12345` | Akses panel admin, kelola semua user, lihat statistik overview, dan rekap semua interaksi. |
| **Pengguna 1** | `rina` *(atau `rina@desa-mekar.id`)* | `rina12345` | Dashboard user, membuat voting/feedback/pesan anonim, serta melihat tanggapan masuk. |
| **Pengguna 2** | `budi_rw` *(atau `budi@rw05.id`)* | `budi12345` | Dashboard user khusus area RW 05. |
| **Pengunjung (Publik)** | Tanpa Login | *-* | Akses tautan publik (contoh: `http://localhost:5173/#/p/taman-rw05`) untuk mengirim suara atau masukan. |

---

## 🔍 Verifikasi Integrasi Server

Untuk memastikan seluruh layanan terhubung dengan benar tanpa masalah CORS atau jaringan:

1. **Uji Direct Health Check API Backend**:
   ```bash
   curl.exe http://localhost:8000/api/v1
   ```
   *Respon yang diharapkan:* `{"status":"ok","service":"Forafa-App Backend API", ...}`

2. **Uji Reverse Proxy Frontend**:
   ```bash
   curl.exe http://localhost:5173/api/v1
   ```
   *Respon yang diharapkan:* Harus sama persis dengan poin nomor 1. Hal ini menandakan bahwa Vite dev server berhasil meneruskan permintaan API ke backend tanpa kendala CORS.