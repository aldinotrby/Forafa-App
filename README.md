# Forafa-App

<div align="center">

![Forafa-App Logo](https://img.shields.io/badge/Forafa-App-0f766e?style=for-the-badge&logo=react&logoColor=white)

**Platform Partisipasi Publik Digital**

*Dengar suara publik, tanpa ribet*

[![React](https://img.shields.io/badge/React-19.0.0-61DAFB?style=flat-square&logo=react&logoColor=white)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.0-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.0.5-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0.0-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

</div>

## 📋 Deskripsi

Forafa-App adalah platform digital modern untuk partisipasi publik yang memungkinkan organisasi, komunitas, atau pemerintahan daerah untuk mendengar dan mengumpulkan suara masyarakat dengan cara yang efektif dan terstruktur.

### ✨ Fitur Utama

- 🗳️ **Voting System** - Pemungutan suara digital untuk berbagai keperluan
- 💬 **Feedback & Saran** - Sistem pengumpulan kritik dan saran terstruktur  
- 🕵️ **Anonymous Messaging** - Pesan anonim untuk meningkatkan transparansi
- 👥 **User Management** - Sistem manajemen pengguna dengan role-based access
- 📊 **Dashboard Terintegrasi** - Analisis dan monitoring real-time
- 🔗 **Public Links** - Akses mudah melalui link publik

### 🎯 Kasus Penggunaan

- **Pemerintahan Daerah**: Aspirasi warga, polling kebijakan, feedback layanan publik
- **Organisasi**: Keputusan internal, survei karyawan, voting pemimpin
- **Komunitas**: Pemilihan kegiatan, pengumpulan saran, komunikasi anonim
- **Institusi Pendidikan**: Evaluasi program, pemilihan perwakilan siswa

## 🛠️ Tech Stack

| Kategori | Teknologi |
|----------|-----------|
| **Frontend Framework** | React 19.0.0 |
| **Language** | TypeScript 5.7.0 |
| **Build Tool** | Vite 8.0.5 |
| **Styling** | Tailwind CSS 4.0.0 |
| **State Management** | React Context + Local Storage |
| **Routing** | Hash-based Routing |
| **Package Manager** | npm/pnpm |

## 🚀 Quick Start

### Prasyarat

Pastikan sistem Anda telah terinstall:

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0 atau **pnpm** >= 8.0.0
- **Git** (untuk cloning repository)

### Instalasi

1. **Clone Repository**
   ```bash
   git clone <repository-url>
   cd forafa-app
   ```

2. **Install Dependencies**
   ```bash
   npm install
   # atau
   pnpm install
   ```

3. **Jalankan Development Server**
   ```bash
   npm run dev
   # atau
   pnpm dev
   ```

4. **Akses Aplikasi**
   
   Buka browser dan akses: `http://localhost:5173`

### Akun Demo

Untuk testing, gunakan akun berikut:

| Role | Username | Email | Password |
|------|----------|--------|----------|
| **Administrator** | `admin` | `admin@forafa.app` | `admin12345` |
| **User** | `rina` | `rina@desa-mekar.id` | `rina12345` |
| **User** | `budi_rw` | `budi@rw05.id` | `budi12345` |

## 📁 Struktur Proyek

```
forafa-app/
├── public/                     # Static assets
├── src/
│   ├── App.tsx                # Main application component & routing
│   ├── main.tsx               # Application entry point
│   ├── index.css              # Global styles & Tailwind imports
│   ├── Auth.tsx               # Authentication (login/register)
│   ├── Public.tsx             # Public interaction pages
│   ├── Workspace.tsx          # Admin dashboard & management
│   ├── store.tsx              # State management & data models
│   ├── ui.tsx                 # Reusable UI components
│   └── vite-env.d.ts          # TypeScript declarations
├── dist/                      # Production build output
├── node_modules/              # Dependencies
├── .gitignore                 # Git ignore rules
├── index.html                 # HTML template
├── package.json               # Project configuration & dependencies
├── tsconfig.json              # TypeScript configuration
├── vite.config.ts             # Vite build configuration
└── README.md                  # Documentation (this file)
```

## 🔧 Scripts

| Command | Deskripsi |
|---------|-----------|
| `npm run dev` | Menjalankan development server |
| `npm run build` | Build aplikasi untuk production |
| `npm run preview` | Preview build production secara lokal |

## 🏗️ Build untuk Production

1. **Build Aplikasi**
   ```bash
   npm run build
   ```

2. **Preview Build**
   ```bash
   npm run preview
   ```

3. **Deploy**
   
   Upload folder `dist/` ke web server atau hosting platform pilihan Anda.

## 📊 Data Models

### User
```typescript
interface User {
  id: string
  username: string
  email: string
  role: 'User' | 'Administrator'
}
```

### Interaction
```typescript
interface Interaction {
  id: string
  ownerId: string
  kind: 'vote' | 'feedback' | 'anon'
  title: string
  description: string
  slug: string
  active: boolean
  start: string
  end: string
  options: string[]
  createdAt: string
}
```

### Response
```typescript
interface Response {
  id: string
  iid: string
  name?: string
  choice?: string
  message?: string
  status: 'Baru' | 'Dibaca' | 'Diproses' | 'Selesai'
  reply?: string
  shared?: boolean
  at: string
}
```

## 🎨 Styling & Theme

Aplikasi menggunakan **Tailwind CSS 4** dengan custom color palette:

```css
--color-ink: #0d2b2e      /* Text primary */
--color-mute: #5b7275     /* Text secondary */
--color-line: #dbe6e4     /* Borders */
--color-ground: #f3f8f6   /* Background */
--color-brand: #0f766e    /* Brand color */
--color-vote: #2563eb     /* Voting theme */
--color-fb: #d97706       /* Feedback theme */
--color-anon: #7c3aed     /* Anonymous theme */
```

## 🔒 Security Features

- ✅ Input validation untuk email dan username
- ✅ Password minimum 8 karakter
- ✅ Role-based access control
- ✅ XSS protection melalui React
- ✅ Data persistence dengan localStorage encryption

## 🤝 Contributing

1. Fork repository ini
2. Buat feature branch (`git checkout -b feature/amazing-feature`)
3. Commit perubahan (`git commit -m 'Add amazing feature'`)
4. Push ke branch (`git push origin feature/amazing-feature`)
5. Buat Pull Request

### Development Guidelines

- Gunakan TypeScript untuk type safety
- Ikuti konvensi penamaan React components
- Tulis kode yang clean dan terdokumentasi
- Test fitur baru sebelum commit
- Gunakan Tailwind CSS untuk styling

## 📝 License

Distributed under the MIT License. See `LICENSE` file for more information.

## 👥 Team

- **Project Lead**: Forafa-App
- **Frontend Developer**: aldinodn735@gmail.com (Aldino)
- **UI/UX Designer**: aldinodn735@gmail.com (Aldino)

## 📞 Support

Jika Anda mengalami masalah atau memiliki pertanyaan:

- 📧 Email: support@forafa.app
- 🐛 Issues: [GitHub Issues](https://github.com/yourrepo/forafa-app/issues)
- 📖 Documentation: [Wiki](https://github.com/yourrepo/forafa-app/wiki)

## 🚀 Roadmap

- [ ] **v0.2.0** - Mobile responsive improvements
- [ ] **v0.3.0** - Export data functionality  
- [ ] **v0.4.0** - Email notifications
- [ ] **v0.5.0** - Multi-language support
- [ ] **v1.0.0** - Production-ready release

---

<div align="center">

**[⬆ Back to Top](#forafa-app)**

Made with ❤️ using React & TypeScript

</div>
