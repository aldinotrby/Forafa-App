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
   http://localhost:5173
   ```

## 📁 Project Structure

```
src/
├── pages/                  # Page/Route components
│   ├── Auth.tsx           # Login & Register
│   ├── Public.tsx         # Public voting/feedback pages
│   ├── UserWorkspace.tsx  # User dashboard
│   └── AdminDashboard.tsx # Admin panel
│
├── components/            # Reusable components
│   ├── ui.tsx            # UI components (buttons, cards, etc)
│   ├── MediaUpload.tsx    # File upload component
│   └── SessionStatus.tsx  # Login status & session info (panel + pill)
│
├── services/             # Business logic
│   ├── store.tsx         # React Context + state management (auth & session)
│   ├── googleAuth.ts     # Google Sign-In (Google Identity Services)
│   └── mediaService.ts   # Cloudinary integration
│
├── App.tsx               # Main router
├── Workspace.tsx         # Role-based router
├── main.tsx              # Entry point
├── index.css             # Global styles
└── vite-env.d.ts         # Type declarations
```

## 🔧 Available Scripts

### Development

```bash
npm run dev       # Start dev server (http://localhost:5173)
npm run preview   # Preview production build
```

### Production

```bash
npm run build     # Build for production
npm run build:analyze  # Analyze bundle size (if configured)
```

### Testing

```bash
npm run test      # Run tests (if configured)
npm run test:watch # Watch mode (if configured)
```

## 🎯 Main Features

### 🗳️ Voting System
- Create voting interactions
- Multiple choice voting
- Real-time result visualization
- Vote count & percentage display

### 💬 Feedback & Suggestions
- Structured feedback collection
- Category/topic organization
- Status tracking (New → Processed → Closed)
- Admin reply system

### 🕵️ Anonymous Messages
- Anonymous submission
- Identity protection
- No name/tracking info stored
- Transparent communication

### 🪪 Pilihan Identitas (Form Publik)

Pengunjung yang membuka public link (Voting & Kritik & Saran) memilih
identitasnya sebelum mengisi:

- **Tampilkan nama** — nama ditulis sendiri dan tampil bersama jawaban
  kepada pemilik interaksi.
- **Isi sebagai Anonymous** — kolom nama disembunyikan; nama tidak diminta
  dan tidak disimpan, jawaban tercatat sebagai "Anonim" (kolom
  `Response.anonymous`, nama dikirim kosong — sesuai kontrak API backend
  yang memang menerima `name: null` dan memaksa anonim untuk jenis `anon`).

Alur form publik:

```
1. Keterangan privasi ditampilkan di bagian atas form, sebelum mengisi
2. Pengunjung memilih identitas → status pilihannya selalu tampil
   (chip di judul, bar status di form, dan ringkasan di konfirmasi)
3. Isi jawaban (vote / kritik & saran)
4. Tahap KONFIRMASI: ringkasan identitas + jawaban ditampilkan,
   jawaban baru terkirim setelah menekan "Ya, kirim jawaban"
   (atau "Kembali, periksa lagi" untuk mengubah isian)
5. Layar selesai menyebutkan terkirim sebagai Anonymous / atas nama siapa
```

Di sisi pemilik, respons anonim tampil sebagai "Anonim" dengan badge
**Anonymous** (daftar respons, aktivitas terbaru, dan export CSV).
Interaksi jenis Pesan Anonim selalu terkunci pada mode Anonymous.

### 👥 User Management
- Register & login
- Profile customization
- Avatar upload
- 2 user roles (User & Admin)

### 📊 Analytics Dashboard
- Total users, interactions, responses count
- Response status distribution
- Recent activity timeline
- User interaction statistics

### 📸 Media Upload
- Profile avatar upload (200x200px)
- Interaction banner upload (800x400px)
- Cloudinary cloud storage (recommended)
- Base64 local fallback
- Automatic compression & optimization

## 🔐 Authentication

### Register
```
1. Click "Daftar sekarang"
2. Enter username (3-20 chars)
3. Enter email (valid format)
4. Enter password (min 8 chars)
5. Account created → auto login as User
```

### Login
```
1. Enter username or email
2. Enter password
3. Redirected to dashboard (role-based)
```

### Login dengan Google
```
1. Click "Lanjutkan dengan Google" (tombol resmi Google Identity Services)
2. Choose a Google account — ID token (JWT) dikembalikan Google ke browser
3. Klaim token divalidasi di client: issuer Google, masa berlaku,
   dan audience == VITE_GOOGLE_CLIENT_ID
4. Akun dengan email yang sama ditautkan ke Google; email baru otomatis
   dibuatkan akun User (username diturunkan dari alamat email)
```

Setup: buat OAuth 2.0 Client ID (Web) di Google Cloud Console, daftarkan
origin aplikasi (mis. `http://localhost:5173`) sebagai Authorized JavaScript
origin, lalu isi `VITE_GOOGLE_CLIENT_ID` di `.env` (lihat `client/.env.example`).
Tanpa variabel itu, tombol Google menampilkan petunjuk konfigurasi.

> Keamanan: validasi di browser ini untuk frontend standalone. Untuk
> production, ID token wajib diverifikasi ulang di server (signature +
> audience) sebelum sesi dibuat.

### Session & Kondisi Akun

- **Sesi hanya selama halaman terbuka (mode ketat)** — sesi tersimpan di
  `sessionStorage` (`fa_session` + `fa_session_info`: cara login, waktu
  login, aktivitas terakhir, waktu tab dibuka) dan **diakhiri begitu
  halaman ditinggalkan**: menutup tab, memuat ulang halaman (F5), atau
  pindah ke situs lain menghapus sesi, sehingga membuka aplikasi lagi
  selalu mulai dari halaman login. Halaman yang dipulihkan dari
  back-forward cache (tombol Back) juga langsung dikeluarkan ke halaman
  login. Jejak di luar sesi (`fa_session_history`: waktu tab terakhir
  ditutup & logout terakhir) tetap disimpan di localStorage dan
  ditampilkan di halaman login.
- **Kondisi saat tab dibuka/ditutup** — provider mendengarkan
  `visibilitychange`, `focus`/`blur` (presence: Online / Tab tidak aktif),
  `pagehide`/`beforeunload` (mencatat waktu tab ditutup ke
  `fa_session_history` dan mengakhiri sesi), dan `pageshow` (mengakhiri
  sesi bila halaman dipulihkan dari back-forward cache). Sesi tidak
  disinkronkan antar-tab: setiap tab mempunyai sesinya sendiri, dan
  login/logout di satu tab tidak memengaruhi tab lain. Data pengguna
  (`fa_users`) tetap tersinkron antar-tab lewat event `storage`.
- **Status login pengguna** — komponen `SessionStatus` menampilkan status
  login (Masuk/Belum masuk), identitas, role, cara login (Password/Google),
  presence, waktu login & aktivitas terakhir. Tampil sebagai panel di
  sidebar User Workspace & Admin Panel, sebagai pill di header dashboard,
  dan sebagai ringkasan di halaman login (termasuk logout terakhir dan
  waktu tab terakhir ditutup).
- **Logout** — tombol "Keluar" tersedia di sidebar User Workspace dan
  Admin Panel (desktop & mobile). Logout menghapus sesi dan info sesinya,
  mencatat waktu logout, dan memanggil `disableAutoSelect()` Google agar
  pengguna tidak otomatis masuk lagi lewat One Tap.

### Roles
- **User**: Create & manage own interactions
- **Administrator**: View all interactions, manage users

## 📸 Media Storage

### Cloudinary Setup (Recommended)

1. Register at https://cloudinary.com (Free Tier)
2. Copy Cloud Name from dashboard
3. Create Upload Preset (Unsigned)
4. Add to `.env`:
   ```env
   VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
   VITE_CLOUDINARY_UPLOAD_PRESET=forafa_unsigned
   ```
   > **Catatan:** Skrip ini secara otomatis membuat database `forafa_db`, tabel-tabel (`users`, `interactions`, `responses`), serta mengisi data awal (*seed data*).

---

## 🚀 Langkah 2: Menjalankan Backend & Frontend

// State persisted to localStorage:
// - fa_users
// - fa_session
// - fa_session_info (detail sesi: provider, loginAt, lastSeenAt, tabOpenedAt, restored)
// - fa_session_history (lastTabClosedAt, lastLogoutAt)
// - fa_inter
// - fa_resp
// - fa_media
```

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
