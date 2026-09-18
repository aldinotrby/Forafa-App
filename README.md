# Forafa-App
Forafa-App — Platform digital untuk membangun interaksi publik melalui voting, kritik &amp; saran, dan pesan anonymous dengan dashboard analitik terintegrasi.

# Forafa-App

> Platform digital untuk membangun interaksi publik melalui voting, kritik & saran, dan pesan anonymous dengan dashboard analitik terintegrasi.

Forafa-App adalah aplikasi web yang dirancang sebagai platform interaksi publik yang memungkinkan pengguna membuat berbagai jenis formulir interaksi dan membagikannya melalui link kepada masyarakat.

Forafa-App menyediakan tiga fitur utama:

- 🗳️ **Voting / Pemilihan**
- 💬 **Kritik & Saran**
- 👻 **Pesan Anonymous**

Setiap fitur memiliki dashboard pengelolaan tersendiri sehingga pengguna dapat membuat, mengelola, memantau, dan menganalisis respons dengan lebih terstruktur.

---

## ✨ Fitur Utama

### 🔐 Authentication & Authorization

- Register akun
- Login
- Logout
- Password hashing menggunakan bcrypt
- Session-based authentication
- Role-Based Access Control (RBAC)
- Role Administrator dan User
- Proteksi halaman berdasarkan role
- Validasi email dan username
- Pencegahan akun duplikat

---

### 🗳️ Voting / Pemilihan

Pengguna dapat membuat sistem voting atau pemilihan sendiri dan membagikannya kepada publik melalui link.

Fitur:

- Membuat voting
- Menambahkan beberapa pilihan
- Mengubah voting
- Menghapus voting
- Menentukan tanggal mulai dan berakhir
- Mengaktifkan/nonaktifkan voting
- Link publik untuk voting
- Statistik hasil voting
- Grafik hasil voting
- Daftar responden
- Search & filtering
- Pagination
- Export data
- QR Code voting
- Share link ke berbagai platform

Contoh penggunaan:

- Pemilihan ketua organisasi
- Polling pendapat
- Pemilihan kandidat
- Survei pilihan
- Pengambilan keputusan kelompok

---

### 💬 Kritik & Saran

Modul untuk mengumpulkan masukan dari masyarakat secara terstruktur.

Fitur:

- Membuat form kritik & saran
- Judul dan deskripsi custom
- Kategori kritik/saran
- Form publik
- Pengelolaan respons
- Status respons
- Search
- Filter
- Pagination
- Statistik respons

Status respons:

```text
Baru
Dibaca
Diproses
Selesai
