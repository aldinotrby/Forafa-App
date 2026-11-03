# 📸 Media Storage Setup - Forafa-App

## Overview

Forafa-App mendukung upload media (gambar profil & banner interaksi) dengan dua opsi:

1. **Cloudinary (Free Tier)** - Cloud storage dengan unlimited uploads
2. **Local Storage (Base64)** - Fallback otomatis jika Cloudinary tidak tersedia

---

## 🚀 Setup Cloudinary (Recommended)

### Step 1: Buat Akun Cloudinary

1. Kunjungi https://cloudinary.com/users/register/free
2. Daftar dengan email Anda
3. Verifikasi email

### Step 2: Dapatkan Cloud Name

1. Login ke [Cloudinary Dashboard](https://cloudinary.com/console)
2. Di halaman utama, cari **"Cloud name"** di bagian atas
3. Copy cloud name Anda (format: `xxx-123456`)

### Step 3: Buat Upload Preset (Unsigned)

**Upload Preset** adalah konfigurasi upload tanpa perlu API key di frontend.

1. Buka Settings → **Upload** tab
2. Scroll ke **Upload presets**
3. Klik **Add upload preset**
4. Isi form:
   - **Upload preset name**: `forafa_unsigned`
   - **Signing Mode**: `Unsigned` ⭐ (PENTING)
   - **Folder**: `/forafa` (optional)
   - Klik **Save**

### Step 4: Konfigurasi di Project

1. Copy `.env.example` ke `.env` di folder `client/`:

```bash
cp client/.env.example client/.env
```

2. Edit `client/.env`:

```env
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name_here
VITE_CLOUDINARY_UPLOAD_PRESET=forafa_unsigned
```

Ganti dengan nilai yang sudah Anda dapatkan.

### Step 5: Restart Dev Server

```bash
npm run dev
```

---

## 📝 Fitur Media Storage

### Upload Profil Pengguna

- **Lokasi**: Admin Panel → Manajemen Pengguna → Edit User
- **Ukuran Max**: 5MB
- **Format**: JPG, PNG, WebP
- **Resize Otomatis**: 200x200px (rounded)

### Upload Banner Interaksi

- **Lokasi**: User Workspace → Buat Interaksi (Vote/Feedback/Anonim)
- **Ukuran Max**: 5MB
- **Format**: JPG, PNG, WebP
- **Resize Otomatis**: 800x400px

### Data Persistence

Media URLs disimpan di:
- **User Avatar**: `User.avatar` (localStorage)
- **Interaction Banner**: `Interaction.banner` (localStorage)

---

## ⚙️ Cara Kerja

### Flow Upload

```
User memilih file
       ↓
Frontend: validasi (type, size)
       ↓
Upload ke Cloudinary
       ↓
Dapat URL permanent ✓
       ↓
Simpan URL di store (localStorage)
       ↓
Display gambar di UI
```

### Fallback ke Base64

Jika Cloudinary tidak tersedia atau error:

1. File di-convert ke Base64
2. Disimpan langsung di localStorage
3. Ukuran terbatas 1MB (browser limit)
4. **Rekomendasi**: Tetap setup Cloudinary untuk unlimited storage

---

## 🔍 Troubleshooting

### Error: "Upload failed: 401"

**Penyebab**: Upload preset salah atau tidak ada

**Solusi**:
- Pastikan preset name di `.env` match dengan yang di Cloudinary
- Verifikasi signing mode adalah `Unsigned`
- Restart dev server

### Error: "File terlalu besar"

**Penyebab**: File >5MB

**Solusi**:
- Kompres gambar sebelum upload
- Gunakan tools online seperti TinyPNG atau Squoosh

### Error: "Hanya file gambar yang diizinkan"

**Penyebab**: Upload file bukan gambar

**Solusi**:
- Hanya upload JPG, PNG, atau WebP
- Cek MIME type file

### Upload lokal ke localStorage saja (tanpa Cloudinary)

- Aplikasi akan otomatis fallback
- Batasan: 1MB per file, max ~10 file di localStorage
- Rekomendasi: Tetap gunakan Cloudinary untuk production

---

## 📊 Limit Cloudinary Free Tier

- **Uploads/bulan**: Unlimited ✓
- **Storage**: 25GB ✓
- **Bandwidth**: 25GB ✓
- **Transformations**: Unlimited ✓

*Lebih dari cukup untuk project academic dan startup early-stage.*

---

## 🛠️ Development & Testing

### Test Upload Tanpa Cloudinary

Jika ingin skip setup Cloudinary, file akan disimpan sebagai Base64 di localStorage:

```env
VITE_CLOUDINARY_CLOUD_NAME=demo
VITE_CLOUDINARY_UPLOAD_PRESET=demo
```

Fitur media akan tetap berfungsi dengan fallback lokal.

### Debug Upload

Buka browser console (F12) dan cek:

```javascript
// Lihat stored media assets
JSON.parse(localStorage.getItem('fa_media'))
```

---

## 📚 Referensi

- [Cloudinary Documentation](https://cloudinary.com/documentation/cloudinary_basics)
- [Upload Presets Guide](https://cloudinary.com/documentation/upload_presets)
- [Unsigned Uploads](https://cloudinary.com/documentation/upload_schemes#unsigned_uploads)

---

## ✨ Fitur Bonus

### Transformasi Otomatis Cloudinary

Media di-resize dan dioptimasi secara otomatis:

- **Profile**: 200x200px, rounded, face detection
- **Banner**: 800x400px, gravity center
- **Quality**: Auto-optimized (WebP jika supported)

### Export Media

Semua media URLs dapat di-export dari localStorage dan digunakan di aplikasi lain.

---

**Status**: ✅ Ready for Production  
**Last Updated**: October 2026
