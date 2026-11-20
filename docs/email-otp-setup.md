# Verifikasi Email Pendaftaran — OTP 5 Digit via Gmail

Pendaftaran akun email di Forafa-App wajib terverifikasi: setelah mengisi
form daftar, kode **5 digit** dikirim ke email pendaftar dari
**forafagroup@gmail.com**. Tanpa kode yang benar, akun tidak dibuat —
tidak ada kode demo dan kode tidak pernah ditampilkan di layar.

## Alur untuk pengguna (yang mendaftar)

1. Buka halaman login → **Daftar sekarang**.
2. Isi username, email, password → klik **Kirim kode verifikasi**.
3. Buka inbox email (cek juga folder **Spam** bila tidak ada) — email dari
   `forafagroup@gmail.com`, subjek `Kode verifikasi Forafa-App: 12345`.
4. Masukkan 5 digit kode di halaman daftar → klik **Verifikasi & buat akun**.
5. Selesai — akun langsung dibuat dan pengguna masuk ke workspace.

Aturan kode:

- Berlaku **10 menit** (hitung mundur tampil di layar).
- Salah maksimal **3 kali** — setelah itu kode hangus, minta kode baru.
- Kirim ulang paling cepat **60 detik** setelah kirim sebelumnya.
- Setelah kode benar, pendaftaran harus diselesaikan dalam **15 menit**
  (token verifikasi sekali pakai).

Daftar dengan **Google** tidak memakai kode ini — email Google sudah
terverifikasi oleh Google sendiri.

## Alur untuk pengelola (supaya kodenya benar-benar terkirim)

Pengiriman memakai SMTP Gmail, tanpa library tambahan (implementasi ada di
`server/src/utils/Mailer.php`). Gmail **tidak menerima password akun biasa**
untuk SMTP — yang dipakai adalah **App Password** 16 karakter.

### 1. Aktifkan verifikasi 2 langkah di akun forafagroup@gmail.com

1. Login ke akun Google `forafagroup@gmail.com` di browser.
2. Buka <https://myaccount.google.com/security> →
   **2-Step Verification** → ikuti langkahnya sampai aktif
   (butuh nomor HP untuk menerima kode awal).
3. Kembali ke halaman Security → **App passwords**
   (bila tidak muncul, buka langsung
   <https://myaccount.google.com/apppasswords>).
4. Pilih app **Mail** dan device **Other (Custom name)** → isi nama
   `Forafa-App` → **Generate**.
5. Salin kode 16 karakter yang muncul (format `abcd efgh ijkl mnop`).
   Kode ini hanya tampil sekali — bila hilang, hapus dan buat baru.

### 2. Isi `server/.env`

Salin template dari `server/.env.example` ke `server/.env`, lalu isi:

```env
MAIL_FROM_ADDRESS=forafagroup@gmail.com
MAIL_FROM_NAME="Forafa-App"
MAIL_HOST=smtp.gmail.com
MAIL_PORT=465
MAIL_ENCRYPTION=ssl
MAIL_USERNAME=forafagroup@gmail.com
MAIL_APP_PASSWORD=abcdefghijklmnop   # kode 16 karakter TANPA spasi
EMAIL_OTP_EXPIRE_MINUTES=10
EMAIL_OTP_MAX_ATTEMPTS=3
EMAIL_OTP_RESEND_COOLDOWN_SECONDS=60
EMAIL_OTP_TOKEN_EXPIRE_MINUTES=15
```

Jangan isi `MAIL_APP_PASSWORD` dengan password login Gmail biasa —
Gmail menolaknya dan pengguna akan melihat pesan
"Login SMTP gagal".

### 3. Siapkan database

Untuk database baru:

```bash
cd server
php setup.php
```

Untuk database yang sudah ada (mis. `forafa_db` dari instalasi lama),
jalankan SQL ini sekali (atau hapus database dan jalankan `setup.php`):

```sql
USE forafa_db;
ALTER TABLE users
  ADD COLUMN bio VARCHAR(160) NULL,
  ADD COLUMN avatar TEXT NULL,
  ADD COLUMN username_changed_at DATETIME NULL,
  ADD COLUMN email_changed_at DATETIME NULL;
CREATE TABLE IF NOT EXISTS `email_otps` (
  `id` VARCHAR(50) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `otp_hash` VARCHAR(64) NOT NULL,
  `verification_token` VARCHAR(64) NULL,
  `token_expires_at` DATETIME NULL,
  `attempts` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `expires_at` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_email_otps_email` (`email`),
  KEY `idx_email_otps_token` (`verification_token`),
  KEY `idx_email_otps_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 4. Jalankan backend

```bash
cd server
php -S localhost:8000 router.php
```

Di terminal lain jalankan frontend:

```bash
cd client
npm run dev
```

### 5. Uji

1. Daftar akun baru dengan email yang bisa Anda buka.
2. Pastikan email kode masuk (cek spam bila tidak ada).
3. Masukkan kode → akun terbuat.

Bila gagal, pesan error di layar menjelaskan penyebabnya:

| Pesan | Artinya |
| --- | --- |
| `Backend tidak terjangkau…` | Server PHP tidak jalan — jalankan langkah 4. |
| `Pengiriman email belum dikonfigurasi…` | `MAIL_USERNAME` / `MAIL_APP_PASSWORD` kosong di `server/.env`. |
| `Login SMTP gagal…` | App Password salah / masih berisi password akun biasa — ulangi langkah 1. |
| `Tidak bisa terhubung ke server SMTP…` | Periksa `MAIL_HOST`/`MAIL_PORT` dan koneksi internet. |
| `Tunggu N detik…` | Kirim ulang terlalu cepat — tunggu hitung mundurnya. |

## Endpoint (untuk referensi)

- `POST /api/v1/auth/email-otp/send` — body `{ "email" }`.
  Mengembalikan pesan + `expires_in_seconds` + `resend_after_seconds`.
  Kode **tidak pernah** ada di respons.
- `POST /api/v1/auth/email-otp/verify` — body `{ "email", "code" }`.
  Bila benar, mengembalikan `verification_token` sekali pakai.
- `POST /api/v1/auth/register` — body
  `{ "username", "email", "password", "verification_token" }`.
  Bila SMTP sudah dikonfigurasi, token wajib ada dan valid; tanpa itu
  pendaftaran ditolak (422). Bila SMTP belum dikonfigurasi sama sekali
  (mis. CI tanpa mail), pendaftaran tanpa token tetap bisa — tapi frontend
  tidak akan pernah sampai ke sana, karena pengiriman kode sudah gagal
  lebih dulu.

## Catatan keamanan

- Kode hanya disimpan sebagai **hash SHA-256** (`email:kode:secret`) di
  tabel `email_otps`; kode aslinya tidak tersimpan di mana pun.
- Bila pengiriman email gagal, kode yang sempat dibuat langsung
  dihanguskan supaya tidak ada kode "hantu" yang tidak pernah sampai.
- Token verifikasi sekali pakai: setelah dipakai mendaftar, token hangus.
- Profil: username & email masing-masing hanya bisa diganti 1x dalam
  7 hari; ganti password akun email wajib memasukkan password lama.
  Aturan ini ditegakkan di frontend (`client/src/services/profile.ts`,
  `store.tsx`) dan di backend (`server/src/controllers/UserController.php`).
