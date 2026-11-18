import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { disableGoogleAutoSelect, type GoogleProfile } from './googleAuth'

export type Kind = 'vote' | 'feedback' | 'anon'
export type Status = 'Baru' | 'Dibaca' | 'Diproses' | 'Selesai'
export type Role = 'User' | 'Administrator'
export type AuthProvider = 'password' | 'google'
/** Kondisi tab saat ini: 'online' = tab aktif/terlihat, 'inactive' = tab disembunyikan / jendela tidak fokus. */
export type Presence = 'online' | 'inactive'

export interface User {
  id: string
  username: string
  email: string
  role: Role
  avatar?: string
  /** Cara pengguna pertama kali masuk: password atau Google. */
  provider?: AuthProvider
  /** Subject ID Google (`sub`), hanya untuk akun Google. */
  googleId?: string
}

/** Informasi sesi login yang sedang berjalan. */
export interface SessionInfo {
  userId: string
  provider: AuthProvider
  /** Waktu login (ISO). */
  loginAt: string
  /** Aktivitas terakhir yang tercatat (ISO). */
  lastSeenAt: string
  /** Waktu tab ini dibuka (ISO). */
  tabOpenedAt: string
}

/** Jejak kondisi akun di luar sesi aktif — ditampilkan juga di halaman login. */
export interface SessionHistory {
  /** Terakhir kali sebuah tab aplikasi ditutup (ISO). */
  lastTabClosedAt: string | null
  /** Terakhir kali pengguna logout (ISO). */
  lastLogoutAt: string | null
}
export interface Interaction {
  id: string
  ownerId: string
  kind: Kind
  title: string
  description: string
  slug: string
  active: boolean
  start: string
  end: string
  options: string[]
  createdAt: string
  banner?: string
}
export interface Response {
  id: string
  iid: string
  name?: string
  choice?: string
  message?: string
  status: Status
  reply?: string
  shared?: boolean
  at: string
  /**
   * true bila pengirim memilih "Isi sebagai Anonymous" di form publik:
   * nama tidak diminta, tidak disimpan, dan ditampilkan sebagai "Anonim".
   * Untuk interaksi jenis 'anon' kolom ini selalu dianggap true.
   */
  anonymous?: boolean
}

interface Store {
  user: User | null
  users: User[]
  interactions: Interaction[]
  responses: Response[]
  /** Sesi aktif; null bila belum login. */
  session: SessionInfo | null
  /** Kondisi tab saat ini (aktif / tidak aktif). */
  presence: Presence
  /** Status login ringkas: 'masuk' bila ada sesi aktif, selain itu 'keluar'. */
  loginStatus: 'masuk' | 'keluar'
  /** Jejak tab terakhir ditutup & logout terakhir. */
  sessionHistory: SessionHistory
  register: (u: { username: string; email: string; password: string }) => string | null
  login: (id: string, password: string) => string | null
  /** Login/registrasi dengan profil terverifikasi dari Google Sign-In. */
  loginWithGoogle: (profile: GoogleProfile) => string | null
  logout: () => void
  adminCreateUser: (u: { username: string; email: string; password: string }) => string | null
  updateUser: (id: string, patch: { username?: string; email?: string; avatar?: string }) => string | null
  resetUserPassword: (id: string, newPassword: string) => string | null
  removeUser: (id: string) => void
  addInteraction: (i: Omit<Interaction, 'id' | 'ownerId' | 'slug' | 'createdAt'>, ownerIdOverride?: string) => Interaction
  updateInteraction: (id: string, patch: Partial<Interaction>) => void
  removeInteraction: (id: string) => void
  submit: (r: Omit<Response, 'id' | 'at' | 'status'>) => void
  patchResponse: (id: string, patch: Partial<Response>) => void
  removeResponse: (id: string) => void
}

const Ctx = createContext<Store>(null as never)
export const useStore = () => useContext(Ctx)

const uid = () => Math.random().toString(36).slice(2, 9)
const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()
const day = (d: number) => new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10)

const seedUsers: (User & { password: string })[] = [
  { id: 'u1', username: 'admin', email: 'admin@forafa.app', role: 'Administrator', password: 'admin12345', provider: 'password' },
  { id: 'u2', username: 'rina', email: 'rina@desa-mekar.id', role: 'User', password: 'rina12345', provider: 'password' },
  { id: 'u3', username: 'budi_rw', email: 'budi@rw05.id', role: 'User', password: 'budi12345', provider: 'password' },
]

const nowIso = () => new Date().toISOString()

function createSession(userId: string, provider: AuthProvider): SessionInfo {
  const now = nowIso()
  return { userId, provider, loginAt: now, lastSeenAt: now, tabOpenedAt: now }
}

/** Username valid (3-20: huruf, angka, underscore) yang diturunkan dari alamat email akun Google. */
function usernameFromEmail(email: string, taken: (candidate: string) => boolean): string {
  const base = (email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 20) || 'user').padEnd(3, '_')
  if (!taken(base)) return base
  for (let n = 2; ; n++) {
    const suffix = `_${n}`
    const candidate = base.slice(0, 20 - suffix.length) + suffix
    if (!taken(candidate)) return candidate
  }
}

const seedInteractions: Interaction[] = [
  { id: 'i1', ownerId: 'u2', kind: 'vote', title: 'Pilih nama taman baru RW 05', description: 'Warga memilih satu nama untuk taman yang baru diresmikan.', slug: 'taman-rw05', active: true, start: day(-3), end: day(10), options: ['Taman Mekar Asri', 'Taman Bhineka', 'Taman Sudirman Hijau', 'Taman Cahaya'], createdAt: ago(72) },
  { id: 'i2', ownerId: 'u2', kind: 'feedback', title: 'Kritik & Saran layanan posyandu', description: 'Sampaikan masukan agar layanan posyandu semakin nyaman.', slug: 'posyandu', active: true, start: day(-14), end: day(30), options: ['Jadwal', 'Fasilitas', 'Petugas'], createdAt: ago(200) },
  { id: 'i3', ownerId: 'u2', kind: 'anon', title: 'Kotak suara warga', description: 'Tulis apa saja tanpa menampilkan identitas Anda.', slug: 'kotak-suara', active: true, start: day(-30), end: day(60), options: [], createdAt: ago(400) },
  { id: 'i4', ownerId: 'u3', kind: 'vote', title: 'Pilih ketua RT baru', description: 'Pemilihan ketua RT periode 2026-2028.', slug: 'pilih-ketua-rt', active: true, start: day(-1), end: day(7), options: ['Pak Suryo', 'Bu Ratna', 'Pak Hasan'], createdAt: ago(24) },
  { id: 'i5', ownerId: 'u3', kind: 'feedback', title: 'Masukan kebersihan lingkungan', description: 'Sampaikan saran untuk program kebersihan RW.', slug: 'kebersihan-rw', active: true, start: day(-5), end: day(25), options: ['Jadwal', 'Peralatan', 'Petugas'], createdAt: ago(120) },
]

const names = ['Budi', 'Sari', 'Dewi', 'Agus', 'Maya', 'Hendra', 'Lina', 'Rizal', 'Tono', 'Putri', 'Yoga', 'Nia']
const seedResponses: Response[] = [
  ...names.map((n, k) => ({ id: 'v' + k, iid: 'i1', name: n, choice: seedInteractions[0].options[[0, 0, 1, 0, 2, 1, 0, 3, 1, 0, 2, 0][k]], status: 'Baru' as Status, at: ago(k * 5 + 1) })),
  { id: 'f1', iid: 'i2', name: 'Bu Ani', message: 'Jadwal posyandu sering bentrok dengan jam kerja, mohon ada sesi sore.', status: 'Baru', at: ago(2) },
  { id: 'f2', iid: 'i2', name: 'Pak Dedi', message: 'Ruang tunggu kurang kursi untuk lansia.', status: 'Dibaca', at: ago(20) },
  { id: 'f3', iid: 'i2', name: 'Mita', message: 'Petugas sangat ramah, terima kasih!', status: 'Selesai', reply: 'Terima kasih atas apresiasinya, Bu Mita.', at: ago(60) },
  { id: 'f4', iid: 'i2', name: 'Joko', message: 'Tolong tambah papan informasi jadwal imunisasi.', status: 'Diproses', reply: 'Sedang kami siapkan minggu ini.', at: ago(90) },
  { id: 'a1', iid: 'i3', message: 'Lampu jalan di gang mawar sudah seminggu mati.', status: 'Baru', at: ago(4) },
  { id: 'a2', iid: 'i3', message: 'Iuran kebersihan sebaiknya dilaporkan terbuka tiap bulan.', status: 'Dibaca', at: ago(30) },
  { id: 'v20', iid: 'i4', name: 'Wati', choice: 'Bu Ratna', status: 'Baru', at: ago(3) },
  { id: 'v21', iid: 'i4', name: 'Slamet', choice: 'Pak Suryo', status: 'Baru', at: ago(5) },
  { id: 'v22', iid: 'i4', name: 'Dwi', choice: 'Bu Ratna', status: 'Baru', at: ago(8) },
  { id: 'fb10', iid: 'i5', name: 'Pak Bambang', message: 'Perlu tambah tempat sampah di depan masjid.', status: 'Baru', at: ago(6) },
]

const API_BASE = '/api/v1'

const getAuthHeaders = (): Record<string, string> => {
  const token = sessionStorage.getItem('fa_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const apiCall = async (path: string, options: RequestInit = {}) => {
  try {
    return await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...(options.headers || {}),
      },
    })
  } catch {
    return null
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const normalizeInteraction = (raw: any): Interaction => ({
  id: String(raw.id),
  ownerId: String(raw.ownerId || raw.owner_id || ''),
  kind: raw.kind as Kind,
  title: String(raw.title || ''),
  description: String(raw.description || ''),
  slug: String(raw.slug || ''),
  active: Boolean(raw.active),
  start: String(raw.start || ''),
  end: String(raw.end || ''),
  options: Array.isArray(raw.options) ? raw.options : typeof raw.options === 'string' ? JSON.parse(raw.options) : [],
  createdAt: String(raw.createdAt || raw.created_at || new Date().toISOString()),
  banner: raw.banner,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const normalizeResponse = (raw: any): Response => ({
  id: String(raw.id),
  iid: String(raw.iid || raw.interaction_id || ''),
  name: raw.name || undefined,
  choice: raw.choice || undefined,
  message: raw.message || undefined,
  status: (raw.status as Status) || 'Baru',
  reply: raw.reply || undefined,
  shared: Boolean(raw.shared),
  at: String(raw.at || raw.created_at || new Date().toISOString()),
  anonymous: raw.anonymous ? true : undefined,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const normalizeUser = (raw: any): User => ({
  id: String(raw.id),
  username: String(raw.username || ''),
  email: String(raw.email || ''),
  role: (raw.role as Role) || 'User',
  avatar: raw.avatar,
})

function load<T>(key: string, fallback: T, storage: Storage = localStorage): T {
  try {
    const raw = storage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>(() => load('fa_users', seedUsers))
  const [sessionId, setSessionId] = useState<string | null>(() => load('fa_session', null, sessionStorage))
  const [session, setSession] = useState<SessionInfo | null>(() => load('fa_session_info', null, sessionStorage))
  const [sessionHistory, setSessionHistory] = useState<SessionHistory>(() => load('fa_session_history', { lastTabClosedAt: null, lastLogoutAt: null }))
  const [presence, setPresence] = useState<Presence>(() => (typeof document !== 'undefined' && document.visibilityState === 'visible' ? 'online' : 'inactive'))
  const [interactions, setInteractions] = useState(() => load('fa_inter', seedInteractions))
  const [responses, setResponses] = useState(() => load('fa_resp', seedResponses))
  const tabInitRef = useRef(false)

  useEffect(() => localStorage.setItem('fa_users', JSON.stringify(users)), [users])
  // Sesi disimpan di sessionStorage dan diakhiri begitu halaman
  // ditinggalkan (lihat penanganan pagehide/pageshow di bawah): menutup
  // tab, memuat ulang halaman, atau pindah ke situs lain berarti sesi
  // berakhir dan pengguna harus login kembali.
  useEffect(() => sessionStorage.setItem('fa_session', JSON.stringify(sessionId)), [sessionId])
  useEffect(() => {
    if (session) sessionStorage.setItem('fa_session_info', JSON.stringify(session))
    else sessionStorage.removeItem('fa_session_info')
  }, [session])
  // Bersihkan sesi warisan versi lama yang tersimpan permanen di localStorage,
  // agar tidak ada sesi lama yang hidup lagi setelah perubahan ini.
  useEffect(() => {
    try {
      localStorage.removeItem('fa_session')
      localStorage.removeItem('fa_session_info')
      localStorage.removeItem('fa_token')
    } catch {
      // Penyimpanan tidak tersedia — tidak ada yang perlu dibersihkan.
    }
  }, [])
  useEffect(() => localStorage.setItem('fa_session_history', JSON.stringify(sessionHistory)), [sessionHistory])
  useEffect(() => localStorage.setItem('fa_inter', JSON.stringify(interactions)), [interactions])
  useEffect(() => localStorage.setItem('fa_resp', JSON.stringify(responses)), [responses])

  // --- Kondisi akun saat tab dibuka / ditutup ---------------------------------
  // Sesi hanya hidup selama halaman ini terbuka (lihat pagehide/pageshow
  // di bawah): menutup tab, memuat ulang halaman, atau meninggalkan
  // aplikasi mengakhiri sesi, dan membuka aplikasi lagi berarti harus
  // login kembali. Blok ini hanya menyegarkan stempel waktu bila masih
  // ada sesi yang terbaca di tab ini (mis. tab duplikat yang menyalin
  // sessionStorage, atau sesi yang dipulihkan browser setelah crash),
  // dan membuatkan info sesi bila ID sesi ada tetapi info sesinya
  // belum ada.
  useEffect(() => {
    if (tabInitRef.current) return
    tabInitRef.current = true
    const openedAt = nowIso()
    setSession((prev) => {
      if (!sessionId) return prev
      if (prev && prev.userId === sessionId) {
        return { ...prev, tabOpenedAt: openedAt, lastSeenAt: openedAt }
      }
      const u = users.find((x) => x.id === sessionId)
      if (!u) return prev
      return { ...createSession(u.id, u.provider ?? 'password'), tabOpenedAt: openedAt }
    })
    // Hanya dijalankan sekali saat provider dipasang (tab dibuka).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tab terlihat / disembunyikan, jendela fokus / tidak fokus → presence + lastSeen.
  // Halaman dibongkar (pagehide/beforeunload: tab ditutup, halaman dimuat
  // ulang, atau pindah ke situs lain) → catat waktu tutupnya ke localStorage
  // secara sinkron, lalu AKHIRI SESI saat itu juga dengan menghapus kunci
  // sesi dari sessionStorage — membuka aplikasi lagi selalu mulai dari
  // halaman login. Pengecualian: bila halaman hanya masuk back-forward
  // cache (pagehide dengan persisted=true), penghapusan ditunda sampai
  // halaman dipulihkan lagi (lihat onPageShow), karena halaman yang sama
  // akan hidup kembali.
  useEffect(() => {
    const markSeen = (p: Presence) => {
      setPresence(p)
      if (p === 'online') setSession((prev) => (prev ? { ...prev, lastSeenAt: nowIso() } : prev))
    }
    const onVisibility = () => markSeen(document.visibilityState === 'visible' ? 'online' : 'inactive')
    const onFocus = () => markSeen('online')
    const onBlur = () => markSeen('inactive')
    const endSessionNow = () => {
      try {
        sessionStorage.removeItem('fa_session')
        sessionStorage.removeItem('fa_session_info')
        sessionStorage.removeItem('fa_token')
      } catch {
        // Penyimpanan tidak tersedia — tidak ada sesi yang perlu diakhiri.
      }
    }
    const onPageHide = (e: Event) => {
      const closedAt = nowIso()
      const persisted = (e as PageTransitionEvent).persisted === true
      try {
        const history = load<SessionHistory>('fa_session_history', { lastTabClosedAt: null, lastLogoutAt: null })
        localStorage.setItem('fa_session_history', JSON.stringify({ ...history, lastTabClosedAt: closedAt }))
        if (persisted) {
          const info = load<SessionInfo | null>('fa_session_info', null, sessionStorage)
          if (info) sessionStorage.setItem('fa_session_info', JSON.stringify({ ...info, lastSeenAt: closedAt }))
        }
      } catch {
        // Penyimpanan tidak tersedia — kondisi tab tidak tercatat.
      }
      if (!persisted) endSessionNow()
      setSessionHistory((prev) => ({ ...prev, lastTabClosedAt: closedAt }))
    }
    const onPageShow = (e: Event) => {
      if ((e as PageTransitionEvent).persisted !== true) return
      // Halaman dipulihkan dari back-forward cache (mis. lewat tombol Back):
      // pengguna sudah meninggalkan aplikasi, jadi sesi dianggap berakhir —
      // bersihkan sesi dan keluarkan pengguna ke halaman login.
      endSessionNow()
      disableGoogleAutoSelect()
      setSession(null)
      setSessionId(null)
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('beforeunload', onPageHide)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('beforeunload', onPageHide)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [])

  // Sinkronisasi antar-tab: data pengguna tersinkron lewat localStorage.
  // Sesi TIDAK ikut tersinkron — sesi tersimpan di sessionStorage yang
  // terpisah untuk tiap tab, jadi setiap tab mempunyai sesinya sendiri dan
  // login/logout di satu tab tidak memengaruhi tab lain.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'fa_users' && e.newValue) setUsers(JSON.parse(e.newValue) as typeof users)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Bersihkan info sesi bila ID sesi hilang (logout / akun dihapus).
  useEffect(() => {
    if (!sessionId) setSession((prev) => (prev ? null : prev))
  }, [sessionId])

  const store = useMemo<Store>(() => {
    const user = users.find((u) => u.id === sessionId) ?? null
    const startSession = (u: User) => {
      setSessionId(u.id)
      setSession(createSession(u.id, u.provider ?? 'password'))
    }
    return {
      user,
      users,
      interactions,
      responses,
      session: session && session.userId === sessionId ? session : null,
      presence,
      loginStatus: user ? 'masuk' : 'keluar',
      sessionHistory,
      register: ({ username, email, password }) => {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Format email tidak valid.'
        if (!/^[a-z0-9_]{3,20}$/i.test(username)) return 'Username 3-20 karakter: huruf, angka, underscore.'
        if (password.length < 8) return 'Password minimal 8 karakter.'
        if (users.some((u) => u.email === email || u.username.toLowerCase() === username.toLowerCase())) return 'Email atau username sudah terdaftar.'
        const u = { id: uid(), username, email, role: 'User' as Role, password, provider: 'password' as AuthProvider }
        setUsers((p) => [...p, u])
        startSession(u)
        return null
      },
      login: (id, password) => {
        const u = users.find((x) => (x.email === id || x.username === id) && (x as never as { password: string }).password === password)
        if (!u) return 'Email/username atau password salah.'
        startSession(u)
        return null
      },
      loginWithGoogle: (profile) => {
        if (!profile.email || !profile.googleId) return 'Profil Google tidak lengkap (email tidak tersedia).'
        if (!profile.emailVerified) return 'Email Google Anda belum terverifikasi.'
        const existing = users.find((u) => u.googleId === profile.googleId || u.email.toLowerCase() === profile.email.toLowerCase())
        if (existing) {
          // Tautkan akun lama dengan Google & lengkapi foto profil bila belum ada.
          const linked: User = { ...existing, provider: 'google', googleId: profile.googleId, avatar: existing.avatar ?? profile.picture }
          setUsers((p) => p.map((u) => (u.id === existing.id ? { ...u, provider: 'google', googleId: profile.googleId, avatar: u.avatar ?? profile.picture } : u)))
          startSession(linked)
          return null
        }
        const username = usernameFromEmail(profile.email, (c) => users.some((u) => u.username.toLowerCase() === c.toLowerCase()))
        // Akun Google tidak memakai password lokal: isi dengan nilai acak yang
        // tidak diketahui siapa pun agar login password tidak bisa menebaknya.
        const u = { id: uid(), username, email: profile.email, role: 'User' as Role, password: `google:${uid()}${uid()}${uid()}`, provider: 'google' as AuthProvider, googleId: profile.googleId, avatar: profile.picture }
        setUsers((p) => [...p, u])
        startSession(u)
        return null
      },
      logout: () => {
        disableGoogleAutoSelect()
        setSessionHistory((prev) => ({ ...prev, lastLogoutAt: nowIso() }))
        setSession(null)
        setSessionId(null)
      },
      adminCreateUser: ({ username, email, password }) => {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Format email tidak valid.'
        if (!/^[a-z0-9_]{3,20}$/i.test(username)) return 'Username 3-20 karakter: huruf, angka, underscore.'
        if (password.length < 8) return 'Password minimal 8 karakter.'
        if (users.some((u) => u.email === email || u.username.toLowerCase() === username.toLowerCase())) return 'Email atau username sudah terdaftar.'
        const u = { id: uid(), username, email, role: 'User' as Role, password, provider: 'password' as AuthProvider }
        setUsers((p) => [...p, u])

        // Asynchronously persist in backend
        apiCall('/users', {
          method: 'POST',
          body: JSON.stringify({ username, email, password, role: 'User' }),
        })

        return null
      },
      updateUser: (id, patch) => {
        const { username, email } = patch
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Format email tidak valid.'
        if (username && !/^[a-z0-9_]{3,20}$/i.test(username)) return 'Username 3-20 karakter: huruf, angka, underscore.'
        if (users.some((u) => u.id !== id && ((email && u.email === email) || (username && u.username.toLowerCase() === username.toLowerCase())))) return 'Email atau username sudah digunakan.'
        setUsers((p) => p.map((u) => (u.id === id ? { ...u, ...patch } : u)))

        // Asynchronously update in backend
        apiCall(`/users/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(patch),
        })

        return null
      },
      resetUserPassword: (id, newPassword) => {
        if (newPassword.length < 8) return 'Password minimal 8 karakter.'
        setUsers((p) => p.map((u) => (u.id === id ? { ...u, password: newPassword } : u)))

        // Asynchronously reset password in backend
        apiCall(`/users/${id}/reset-password`, {
          method: 'POST',
          body: JSON.stringify({ new_password: newPassword }),
        })

        return null
      },
      removeUser: (id) => {
        const userInteractionIds = interactions.filter((i) => i.ownerId === id).map((i) => i.id)
        setUsers((p) => p.filter((u) => u.id !== id))
        setInteractions((p) => p.filter((i) => i.ownerId !== id))
        setResponses((p) => p.filter((r) => !userInteractionIds.includes(r.iid)))
        if (sessionId === id) setSessionId(null)

        // Asynchronously delete in backend
        apiCall(`/users/${id}`, { method: 'DELETE' })
      },
      addInteraction: (i, ownerIdOverride) => {
        const n: Interaction = {
          ...i,
          id: uid(),
          ownerId: ownerIdOverride ?? sessionId ?? '',
          slug: (i.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'link') + '-' + uid().slice(0, 3),
          createdAt: new Date().toISOString(),
        }
        setInteractions((p) => [n, ...p])

        // Asynchronously persist in backend
        apiCall('/interactions', {
          method: 'POST',
          body: JSON.stringify({
            kind: n.kind,
            title: n.title,
            description: n.description,
            slug: n.slug,
            start: n.start,
            end: n.end,
            options: n.options,
            active: n.active,
          }),
        })

        return n
      },
      updateInteraction: (id, patch) => {
        setInteractions((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)))

        // Asynchronously update in backend
        apiCall(`/interactions/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(patch),
        })
      },
      removeInteraction: (id) => {
        setInteractions((p) => p.filter((x) => x.id !== id))
        setResponses((p) => p.filter((x) => x.iid !== id))

        // Asynchronously delete in backend
        apiCall(`/interactions/${id}`, { method: 'DELETE' })
      },
      submit: (r) => {
        const n: Response = { ...r, id: uid(), status: 'Baru', at: new Date().toISOString() }
        setResponses((p) => [n, ...p])

        // Asynchronously submit through backend public portal
        const targetInter = interactions.find((it) => it.id === r.iid)
        if (targetInter?.slug) {
          apiCall(`/public/${targetInter.slug}/submit`, {
            method: 'POST',
            body: JSON.stringify({
              name: r.name,
              choice: r.choice,
              message: r.message,
            }),
          })
        }
      },
      patchResponse: (id, patch) => {
        setResponses((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)))

        // Asynchronously update in backend
        apiCall(`/responses/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(patch),
        })
      },
      removeResponse: (id) => {
        setResponses((p) => p.filter((x) => x.id !== id))

        // Asynchronously delete in backend
        apiCall(`/responses/${id}`, { method: 'DELETE' })
      },
    }
  }, [users, sessionId, interactions, responses, session, presence, sessionHistory])

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}
