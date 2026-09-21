# Forafa-App

> Platform digital untuk membangun interaksi publik melalui **Voting, Kritik & Saran, dan Pesan Anonymous** dengan sistem public link, pengelolaan respons, dan dashboard analitik terintegrasi.

**Forafa-App** adalah aplikasi web yang dirancang sebagai platform interaksi publik yang memungkinkan pengguna membuat berbagai jenis media interaksi, membagikannya melalui link publik, menerima respons dari masyarakat, serta mengelola dan menganalisis seluruh respons melalui dashboard.

Forafa-App menggabungkan tiga jenis interaksi utama dalam satu platform:

* 🗳️ **Voting / Pemilihan**
* 💬 **Kritik & Saran**
* 👻 **Pesan Anonymous**

Setiap fitur memiliki modul dan dashboard pengelolaan masing-masing, namun tetap terintegrasi dalam satu dashboard utama Forafa-App.

---

## ✨ Fitur Utama

### 🔐 Authentication & Authorization

Forafa-App menggunakan sistem autentikasi dan otorisasi untuk mengamankan akun serta membatasi akses berdasarkan role pengguna.

Fitur:

* Register akun
* Login
* Logout
* Password hashing menggunakan `bcrypt`
* Session-based authentication
* Role-Based Access Control (RBAC)
* Role **Administrator** dan **User**
* Proteksi halaman berdasarkan role
* Validasi email
* Validasi username
* Pencegahan akun duplikat
* Manajemen session pengguna

---

# 🗳️ Voting / Pemilihan

Modul Voting memungkinkan pengguna membuat pemilihan atau polling dan membagikannya kepada publik melalui sebuah link.

Pengunjung tidak perlu membuat akun untuk memberikan suara. Mereka cukup membuka link voting, memasukkan nama, kemudian memilih salah satu pilihan yang tersedia.

### Fitur Voting

* Membuat voting
* Judul dan deskripsi voting
* Menambahkan beberapa pilihan
* Mengubah voting
* Menghapus voting
* Menentukan tanggal mulai dan berakhir
* Mengaktifkan / menonaktifkan voting
* Public link untuk voting
* QR Code voting
* Share link ke berbagai platform
* Input nama pemilih
* Pemilih memilih satu pilihan
* Pembatasan **1 voting per IP address**
* Validasi voting
* Statistik hasil voting
* Grafik hasil voting
* Daftar responden
* Search responden
* Filtering
* Pagination
* Export data

### Alur Voting

```text
Pembuat membuat Voting
        ↓
Mendapatkan Public Link
        ↓
Link dibagikan kepada masyarakat
        ↓
Masyarakat membuka link
        ↓
Mengisi nama
        ↓
Memilih salah satu pilihan
        ↓
Mengirim Vote
        ↓
Sistem melakukan validasi
        ↓
Hasil masuk ke Dashboard Pembuat
```

### Contoh Penggunaan

* Pemilihan ketua organisasi
* Pemilihan ketua kelas
* Pemilihan kandidat
* Polling pendapat
* Survei pilihan
* Pengambilan keputusan kelompok
* Voting komunitas

### 📊 Dashboard Voting

Pembuat voting dapat memantau hasil melalui dashboard khusus yang menampilkan:

* Total suara
* Jumlah suara setiap pilihan
* Persentase setiap pilihan
* Grafik hasil voting
* Daftar nama pemilih
* Waktu pemberian suara
* Status voting
* Data voting secara keseluruhan

> Hasil voting hanya dapat dikelola dan dipantau oleh pembuat melalui dashboard Forafa-App.

---

# 💬 Kritik & Saran

Modul Kritik & Saran digunakan untuk mengumpulkan masukan masyarakat secara terstruktur.

Berbeda dengan Pesan Anonymous, pengirim Kritik & Saran **mengisi nama dan pesan**, sehingga identitas berupa nama dapat ditampilkan kepada pemilik form.

Konsep interaksinya memungkinkan pembuat menerima masukan, membaca, memberikan respons, dan membagikan kembali respons tersebut ke media sosial.

### Fitur Kritik & Saran

* Membuat form Kritik & Saran
* Judul custom
* Deskripsi custom
* Public link
* Form publik
* Input nama
* Input pesan
* Pengelolaan respons
* Membaca detail pesan
* Membalas pesan
* Mengubah status respons
* Search
* Filtering
* Pagination
* Statistik respons
* Share / repost respons ke media sosial

### Status Respons

Setiap kritik atau saran dapat memiliki status:

```text
Baru
↓
Dibaca
↓
Diproses
↓
Selesai
```

Status digunakan oleh pemilik form untuk mengelola dan memantau progres setiap masukan.

### Alur Kritik & Saran

```text
Pembuat membuat Form
        ↓
Mendapatkan Public Link
        ↓
Link dibagikan
        ↓
Masyarakat membuka link
        ↓
Mengisi Nama + Kritik/Saran
        ↓
Pesan diterima
        ↓
Pembuat membaca pesan
        ↓
Pembuat dapat membalas
        ↓
Pembuat dapat membagikan/repost
```

### 📱 Konsep Repost

Kritik dan saran dapat digunakan sebagai konten interaksi di media sosial.

Pembuat dapat memilih pesan tertentu dan membuat tampilan yang lebih siap untuk dibagikan, misalnya:

```text
┌─────────────────────────────┐
│           FORAFA            │
│                             │
│  Kritik & Saran             │
│                             │
│  "Menurut saya aplikasinya  │
│   sangat membantu..."       │
│                             │
│  — Nama Pengirim            │
│                             │
│          FORAFA.APP         │
└─────────────────────────────┘
```

---

# 👻 Pesan Anonymous

Modul Pesan Anonymous memungkinkan pengguna membuat sebuah link khusus yang dapat dibagikan kepada orang lain untuk menerima pesan tanpa menampilkan identitas pengirim.

Konsepnya terinspirasi dari pola interaksi aplikasi seperti NGL.

Pengirim cukup membuka link dan menuliskan pesan tanpa harus login maupun memberikan identitas.

### Fitur Pesan Anonymous

* Membuat anonymous message link
* Public link
* Share link
* Menerima pesan anonymous
* Melihat daftar pesan
* Membaca detail pesan
* Membalas pesan
* Mengelola pesan
* Share / repost pesan
* Dashboard pesan
* Statistik pesan
* Search
* Filtering
* Pagination

### Alur Pesan Anonymous

```text
Pembuat membuat Anonymous Link
        ↓
Mendapatkan Public Link
        ↓
Link dibagikan ke sosial media
        ↓
Orang lain membuka link
        ↓
Menulis pesan
        ↓
Mengirim pesan
        ↓
Pesan diterima pembuat
        ↓
Pembuat membaca pesan
        ↓
Pembuat dapat membalas
        ↓
Pembuat dapat membuat repost/share
```

### 🔒 Privasi Anonymous

Pesan Anonymous dirancang agar identitas pengirim tidak ditampilkan kepada penerima.

Sistem tidak menyimpan informasi identitas pengirim untuk kebutuhan tampilan pesan anonymous.

Pesan yang diterima hanya berfokus pada konten yang dikirimkan oleh pengguna.

---

# 📊 Dashboard

Forafa-App menggunakan konsep **satu dashboard utama** dengan tiga modul interaksi yang memiliki dashboard pengelolaan masing-masing.

```text
                    FORAFA DASHBOARD
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
       🗳️ Voting      💬 Kritik & Saran   👻 Anonymous
          │                │                │
          ▼                ▼                ▼
      Analytics         Analytics        Analytics
      Responses         Responses        Messages
      Statistics        Statistics       Statistics
      Management        Management       Management
```

### 🏠 Dashboard Utama

Dashboard utama dapat digunakan untuk melihat ringkasan aktivitas pengguna, seperti:

* Total Voting
* Total respons Voting
* Total Kritik & Saran
* Total Pesan Anonymous
* Aktivitas terbaru
* Ringkasan interaksi
* Statistik keseluruhan

---

## 🗳️ Dashboard Voting

Dashboard khusus untuk mengelola seluruh voting yang dibuat oleh pengguna.

Fitur:

* Overview voting
* Daftar voting
* Membuat voting
* Edit voting
* Hapus voting
* Detail voting
* Hasil voting
* Statistik
* Grafik
* Daftar responden
* Search
* Filter
* Pagination
* Export
* QR Code
* Share link

---

## 💬 Dashboard Kritik & Saran

Dashboard khusus untuk mengelola form dan seluruh respons Kritik & Saran.

Fitur:

* Overview
* Daftar form
* Membuat form
* Edit form
* Hapus form
* Daftar respons
* Detail respons
* Status respons
* Balasan
* Search
* Filter
* Pagination
* Statistik
* Share / repost

---

## 👻 Dashboard Pesan Anonymous

Dashboard khusus untuk mengelola anonymous link dan pesan yang diterima.

Fitur:

* Overview
* Daftar anonymous link
* Membuat link
* Edit link
* Hapus link
* Daftar pesan
* Detail pesan
* Balasan
* Search
* Filter
* Pagination
* Statistik
* Share / repost

---

# 🔗 Public Link System

Salah satu konsep utama Forafa-App adalah **public link**.

Setiap pengguna dapat membuat link dari fitur yang tersedia dan membagikannya kepada masyarakat.

Contoh konsep:

```text
Forafa-App
│
├── Voting
│   └── Public Voting Link
│
├── Kritik & Saran
│   └── Public Feedback Link
│
└── Pesan Anonymous
    └── Public Anonymous Link
```

Masyarakat dapat mengakses link tersebut tanpa harus memiliki akun Forafa-App.

Akun Forafa-App digunakan oleh **pembuat/pemilik interaksi** untuk mengelola dan melihat hasilnya.

---

# 📱 Social Sharing

Forafa-App dirancang dengan konsep yang mendukung penyebaran link dan hasil interaksi melalui media sosial.

Pengguna dapat membagikan:

* Public voting link
* Kritik & saran link
* Anonymous message link
* Respons tertentu
* Balasan
* Konten repost

Tujuannya agar interaksi yang dibuat di Forafa-App dapat dengan mudah digunakan dalam komunitas maupun media sosial.

---

# 🛡️ Role System

Forafa-App menggunakan Role-Based Access Control (RBAC).

### User

Pengguna biasa dapat:

* Membuat voting
* Membuat Kritik & Saran
* Membuat Anonymous Link
* Mengelola interaksi miliknya
* Melihat respons
* Membalas pesan
* Melihat analytics
* Membagikan link
* Membagikan/repost respons

### Administrator

Administrator memiliki akses pengelolaan sistem sesuai dengan permission yang diberikan.

Administrator dapat digunakan untuk kebutuhan:

* Manajemen pengguna
* Pengawasan sistem
* Pengelolaan data
* Pengelolaan konten
* Monitoring aktivitas
* Administrasi platform

---

# 🔄 Gambaran Sistem

Secara keseluruhan, alur utama Forafa-App:

```text
                    USER
                     │
                Register/Login
                     │
                     ▼
              FORAFA DASHBOARD
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
     VOTING       KRITIK &      ANONYMOUS
                   SARAN
        │            │            │
        └────────────┼────────────┘
                     │
                     ▼
                PUBLIC LINK
                     │
                     ▼
                 MASYARAKAT
                     │
                     ▼
                  RESPONSE
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
      Vote        Feedback       Message
        │            │            │
        └────────────┼────────────┘
                     │
                     ▼
                  DASHBOARD
                     │
                     ▼
               ANALYTICS & DATA
```

---

# 🎯 Tujuan Forafa-App

Forafa-App dibuat untuk menyediakan sebuah platform sederhana dan terintegrasi dalam membangun komunikasi serta interaksi antara pembuat dan masyarakat.

Platform ini dapat digunakan untuk berbagai kebutuhan, seperti:

* Organisasi
* Komunitas
* Sekolah
* Kampus
* Event
* Bisnis
* Content Creator
* Personal branding
* Survei
* Polling
* Pengumpulan kritik & saran
* Interaksi anonymous

---

# 🚀 Konsep Utama

Forafa-App dibangun dengan tiga prinsip utama:

### 🗳️ Participate

Memberikan ruang bagi masyarakat untuk ikut berpartisipasi melalui voting dan memberikan pendapat.

### 💬 Communicate

Menyediakan media untuk menyampaikan kritik, saran, maupun pesan secara langsung kepada pembuat.

### 📊 Analyze

Membantu pembuat memahami respons yang diterima melalui dashboard dan statistik yang terintegrasi.

---

# 🧩 Arsitektur Modul

Secara konseptual, Forafa-App terdiri dari beberapa modul:

```text
Forafa-App
│
├── Authentication
│
├── User Management
│
├── Dashboard
│
├── Voting Module
│   ├── Voting Management
│   ├── Public Voting
│   ├── Vote Validation
│   └── Voting Analytics
│
├── Kritik & Saran Module
│   ├── Form Management
│   ├── Public Feedback
│   ├── Response Management
│   ├── Reply
│   └── Feedback Analytics
│
├── Anonymous Message Module
│   ├── Link Management
│   ├── Public Message
│   ├── Message Management
│   ├── Reply
│   └── Message Analytics
│
├── Social Sharing
│
└── Administration
```

---

# 🛠️ Tech Stack

> Bagian ini dapat disesuaikan dengan teknologi yang digunakan dalam proses pengembangan.

Contoh:

* **Frontend:** React / Next.js
* **Styling:** Tailwind CSS
* **Backend:** Node.js / Express
* **Database:** PostgreSQL / MySQL
* **Authentication:** Session-based Authentication
* **Password Hashing:** bcrypt
* **Charts:** Chart.js / Recharts
* **QR Code:** QR Code Generator
* **Version Control:** Git & GitHub

---

# 📌 Project Status

> 🚧 **Currently in Development**

Forafa-App masih dalam tahap pengembangan dan fitur dapat berubah seiring proses development, testing, dan evaluasi sistem.

---

# 👨‍💻 Development

Forafa-App dikembangkan sebagai project aplikasi web dengan fokus pada:

* Public interaction
* Form management
* Dashboard analytics
* Secure authentication
* Role-based access
* Responsive UI
* Social sharing
* User experience

---

# 📄 License

License project dapat ditentukan sesuai kebutuhan tim pengembang.
