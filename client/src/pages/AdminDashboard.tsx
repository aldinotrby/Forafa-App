import { useEffect, useMemo, useState } from 'react'
import { useStore, type Response, type User, type Kind } from '../services/store'
import { requestEmailOtp, verifyEmailOtp } from '../services/emailOtpService'
import { loadSeenResponseIds, markResponseSeen, markResponsesSeen } from '../services/ownerNotifications'
import UserWorkspace from './UserWorkspace'
import Profile from './Profile'
import { MediaUpload } from '../components/MediaUpload'
import { SessionStatus } from '../components/SessionStatus'
import { Btn, Card, Field, KIND, Logo, PasswordInput, PasswordStrengthMeter, fmtDate, inputCls, maskName } from '../components/ui'

type AdminNav = 'overview' | 'users' | 'notif' | 'profil'

const kindDot: Record<Kind, string> = { vote: 'bg-vote', feedback: 'bg-fb', anon: 'bg-anon' }

export default function AdminDashboard() {
  const { logout, users, interactions, responses } = useStore()
  const [nav, setNav] = useState<AdminNav>('overview')
  const [viewingUser, setViewingUser] = useState<User | null>(null)
  const [viewingOpenId, setViewingOpenId] = useState<string | null>(null)
  /** Id respons yang sudah dibaca — dipakai bersama dengan workspace owner di perangkat ini. */
  const [seenIds, setSeenIds] = useState<string[]>(() => loadSeenResponseIds())
  /** Semua respons masuk yang belum dibaca, dari semua pengguna. */
  const unseenAll = useMemo(
    () => [...responses.filter((r) => !seenIds.includes(r.id))].sort((a, b) => +new Date(b.at) - +new Date(a.at)),
    [responses, seenIds],
  )

  const openUserWorkspace = (u: User, openId?: string) => {
    setViewingUser(u)
    setViewingOpenId(openId ?? null)
  }
  /** Buka respons dari notifikasi: tandai dibaca lalu buka detail linknya di workspace pemiliknya. */
  const openResponse = (r: Response) => {
    const it = interactions.find((i) => i.id === r.iid)
    const owner = it ? users.find((u) => u.id === it.ownerId) : undefined
    setSeenIds(markResponseSeen(r.id))
    if (owner) openUserWorkspace(owner, r.iid)
  }

  if (viewingUser) {
    return (
      <UserWorkspace
        asUserId={viewingUser.id}
        initialOpenId={viewingOpenId ?? undefined}
        onBack={() => { setViewingUser(null); setViewingOpenId(null) }}
        adminBanner={maskName(viewingUser.username)}
      />
    )
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
            { id: 'notif' as AdminNav, label: 'Notifikasi', icon: '🔔' },
            { id: 'profil' as AdminNav, label: 'Profil', icon: '◉' },
          ]).map((n) => (
            <button key={n.id} onClick={() => setNav(n.id)} aria-current={nav === n.id}
              className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${nav === n.id ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}>
              <span className="w-4 text-center text-base">{n.icon}</span>{n.label}
              {n.id === 'notif' && unseenAll.length > 0 && (
                <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white" aria-label={`${unseenAll.length} notifikasi belum dibaca`}>
                  {unseenAll.length > 9 ? '9+' : unseenAll.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="mt-auto hidden space-y-3 lg:block">
          <SessionStatus dark />
          <button onClick={logout} className="w-full rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white">
            Keluar
          </button>
        </div>
      </aside>

      <main className="min-w-0 p-5 sm:p-8">
        {nav === 'profil'
          ? <Profile />
          : nav === 'overview'
            ? <AdminOverview onViewUser={(u) => openUserWorkspace(u)} seenIds={seenIds} />
            : nav === 'users'
              ? <AdminUsers onViewUser={(u) => openUserWorkspace(u)} seenIds={seenIds} />
              : <AdminNotifications
                  unseen={unseenAll}
                  onOpenResponse={openResponse}
                  onMarkAll={() => setSeenIds(markResponsesSeen(unseenAll.map((r) => r.id)))}
                />
        }
      </main>
    </div>
  )
}

function AdminOverview({ onViewUser, seenIds }: { onViewUser: (u: User) => void; seenIds: string[] }) {
  const { users, interactions, responses } = useStore()
  const regularUsers = users.filter((u) => u.role === 'User')
  /** Jumlah respons belum dibaca milik satu pengguna. */
  const newCount = (uid: string) => {
    const ids = new Set(interactions.filter((i) => i.ownerId === uid).map((i) => i.id))
    return responses.filter((r) => ids.has(r.iid) && !seenIds.includes(r.id)).length
  }

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
        <div className="mt-3"><SessionStatus variant="pill" /></div>
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
                    {!seenIds.includes(r.id) && <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">BARU</span>}
                    <span className="min-w-0 flex-1 truncate">
                      <b>{r.name ? maskName(r.name) : 'Anonim'}</b>{' '}
                      {r.choice ? `memilih "${r.choice}"` : r.message ? `"${r.message.slice(0, 50)}${r.message.length > 50 ? '…' : ''}"` : ''}
                    </span>
                    <span className="shrink-0 rounded-full bg-ground px-2 py-0.5 text-xs font-semibold text-mute">
                      {owner ? maskName(owner.username) : '—'}
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
                const nNew = newCount(u.id)
                return (
                  <li key={u.id} className="flex items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-ground">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft font-bold text-brand text-sm">
                      {u.username[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{u.username}</p>
                      <p className="text-xs text-mute">{ic} interaksi · {rc} respons</p>
                    </div>
                    {nNew > 0 && <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">{nNew} baru</span>}
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

function AdminUsers({ onViewUser, seenIds }: { onViewUser: (u: User) => void; seenIds: string[] }) {
  const { users, interactions, responses, adminCreateUser, updateUser, removeUser } = useStore()
  const [modal, setModal] = useState<null | { type: 'create' } | { type: 'edit'; user: User }>(null)
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
  const newCount = (uid: string) => {
    const ids = new Set(interactions.filter((i) => i.ownerId === uid).map((i) => i.id))
    return responses.filter((r) => ids.has(r.iid) && !seenIds.includes(r.id)).length
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
                <th className="px-5 py-3 text-center">Baru</th>
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
                  <td className="px-5 py-3.5 text-center">
                    {newCount(u.id) > 0 ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">{newCount(u.id)} baru</span>
                    ) : (
                      <span className="text-xs text-mute">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Btn variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => onViewUser(u)}>
                        Buka Dashboard
                      </Btn>
                      <Btn variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => setModal({ type: 'edit', user: u })}>
                        Edit
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
                  <td colSpan={6} className="px-5 py-12 text-center text-mute">
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
    </div>
  )
}

/**
 * Halaman Notifikasi admin: respons masuk yang belum dibaca dari SEMUA
 * pengguna di urutan teratas (dengan lencana BARU + nama pemilik link),
 * lalu riwayat respons terbaru. Membuka sebuah respons menandainya dibaca
 * dan membuka detail linknya di workspace pemiliknya.
 *
 * Status dibaca dipakai bersama dengan workspace owner di perangkat ini
 * (kunci `fa_seen_responses` yang sama): menandai dibaca di sini juga
 * menghilangkan lencana di workspace pemiliknya, begitu pula sebaliknya.
 */
function AdminNotifications({ unseen, onOpenResponse, onMarkAll }: {
  unseen: Response[]
  onOpenResponse: (r: Response) => void
  onMarkAll: () => void
}) {
  const { users, interactions, responses } = useStore()
  const findInteraction = (iid: string) => interactions.find((i) => i.id === iid)
  const unseenIds = new Set(unseen.map((r) => r.id))
  const all = [
    ...unseen,
    ...[...responses].sort((a, b) => +new Date(b.at) - +new Date(a.at)).filter((r) => !unseenIds.has(r.id)),
  ]
  const [filter, setFilter] = useState<'Semua' | Kind>('Semua')
  const [q, setQ] = useState('')
  const [onlyNew, setOnlyNew] = useState(false)
  const [sort, setSort] = useState<'terbaru' | 'terlama'>('terbaru')
  const [limit, setLimit] = useState(12)
  const kindOf = (r: Response) => findInteraction(r.iid)?.kind
  const unseenByKind = (k: Kind) => unseen.filter((r) => kindOf(r) === k).length
  /** 'Terbaru dulu' (bawaan): respons baru di atas, lalu riwayat terbaru.
   *  'Terlama dulu': seluruh daftar urut kronologis dari yang paling lama. */
  const ordered = sort === 'terbaru' ? all : [...all].sort((a, b) => +new Date(a.at) - +new Date(b.at))
  const filtered = ordered
    .filter((r) => filter === 'Semua' || kindOf(r) === filter)
    .filter((r) => !onlyNew || unseenIds.has(r.id))
    .filter((r) => {
      const needle = q.trim().toLowerCase()
      if (!needle) return true
      const hay = `${r.name ?? 'Anonim'} ${findInteraction(r.iid)?.title ?? ''}`.toLowerCase()
      return hay.includes(needle)
    })
  const visible = filtered.slice(0, limit)
  const filterLabel = filter === 'Semua' ? 'Semua' : filter === 'vote' ? 'voting' : filter === 'feedback' ? 'kritik & saran' : 'pesan anonim'

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand">Administrator</p>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Masukan baru — semua pengguna</h1>
          <p className="mt-1 text-sm text-mute">
            {unseen.length > 0 ? `${unseen.length} respons belum dibaca di semua link pengguna.` : 'Semua respons sudah dibaca.'}
          </p>
        </div>
        {unseen.length > 0 && <Btn variant="ghost" onClick={onMarkAll}>Tandai semua sudah dibaca</Btn>}
      </header>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter jenis notifikasi">
        {([
          { id: 'Semua' as const, label: 'Semua' },
          { id: 'vote' as Kind, label: 'Voting' },
          { id: 'feedback' as Kind, label: 'Kritik & Saran' },
          { id: 'anon' as Kind, label: 'Pesan Anonim' },
        ]).map((f) => {
          const n = f.id === 'Semua' ? unseen.length : unseenByKind(f.id)
          const active = filter === f.id
          return (
            <button key={f.id} onClick={() => setFilter(f.id)} aria-pressed={active}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold ${active ? 'border-ink bg-ink text-white' : 'border-line bg-white text-mute hover:text-ink'}`}>
              {f.id !== 'Semua' && <span className="mr-1.5">{KIND[f.id].icon}</span>}{f.label}
              {n > 0 && <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700'}`}>{n}</span>}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${inputCls} max-w-sm flex-1`}
          placeholder="Cari nama pengisi atau judul link…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Cari notifikasi"
        />
        <button onClick={() => setOnlyNew(!onlyNew)} aria-pressed={onlyNew}
          className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold ${onlyNew ? 'border-ink bg-ink text-white' : 'border-line bg-white text-mute hover:text-ink'}`}>
          {onlyNew ? '✓ ' : ''}Hanya yang belum dibaca
          {unseen.length > 0 && <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${onlyNew ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700'}`}>{unseen.length}</span>}
        </button>
        <select className={`${inputCls} w-40 shrink-0`} value={sort} onChange={(e) => setSort(e.target.value as never)} aria-label="Urutan daftar">
          <option value="terbaru">Terbaru dulu</option>
          <option value="terlama">Terlama dulu</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-mute">
          {all.length === 0
            ? 'Belum ada aktivitas di link pengguna mana pun.'
            : q.trim()
              ? `Tidak ada notifikasi yang cocok dengan “${q.trim()}”.`
              : onlyNew
                ? 'Tidak ada respons yang belum dibaca.'
                : `Tidak ada notifikasi ${filterLabel}.`}
        </Card>
      ) : (
        <Card className="divide-y divide-line px-5">
          {visible.map((r) => {
            const it = findInteraction(r.iid)
            if (!it) return null
            const owner = users.find((u) => u.id === it.ownerId)
            const isNew = unseenIds.has(r.id)
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-3 py-4 text-sm">
                <span className={`size-2.5 shrink-0 rounded-full ${kindDot[it.kind]}`} aria-hidden />
                {isNew && <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">BARU</span>}
                <span className="min-w-0 flex-1 truncate">
                  <b>{r.name ? maskName(r.name) : 'Anonim'}</b>{' '}
                  {r.choice ? `memilih ${r.choice}` : r.message ? `menulis: ${r.message}` : ''}
                </span>
                <span className="shrink-0 rounded-full bg-ground px-2 py-0.5 text-xs font-semibold text-mute">
                  {owner ? maskName(owner.username) : '—'}
                </span>
                <button className="shrink-0 text-xs font-semibold text-brand hover:underline" onClick={() => onOpenResponse(r)}>{it.title}</button>
                <time className="shrink-0 text-xs text-mute">{fmtDate(r.at)}</time>
              </div>
            )
          })}
        </Card>
      )}
      {filtered.length > limit && (
        <div className="flex flex-col items-center gap-1.5">
          <Btn variant="ghost" onClick={() => setLimit((n) => n + 12)}>
            Tampilkan lebih banyak ({filtered.length - limit} lagi)
          </Btn>
          <p className="text-xs text-mute">Menampilkan {visible.length} dari {filtered.length} notifikasi.</p>
        </div>
      )}
      <p className="text-xs text-mute">
        Notifikasi dihitung dari perangkat &amp; browser ini saja — respons yang masuk saat dasbor tidak dibuka akan muncul sebagai baru saat dibuka lagi.
      </p>
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

function CreateUserModal({ onClose, onSave }: { onClose: () => void; onSave: (u: { username: string; email: string; password: string; verificationToken?: string }) => string | null }) {
  const [f, setF] = useState({ username: '', email: '', password: '' })
  const [err, setErr] = useState<string | null>(null)
  const [showPw, setShowPw] = useState(false)
  // Langkah 2: verifikasi email calon pengguna dengan kode OTP 5 digit
  // (sama seperti pendaftaran) — memastikan email yang didaftarkan asli
  // dan aktif sebelum akun dibuat.
  const [step, setStep] = useState<'form' | 'otp'>('form')
  const [code, setCode] = useState('')
  const [otpErr, setOtpErr] = useState<string | null>(null)
  const [otpBusy, setOtpBusy] = useState(false)
  const [resendIn, setResendIn] = useState(0)
  const [expiresIn, setExpiresIn] = useState(0)

  // Hitung mundur kirim ulang + kedaluwarsa kode.
  useEffect(() => {
    if (resendIn <= 0 && expiresIn <= 0) return
    const t = setInterval(() => {
      setResendIn((v) => Math.max(0, v - 1))
      setExpiresIn((v) => Math.max(0, v - 1))
    }, 1000)
    return () => clearInterval(t)
  }, [resendIn > 0, expiresIn > 0])

  const sendCode = async () => {
    setOtpBusy(true)
    setOtpErr(null)
    const res = await requestEmailOtp(f.email)
    setOtpBusy(false)
    if (!res.ok) {
      setOtpErr(res.error ?? 'Gagal mengirim kode.')
      return
    }
    setResendIn(res.resendAfterSeconds ?? 60)
    setExpiresIn(res.expiresInSeconds ?? 600)
    setStep('otp')
  }

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) {
      setErr('Format email tidak valid.')
      return
    }
    void sendCode()
  }

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.trim().length !== 5) {
      setOtpErr('Masukkan kode 5 digit yang dikirim ke email calon pengguna.')
      return
    }
    setOtpBusy(true)
    setOtpErr(null)
    const res = await verifyEmailOtp(f.email, code.trim())
    setOtpBusy(false)
    if (!res.ok || !res.verificationToken) {
      setOtpErr(res.error ?? 'Verifikasi gagal.')
      return
    }
    const result = onSave({ ...f, verificationToken: res.verificationToken })
    if (result) setErr(result)
  }

  return (
    <Modal title="Tambah Pengguna Baru" onClose={onClose}>
      {step === 'form' ? (
        <form onSubmit={submitForm} className="space-y-4">
          <Field label="Username">
            <input className={inputCls} value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} placeholder="username_baru" required />
          </Field>
          <Field label="Email">
            <input type="email" className={inputCls} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="email@contoh.com" required />
          </Field>
          <Field label="Password" hint="Minimal 8 karakter, 1 huruf kapital, 1 angka, dan 1 simbol.">
            <PasswordInput value={f.password} onChange={(v) => setF({ ...f, password: v })} autoComplete="new-password" show={showPw} onToggleShow={() => setShowPw((v) => !v)} required />
          </Field>
          {f.password.length > 0 && <PasswordStrengthMeter password={f.password} />}
          {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
          {otpErr && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{otpErr}</p>}
          <p className="rounded-lg bg-brand-soft px-3 py-2 text-xs leading-relaxed text-brand">
            Setelah klik "Kirim kode verifikasi", kode 5 digit dikirim ke email calon pengguna — minta kodenya untuk melanjutkan. Ini memastikan email yang didaftarkan asli dan aktif.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Btn type="button" variant="ghost" onClick={onClose}>Batal</Btn>
            <Btn disabled={otpBusy}>{otpBusy ? 'Mengirim…' : 'Kirim kode verifikasi'}</Btn>
          </div>
        </form>
      ) : (
        <form onSubmit={submitOtp} className="space-y-4">
          <p className="text-sm leading-relaxed text-mute">
            Kode verifikasi 5 digit dikirim ke <b className="text-ink">{f.email}</b>. Minta kode tersebut dari calon pengguna, lalu masukkan di bawah
            {expiresIn > 0 ? ` (berlaku ${Math.floor(expiresIn / 60)}:${String(expiresIn % 60).padStart(2, '0')})` : ''}.
          </p>
          <Field label="Kode verifikasi">
            <input
              className={inputCls}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
              placeholder="12345"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
            />
          </Field>
          {otpErr && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{otpErr}</p>}
          {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex gap-2">
              <Btn type="button" variant="ghost" onClick={() => { setStep('form'); setOtpErr(null); setCode('') }}>← Ubah email</Btn>
              <Btn type="button" variant="ghost" disabled={resendIn > 0 || otpBusy} onClick={() => void sendCode()}>
                {resendIn > 0 ? `Kirim ulang (${resendIn}d)` : 'Kirim ulang kode'}
              </Btn>
            </div>
            <Btn disabled={otpBusy}>{otpBusy ? 'Memeriksa…' : 'Verifikasi & Buat Akun'}</Btn>
          </div>
        </form>
      )}
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

