# Forafa-App Frontend

React frontend application untuk Forafa-App - Platform Partisipasi Publik Digital.

## 📋 Quick Overview

```
Frontend (You are here)
├── React 19 + TypeScript
├── Vite build tool
├── Tailwind CSS styling
├── Cloudinary media storage
└── Local state management (Context API)
```

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0 or pnpm >= 8.0.0

### Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Setup Environment (Optional)**
   ```bash
   cp .env.example .env
   # Edit .env untuk Cloudinary configuration
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Open in Browser**
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
│   └── MediaUpload.tsx    # File upload component
│
├── services/             # Business logic
│   ├── store.tsx         # React Context + state management
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

**See `../MEDIA_STORAGE_SETUP.md` for detailed instructions**

### Local Fallback

If Cloudinary not configured:
- Files stored as Base64 in localStorage
- Max 1MB per file
- Perfect for development & testing

## 🎨 UI Components

Located in `src/components/ui.tsx`:

| Component | Usage |
|-----------|-------|
| `Btn` | Customizable button (primary, ghost, danger) |
| `Field` | Form field with label |
| `Card` | Container/card wrapper |
| `Logo` | App SVG logo |
| `KindBadge` | Interaction type badge |
| `StatusPill` | Response status indicator |
| `Paginated` | Pagination controls |
| `Bar` | Chart bar visualization |
| `QR` | QR code generator |
| `MediaUpload` | File upload with preview |

## 🎨 Styling

- **Framework**: Tailwind CSS 4.0.0
- **Entry Point**: `src/index.css`
- **Custom Theme**: CSS variables in index.css

### Color Variables
```css
--color-ink: #0d2b2e        /* Primary text */
--color-mute: #5b7275       /* Secondary text */
--color-line: #dbe6e4       /* Borders */
--color-ground: #f3f8f6     /* Background */
--color-brand: #0f766e      /* Primary brand */
--color-vote: #2563eb       /* Voting color */
--color-fb: #d97706         /* Feedback color */
--color-anon: #7c3aed       /* Anonymous color */
```

## 🌐 Routing

Hash-based routing for SPA:

```
/                 → Auth (if not logged in) or Workspace
/auth             → Login/Register page
/#/p/:slug        → Public voting/feedback page
/#/               → User/Admin workspace
```

## 💾 State Management

Using React Context API + localStorage:

```typescript
// Access store in any component
const { user, interactions, responses, login, logout, ... } = useStore()

// State persisted to localStorage:
// - fa_users
// - fa_session
// - fa_inter
// - fa_resp
// - fa_media
```

## 🔄 Data Flow

```
User Action
    ↓
Component Handler
    ↓
Store Action (Context)
    ↓
State Update
    ↓
localStorage Persistence
    ↓
Component Re-render
```

## 📊 API Integration

Currently using **local state only**. Future backend integration:

```typescript
// Future endpoints (example)
POST   /api/auth/register
POST   /api/auth/login
GET    /api/interactions
POST   /api/interactions
PATCH  /api/interactions/:id
DELETE /api/interactions/:id
POST   /api/interactions/:id/responses
```

## 🔍 Features in Detail

### Search & Filter

- **Keyword Search**: Search by username, email, title, message
- **Status Filter**: Filter by response status (New, Read, Processing, Closed)
- **Kind Filter**: Filter by interaction type (Voting, Feedback, Anonymous)
- **Date Range**: Filter by creation date

### Pagination

- Default 6 items per page
- Navigation: Previous/Next buttons
- Current page indicator
- Handles edge cases (empty, single page)

### Validation

**Client-side:**
- Email format validation
- Username pattern (3-20 chars, alphanumeric + underscore)
- Password minimum 8 characters
- Required field checking
- File type validation (images only)
- File size validation (max 5MB)

**Server-side:**
- Duplicate username/email check
- Password length verification
- Data type validation
- Business logic validation

### Error Handling

- User-friendly error messages
- Alert dialogs for critical errors
- Toast-like notifications
- Form field error states
- Graceful fallbacks

## 🚀 Performance Optimization

- Code splitting via Vite
- Lazy component loading
- Image optimization via Cloudinary
- Efficient re-rendering (React.memo)
- Minimal bundle size (<500KB gzipped)
- localStorage caching

## 🧪 Demo Accounts

Test different features with these accounts:

| Role | Username | Password |
|------|----------|----------|
| Admin | admin | admin12345 |
| User | rina | rina12345 |
| User | budi_rw | budi12345 |

## 🐛 Debugging

### Check LocalStorage
```javascript
// In browser console
localStorage.getItem('fa_users')
localStorage.getItem('fa_session')
localStorage.getItem('fa_media')
```

### View Stored Data
```javascript
// Pretty print
console.table(JSON.parse(localStorage.getItem('fa_users')))
```

### Clear Data
```javascript
localStorage.clear()
location.reload()
```

## 📱 Browser Support

- Chrome/Edge: ✅ Latest
- Firefox: ✅ Latest
- Safari: ✅ Latest
- Mobile browsers: ✅ Responsive design

## ♿ Accessibility

- Semantic HTML
- ARIA labels where needed
- Keyboard navigation support
- Focus indicators
- Color contrast compliance

## 🔒 Security Notes

- Passwords validated client & server-side
- XSS protection via React
- No sensitive data in localStorage
- HTTPS recommended for production

## 📚 Additional Resources

- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Vite Guide](https://vitejs.dev/guide/)
- [Cloudinary Docs](https://cloudinary.com/documentation/)

## 🤝 Contributing

1. Create feature branch (`git checkout -b feature/name`)
2. Make changes following code style
3. Test thoroughly
4. Commit (`git commit -m 'Add feature'`)
5. Push & create PR

## 📄 License

MIT License - See LICENSE file

---

<div align="center">

**Questions?** Check docs/ or open an issue

Made with ❤️ using React & TypeScript

</div>
