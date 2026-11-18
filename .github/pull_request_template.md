## 📌 Deskripsi & Konteks Perubahan
<!-- Jelaskan secara ringkas masalah apa yang diselesaikan dan latar belakang teknis perubahan ini. -->


## 🏷️ Tipe Perubahan
Centang yang sesuai:
- [ ] 🎨 **Frontend**: Perubahan UI, React components, Tailwind styling, atau state management.
- [ ] ⚙️ **Backend**: Perubahan routing, controller, model, middleware PHP native.
- [ ] 🗄️ **Database**: Perubahan skema SQL, relasi tabel, atau data seeder.
- [ ] 🔄 **Integrasi**: Penyesuaian API contract, CORS, data mapping antara frontend & backend.
- [ ] 🚀 **DevOps & CI/CD**: Perubahan workflow GitHub Actions, build script, container, atau deployment.
- [ ] 🧪 **QA & Testing**: Penambahan test case, bugfix validasi, atau pengujian kontrak.
- [ ] 📚 **Dokumentasi**: Pembaruan file di folder `docs/` atau README.

---

## 📑 Kepatuhan Kontrak API (API Contract Compliance)
Wajib diverifikasi jika perubahan melibatkan integrasi atau endpoint data:
- [ ] Mematuhi spesifikasi di [`docs/api_specification.md`](../docs/api_specification.md).
- [ ] Mempertahankan struktur respon error standar `{ "detail": "..." }`.
- [ ] Header otentikasi `Authorization: Bearer <TOKEN>` diverifikasi untuk *protected endpoints*.
- [ ] Perubahan tidak merusak (*breaking changes*) kompatibilitas antarmuka frontend/backend yang sudah ada.

---

## ✅ Checklist Pengujian & Kualitas (DevOps & QA)
Pastikan seluruh poin berikut telah dipenuhi sebelum meminta review:
- [ ] **Frontend Build**: `npm run build` di direktori `client/` berhasil tanpa error TypeScript.
- [ ] **Backend Lint**: `find server -name "*.php" -exec php -l {} \;` tidak mendeteksi galat sintaks.
- [ ] **Database Setup**: `php server/setup.php` berhasil dieksekusi tanpa kegagalan koneksi PDO.
- [ ] **Integrasi Berjalan Bersama**: Frontend (`localhost:5173`) dan Backend (`localhost:8000`) teruji berkomunikasi via REST API / Proxy.
- [ ] **Environment**: File `.env.example` telah diperbarui jika ada variabel konfigurasi baru.
- [ ] **Keamanan**: Tidak ada credential, secret JWT, atau data sensitif yang di-commit ke Git.

---

## 📸 Bukti Pengujian / Screenshot
<!-- Lampirkan screenshot antarmuka, respon API (Postman/curl), atau hasil eksekusi terminal. -->


---

## 🔗 Terkait Isu / Task
Fixes #<!-- nomor issue jika ada -->
