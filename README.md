# Forafa-App

**Dengar suara publik, tanpa ribet.**

Forafa-App adalah aplikasi web yang memungkinkan pengguna untuk membuat dan mengelola sistem voting, kritik & saran, dan pesan anonim melalui satu public link dengan dashboard terintegrasi.

## 🚀 Fitur

- **Voting System** - Sistem pemungutan suara digital
- **Kritik & Saran** - Platform feedback dan masukan
- **Anonymous Messages** - Pesan anonim untuk komunikasi bebas
- **Dashboard Terintegrasi** - Panel admin untuk mengelola semua aktivitas
- **Public Link Sharing** - Berbagi dengan mudah melalui link publik
- **Role-based Access** - Sistem role User dan Administrator

## 🛠️ Tech Stack

- **Frontend**: React 19 + TypeScript
- **Build Tool**: Vite 8
- **Styling**: Tailwind CSS 4
- **State Management**: Custom React Context Store
- **Routing**: Hash-based routing
- **Icons & Components**: Custom UI components

## 📋 Prerequisites

Pastikan Anda memiliki software berikut terinstal:

- Node.js (versi 18 atau lebih baru)
- npm atau yarn atau pnpm
- Git

## 🚀 Installation

1. **Clone repository**
   ```bash
   git clone <repository-url>
   cd Forafa-App
   ```

2. **Install dependencies**
   ```bash
   npm install
   # atau
   yarn install
   # atau
   pnpm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   # atau
   yarn dev
   # atau
   pnpm dev
   ```

4. **Open browser**
   
   Aplikasi akan berjalan di `http://localhost:8443`

## 🔧 Available Scripts

- `npm run dev` - Menjalankan development server
- `npm run build` - Build aplikasi untuk production
- `npm run preview` - Preview build production secara lokal
- `npm run format` - Format kode menggunakan oxfmt

## 👤 Demo Accounts

Untuk testing aplikasi, Anda dapat menggunakan akun demo berikut:

**User Account:**
- Username: `rina`
- Password: `rina12345`

**Administrator Account:**
- Username: `admin`  
- Password: `admin12345`

## 📁 Project Structure

```
src/
├── App.tsx          # Main application component & router
├── Auth.tsx         # Authentication page (login/register)
├── Public.tsx       # Public facing pages
├── Workspace.tsx    # Main workspace/dashboard
├── store.tsx        # State management
├── ui.tsx           # Reusable UI components
├── main.tsx         # Application entry point
├── index.css        # Global styles
└── vite-env.d.ts    # Vite type definitions
```

## 🎨 Features Overview

### Authentication System
- Login dan registrasi user
- Role-based access (User/Administrator)
- Secure password handling

### Public Interface
- Akses publik melalui URL hash (`#/p/{slug}`)
- Interface yang user-friendly untuk participant

### Workspace Dashboard
- Panel kontrol untuk mengelola voting, feedback, dan pesan
- Interface admin untuk monitoring aktivitas

## 🔗 URL Routing

- `/` - Halaman utama (redirect ke login atau workspace)
- `#/p/{slug}` - Halaman publik berdasarkan slug

## 🎯 Development

Aplikasi ini menggunakan:
- **React 19** dengan Hooks modern
- **TypeScript** untuk type safety
- **Tailwind CSS 4** untuk styling
- **Vite** untuk fast development experience
- Custom store pattern untuk state management

## 🚀 Production Build

```bash
npm run build
```

Build akan menghasilkan file optimized di folder `dist/` yang siap untuk deployment.

## 📝 Contributing

1. Fork repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🤝 Support

Jika Anda memiliki pertanyaan atau memerlukan bantuan:
- Create an issue di repository ini
- Contact team development

---

**Participate · Communicate · Analyze**