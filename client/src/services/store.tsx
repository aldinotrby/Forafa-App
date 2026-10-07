import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Kind = 'vote' | 'feedback' | 'anon'
export type Status = 'Baru' | 'Dibaca' | 'Diproses' | 'Selesai'
export type Role = 'User' | 'Administrator'

export interface User {
  id: string
  username: string
  email: string
  role: Role
  avatar?: string
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
}

interface Store {
  user: User | null
  users: User[]
  interactions: Interaction[]
  responses: Response[]
  register: (u: { username: string; email: string; password: string }) => string | null
  login: (id: string, password: string) => string | null
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
  { id: 'u1', username: 'admin', email: 'admin@forafa.app', role: 'Administrator', password: 'admin12345' },
  { id: 'u2', username: 'rina', email: 'rina@desa-mekar.id', role: 'User', password: 'rina12345' },
  { id: 'u3', username: 'budi_rw', email: 'budi@rw05.id', role: 'User', password: 'budi12345' },
]

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

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState(() => load('fa_users', seedUsers))
  const [sessionId, setSessionId] = useState<string | null>(() => load('fa_session', null))
  const [interactions, setInteractions] = useState(() => load('fa_inter', seedInteractions))
  const [responses, setResponses] = useState(() => load('fa_resp', seedResponses))

  useEffect(() => localStorage.setItem('fa_users', JSON.stringify(users)), [users])
  useEffect(() => localStorage.setItem('fa_session', JSON.stringify(sessionId)), [sessionId])
  useEffect(() => localStorage.setItem('fa_inter', JSON.stringify(interactions)), [interactions])
  useEffect(() => localStorage.setItem('fa_resp', JSON.stringify(responses)), [responses])

  const store = useMemo<Store>(() => {
    const user = users.find((u) => u.id === sessionId) ?? null
    return {
      user,
      users,
      interactions,
      responses,
      register: ({ username, email, password }) => {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Format email tidak valid.'
        if (!/^[a-z0-9_]{3,20}$/i.test(username)) return 'Username 3-20 karakter: huruf, angka, underscore.'
        if (password.length < 8) return 'Password minimal 8 karakter.'
        if (users.some((u) => u.email === email || u.username.toLowerCase() === username.toLowerCase())) return 'Email atau username sudah terdaftar.'
        const u = { id: uid(), username, email, role: 'User' as Role, password }
        setUsers((p) => [...p, u])
        setSessionId(u.id)
        return null
      },
      login: (id, password) => {
        const u = users.find((x) => (x.email === id || x.username === id) && (x as never as { password: string }).password === password)
        if (!u) return 'Email/username atau password salah.'
        setSessionId(u.id)
        return null
      },
      logout: () => setSessionId(null),
      adminCreateUser: ({ username, email, password }) => {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Format email tidak valid.'
        if (!/^[a-z0-9_]{3,20}$/i.test(username)) return 'Username 3-20 karakter: huruf, angka, underscore.'
        if (password.length < 8) return 'Password minimal 8 karakter.'
        if (users.some((u) => u.email === email || u.username.toLowerCase() === username.toLowerCase())) return 'Email atau username sudah terdaftar.'
        const u = { id: uid(), username, email, role: 'User' as Role, password }
        setUsers((p) => [...p, u])
        return null
      },
      updateUser: (id, patch) => {
        const { username, email } = patch
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Format email tidak valid.'
        if (username && !/^[a-z0-9_]{3,20}$/i.test(username)) return 'Username 3-20 karakter: huruf, angka, underscore.'
        if (users.some((u) => u.id !== id && ((email && u.email === email) || (username && u.username.toLowerCase() === username.toLowerCase())))) return 'Email atau username sudah digunakan.'
        setUsers((p) => p.map((u) => (u.id === id ? { ...u, ...patch } : u)))
        return null
      },
      resetUserPassword: (id, newPassword) => {
        if (newPassword.length < 8) return 'Password minimal 8 karakter.'
        setUsers((p) => p.map((u) => (u.id === id ? { ...u, password: newPassword } : u)))
        return null
      },
      removeUser: (id) => {
        const userInteractionIds = interactions.filter((i) => i.ownerId === id).map((i) => i.id)
        setUsers((p) => p.filter((u) => u.id !== id))
        setInteractions((p) => p.filter((i) => i.ownerId !== id))
        setResponses((p) => p.filter((r) => !userInteractionIds.includes(r.iid)))
        if (sessionId === id) setSessionId(null)
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
        return n
      },
      updateInteraction: (id, patch) => setInteractions((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x))),
      removeInteraction: (id) => {
        setInteractions((p) => p.filter((x) => x.id !== id))
        setResponses((p) => p.filter((x) => x.iid !== id))
      },
      submit: (r) => setResponses((p) => [{ ...r, id: uid(), status: 'Baru', at: new Date().toISOString() }, ...p]),
      patchResponse: (id, patch) => setResponses((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x))),
      removeResponse: (id) => setResponses((p) => p.filter((x) => x.id !== id)),
    }
  }, [users, sessionId, interactions, responses])

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}
