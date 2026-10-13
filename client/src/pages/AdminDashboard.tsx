import { useState } from 'react'
import { useStore, type User, type Kind } from '../services/store'
import UserWorkspace from './UserWorkspace'
import { MediaUpload } from '../components/MediaUpload'
import { Btn, Card, Field, KIND, Logo, fmtDate, inputCls } from '../components/ui'

type AdminNav = 'overview' | 'users'

const kindDot: Record<Kind, string> = { vote: 'bg-vote', feedback: 'bg-fb', anon: 'bg-anon' }

export default function AdminDashboard() {
  const { user, logout } = useStore()
  const [nav, setNav] = useState<AdminNav>('overview')
  const [viewingUser, setViewingUser] = useState<User | null>(null)

  if (viewingUser) {
    return <UserWorkspace asUserId={viewingUser.id} onBack={() => setViewingUser(null)} adminBanner={viewingUser.username} />
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 z-10 flex flex-col gap-3 border-b border-white/10 bg-ink p-3 text-white lg:h-screen lg:gap-6 lg:border-b-0 lg:border-r lg:p-5">
        <div className="flex items-center gap-3">
          <Logo size={36} />
          <div className="leading-none">
            <span className="block font-display text-lg font-extrabold">Forafa-App</span>
            <span className="text-xs text-white/50 font-semibold tracking-widest uppercase">Admin Panel</span>
          </div>
          <Btn variant="ghost" className="ml-auto border-white/20 bg-transparent px-3 py-1.5 text-white hover:bg-white/10 lg:hidden" onClick={logout}>Keluar</Btn>
        </div>

        <nav className="flex gap-1 overflow-x-auto lg:flex-col">
          {([
            { id: 'overview' as AdminNav, label: 'Ringkasan', icon: '▦' },
            { id: 'users' as AdminNav, label: 'Pengguna', icon: '◉' },
          ]).map((n) => (
            <button key={n.id} onClick={() => setNav(n.id)} aria-current={nav === n.id}
              className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${nav === n.id ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}>
              <span className="w-4 text-center text-base">{n.icon}</span>{n.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto hidden space-y-3 lg:block">
          <div className="rounded-xl bg-white/10 p-3">
            <p className="font-semibold text-white text-sm">{user!.username}</p>
            <p className="text-xs text-white/50 mt-0.5">Administrator</p>
          </div>
          <button onClick={logout} className="w-full rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white">
            Keluar
          </button>
        </div>
      </aside>

      <main className="min-w-0 p-5 sm:p-8">
        {nav === 'overview'
          ? <AdminOverview onViewUser={setViewingUser} />
          : <AdminUsers onViewUser={setViewingUser} />
        }
      </main>
    </div>
  )
}

function AdminOverview({ onViewUser }: { onViewUser: (u: User) => void }) {
  const { users, interactions, responses } = useStore()
  const regularUsers = users.filter((u) => u.role === 'User')

  const totalByKind = (k: Kind) => interactions.filter((i) => i.kind === k).length
  const respByKind = (k: Kind) => {
    const ids = new Set(interactions.filter((i) => i.kind === k).map((i) => i.id))
    return responses.filter((r) => ids.has(r.iid)).length
  }

  const recentResp = [...responses].sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 8)
  const findInteraction = (iid: string) => interactions.find((i) => i.id === iid)

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-brand">Administrator</p>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Ringkasan Platform</h1>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-transparent bg-ink p-5 text-white">
          <p className="text-sm font-semibold text-white/60">Total Pengguna</p>
          <p className="mt-2 font-display text-5xl font-extrabold">{regularUsers.length}</p>
          <p className="mt-1 text-sm text-white/40">{interactions.length} interaksi aktif</p>
        </Card>
        {(Object.keys(KIND) as Kind[]).map((k) => (
          <Card key={k} className={`p-5 ${KIND[k].soft} border-transparent`}>
            <p className={`text-sm font-semibold ${KIND[k].text}`}>
              {k === 'vote' ? 'Voting' : k === 'feedback' ? 'Kritik & Saran' : 'Pesan Anonim'}
            </p>
            <p className="mt-2 font-display text-5xl font-extrabold">{totalByKind(k)}</p>
            <p className="mt-1 text-sm text-mute">{respByKind(k)} respons total</p>
          </Card>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card className="p-6">
          <h2 className="mb-4 font-display text-lg font-bold">Aktivitas terbaru — semua pengguna</h2>
          {recentResp.length === 0 ? (
            <p className="py-6 text-center text-sm text-mute">Belum ada aktivitas.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recentResp.map((r) => {
                const it = findInteraction(r.iid)
                if (!it) return null
                const owner = users.find((u) => u.id === it.ownerId)
                return (
                  <li key={r.id} className="flex items-center gap-3 py-3 text-sm">
                    <span className={`size-2.5 shrink-0 rounded-full ${kindDot[it.kind]}`} />
                    <span className="min-w-0 flex-1 truncate">
                      <b>{r.name ?? 'Anonim'}</b>{' '}
                      {r.choice ? `memilih "${r.choice}"` : r.message ? `"${r.message.slice(0, 50)}${r.message.length > 50 ? '…' : ''}"` : ''}
                    </span>
                    <span className="shrink-0 rounded-full bg-ground px-2 py-0.5 text-xs font-semibold text-mute">
                      {owner?.username}
                    </span>
                    <time className="shrink-0 text-xs text-mute">{fmtDate(r.at)}</time>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-display text-lg font-bold">Pengguna terdaftar</h2>
          {regularUsers.length === 0 ? (
            <p className="text-sm text-mute">Belum ada pengguna.</p>
          ) : (
            <ul className="space-y-1.5">
              {regularUsers.map((u) => {
                const ic = interactions.filter((i) => i.ownerId === u.id).length
                const rc = responses.filter((r) => {
                  const it = findInteraction(r.iid)
                  return it?.ownerId === u.id
                }).length
                return (
                  <li key={u.id} className="flex items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-ground">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft font-bold text-brand text-sm">
                      {u.username[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{u.username}</p>
                      <p className="text-xs text-mute">{ic} interaksi · {rc} respons</p>
                    </div>
                    <button className="shrink-0 text-xs font-semibold text-brand hover:underline" onClick={() => onViewUser(u)}>Buka</button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

function AdminUsers({ onViewUser }: { onViewUser: (u: User) => void }) {
  const { users, interactions, responses, adminCreateUser, updateUser, resetUserPassword, removeUser } = useStore()
  const [modal, setModal] = useState<null | { type: 'create' } | { type: 'edit'; user: User } | { type: 'reset'; user: User }>(null)
  const [q, setQ] = useState('')

  const regularUsers = users.filter((u) => u.role === 'User')
  const filtered = regularUsers.filter(
    (u) => u.username.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase())
  )

  const interCount = (uid: string) => interactions.filter((i) => i.ownerId === uid).length
  const respCount = (uid: string) => {
    const ids = new Set(interactions.filter((i) => i.ownerId === uid).map((i) => i.id))
    return responses.filter((r) => ids.has(r.iid)).length
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand">Administrator</p>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Manajemen Pengguna</h1>
        </div>
        <Btn onClick={() => setModal({ type: 'create' })}>+ Tambah Pengguna</Btn>
      </header>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-line p-4">
          <input className={`${inputCls} max-w-sm`} placeholder="Cari username atau email…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ground text-left text-xs font-semibold uppercase tracking-wider text-mute">
                <th className="px-5 py-3">Pengguna</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3 text-center">Interaksi</th>
                <th className="px-5 py-3 text-center">Respons</th>
                <th className="px-5 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((u) => (
                <tr key={u.id} className="transition-colors hover:bg-ground/60">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft font-bold text-brand">
                        {u.username[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold">{u.username}</p>
                        <p className="text-xs text-mute">User</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-mute">{u.email}</td>
                  <td className="px-5 py-3.5 text-center">
                    <span className="font-semibold">{interCount(u.id)}</span>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className="font-semibold">{respCount(u.id)}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Btn variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => onViewUser(u)}>
                        Buka Dashboard
                      </Btn>
                      <Btn variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => setModal({ type: 'edit', user: u })}>
                        Edit
                      </Btn>
                      <Btn variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => setModal({ type: 'reset', user: u })}>
                        Reset Password
                      </Btn>
                      <Btn variant="danger" className="px-2.5 py-1 text-xs" onClick={() => {
                        if (confirm(`Hapus akun "${u.username}" beserta semua interaksi dan responsnya?`)) removeUser(u.id)
                      }}>
                        Hapus
                      </Btn>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-mute">
                    {q ? 'Tidak ada pengguna yang cocok.' : 'Belum ada pengguna terdaftar.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {modal?.type === 'create' && (
        <CreateUserModal
          onClose={() => setModal(null)}
          onSave={(u) => { const err = adminCreateUser(u); if (!err) setModal(null); return err }}
        />
      )}
      {modal?.type === 'edit' && (
        <EditUserModal
          user={modal.user}
          onClose={() => setModal(null)}
          onSave={(patch) => { const err = updateUser(modal.user.id, patch); if (!err) setModal(null); return err }}
        />
      )}
      {modal?.type === 'reset' && (
        <ResetPasswordModal
          user={modal.user}
          onClose={() => setModal(null)}
          onSave={(pw) => { const err = resetUserPassword(modal.user.id, pw); if (!err) setModal(null); return err }}
        />
      )}
    </div>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-5 font-display text-xl font-bold">{title}</h2>
        {children}
      </div>
    </div>
  )
}

function CreateUserModal({ onClose, onSave }: { onClose: () => void; onSave: (u: { username: string; email: string; password: string }) => string | null }) {
  const [f, setF] = useState({ username: '', email: '', password: '' })
  const [err, setErr] = useState<string | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const result = onSave(f)
    if (result) setErr(result)
  }

  return (
    <Modal title="Tambah Pengguna Baru" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Username">
          <input className={inputCls} value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} placeholder="username_baru" required />
        </Field>
        <Field label="Email">
          <input type="email" className={inputCls} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="email@contoh.com" required />
        </Field>
        <Field label="Password" hint="Minimal 8 karakter.">
          <input type="password" className={inputCls} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
        </Field>
        {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Btn type="button" variant="ghost" onClick={onClose}>Batal</Btn>
          <Btn>Buat Akun</Btn>
        </div>
      </form>
    </Modal>
  )
}

function EditUserModal({ user, onClose, onSave }: { user: User; onClose: () => void; onSave: (patch: { username?: string; email?: string; avatar?: string }) => string | null }) {
  const [f, setF] = useState({ username: user.username, email: user.email, avatar: user.avatar })
  const [err, setErr] = useState<string | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const patch: { username?: string; email?: string; avatar?: string } = {}
    if (f.username !== user.username) patch.username = f.username
    if (f.email !== user.email) patch.email = f.email
    if (f.avatar !== user.avatar) patch.avatar = f.avatar
    const result = onSave(patch)
    if (result) setErr(result)
  }

  return (
    <Modal title={`Edit Akun: ${user.username}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <MediaUpload
          type="profile"
          userId={user.id}
          currentUrl={user.avatar}
          label="Avatar Profil"
          onUpload={(asset) => setF({ ...f, avatar: asset.url })}
        />
        <Field label="Username">
          <input className={inputCls} value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} required />
        </Field>
        <Field label="Email">
          <input type="email" className={inputCls} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
        </Field>
        {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Btn type="button" variant="ghost" onClick={onClose}>Batal</Btn>
          <Btn>Simpan Perubahan</Btn>
        </div>
      </form>
    </Modal>
  )
}

function ResetPasswordModal({ user, onClose, onSave }: { user: User; onClose: () => void; onSave: (pw: string) => string | null }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pw !== pw2) { setErr('Konfirmasi password tidak cocok.'); return }
    const result = onSave(pw)
    if (result) setErr(result)
  }

  return (
    <Modal title={`Reset Password: ${user.username}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Password Baru" hint="Minimal 8 karakter.">
          <input type="password" className={inputCls} value={pw} onChange={(e) => setPw(e.target.value)} required />
        </Field>
        <Field label="Konfirmasi Password Baru">
          <input type="password" className={inputCls} value={pw2} onChange={(e) => setPw2(e.target.value)} required />
        </Field>
        {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Btn type="button" variant="ghost" onClick={onClose}>Batal</Btn>
          <Btn>Simpan Password Baru</Btn>
        </div>
      </form>
    </Modal>
  )
}
