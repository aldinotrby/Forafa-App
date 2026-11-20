import { useEffect, useMemo, useState } from 'react'
import { useStore, type Interaction, type Kind, type Response, type Status, type VoteQuestion } from '../services/store'
import { loadSeenResponseIds, markResponseSeen, markResponsesSeen } from '../services/ownerNotifications'
import { MediaUpload } from '../components/MediaUpload'
import { SessionStatus } from '../components/SessionStatus'
import { Bar, Btn, Card, Field, KIND, KindBadge, Logo, Paginated, QR, STATUSES, StatusPill, exportCsv, fmtDate, inputCls, publicUrl } from '../components/ui'

type Nav = 'home' | Kind | 'flow' | 'notif'

export default function UserWorkspace({ asUserId, onBack, adminBanner, initialOpenId }: { asUserId?: string; onBack?: () => void; adminBanner?: string; initialOpenId?: string } = {}) {
  const { user, logout, interactions } = useStore()
  const effectiveUserId = asUserId ?? user!.id
  const [nav, setNav] = useState<Nav>('home')
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null)
  const [creating, setCreating] = useState<Kind | null>(null)
  /** Id respons yang sudah dibaca owner (notifikasi masukan baru). */
  const [seenIds, setSeenIds] = useState<string[]>(() => loadSeenResponseIds())
  const { mine, resp } = useMine(effectiveUserId)
  /** Respons masuk yang belum dibaca, urut terbaru dulu. */
  const unseen = useMemo(
    () => [...resp.filter((r) => !seenIds.includes(r.id))].sort((a, b) => +new Date(b.at) - +new Date(a.at)),
    [resp, seenIds],
  )
  /** Buka respons dari notifikasi: tandai dibaca lalu buka detail interaksinya. */
  const openResponse = (r: Response) => {
    setSeenIds(markResponseSeen(r.id))
    setOpenId(r.iid)
  }

  const go = (n: Nav) => { setNav(n); setOpenId(null) }
  const open = interactions.find((i) => i.id === openId)

  const navItems: { id: Nav; label: string; icon: string }[] = [
    { id: 'home', label: 'Dashboard', icon: '▦' },
    { id: 'vote', label: 'Voting', icon: KIND.vote.icon },
    { id: 'feedback', label: 'Kritik & Saran', icon: KIND.feedback.icon },
    { id: 'anon', label: 'Pesan Anonim', icon: KIND.anon.icon },
    { id: 'flow', label: 'Alur Kerja', icon: '⇢' },
    { id: 'notif', label: 'Notifikasi', icon: '🔔' },
  ]

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="sticky top-0 z-10 flex flex-col gap-2 border-b border-line bg-white p-3 lg:h-screen lg:gap-6 lg:border-b-0 lg:border-r lg:p-5">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="font-display text-xl font-extrabold">Forafa-App</span>
          {onBack ? (
            <Btn variant="ghost" className="ml-auto px-3 py-1.5 text-xs lg:hidden" onClick={onBack}>← Admin</Btn>
          ) : (
            <Btn variant="ghost" className="ml-auto px-3 py-1.5 lg:hidden" onClick={logout}>Keluar</Btn>
          )}
        </div>
        <nav className="flex gap-1 overflow-x-auto lg:flex-col">
          {navItems.map((n) => (
            <button key={n.id} onClick={() => go(n.id)} aria-current={nav === n.id}
              className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${nav === n.id ? 'bg-ink text-white' : 'text-mute hover:bg-ground hover:text-ink'}`}>
              <span className="w-4 text-center">{n.icon}</span>{n.label}
              {n.id === 'notif' && unseen.length > 0 && (
                <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white" aria-label={`${unseen.length} notifikasi belum dibaca`}>
                  {unseen.length > 9 ? '9+' : unseen.length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="mt-auto hidden space-y-3 lg:block">
          {adminBanner && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-600">Melihat sebagai</p>
              <p className="font-semibold text-ink">{adminBanner}</p>
            </div>
          )}
          <SessionStatus />
          {onBack ? (
            <Btn variant="ghost" className="w-full" onClick={onBack}>← Kembali ke Admin</Btn>
          ) : (
            <Btn variant="ghost" className="w-full" onClick={logout}>Keluar</Btn>
          )}
        </div>
      </aside>

      <main className="min-w-0 p-5 sm:p-8">
        {open ? (
          <Detail it={open} back={() => setOpenId(null)} seenIds={seenIds} onSeenChange={setSeenIds} />
        ) : nav === 'flow' ? (
          <Flow />
        ) : nav === 'notif' ? (
          <Notifications
            unseen={unseen}
            resp={resp}
            onOpenResponse={openResponse}
            onMarkAll={() => setSeenIds(markResponsesSeen(unseen.map((r) => r.id)))}
          />
        ) : (
          <Listing nav={nav} onOpen={setOpenId} onCreate={setCreating} effectiveUserId={effectiveUserId} targetUsername={adminBanner} seenIds={seenIds} />
        )}
      </main>

      {creating && (
        <Create
          kind={creating}
          ownerIdOverride={asUserId}
          onClose={() => setCreating(null)}
          onDone={(id) => { setCreating(null); setNav(creating!); setOpenId(id) }}
        />
      )}
    </div>
  )
}

function useMine(effectiveUserId: string) {
  const { interactions, responses } = useStore()
  const mine = interactions.filter((i) => i.ownerId === effectiveUserId)
  const ids = new Set(mine.map((i) => i.id))
  return { mine, resp: responses.filter((r) => ids.has(r.iid)) }
}

function Listing({ nav, onOpen, onCreate, effectiveUserId, targetUsername, seenIds }: {
  nav: Nav; onOpen: (id: string) => void; onCreate: (k: Kind) => void; effectiveUserId: string; targetUsername?: string; seenIds: string[]
}) {
  const { user, interactions } = useStore()
  const { mine, resp } = useMine(effectiveUserId)
  const kind = nav === 'home' || nav === 'flow' || nav === 'notif' ? null : nav
  const list = kind ? mine.filter((i) => i.kind === kind) : mine
  const count = (k: Kind) => mine.filter((i) => i.kind === k).length
  const recent = [...resp].sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 6)
  const findInteraction = (iid: string) => interactions.find((i) => i.id === iid)

  const greetLabel = targetUsername ? `Workspace: ${targetUsername}` : `Halo, ${user!.username}`
  const greetSub = kind ? 'Kelola interaksi' : targetUsername ? 'Admin view' : 'Dashboard'

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand">{greetSub}</p>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">{kind ? KIND[kind].long : greetLabel}</h1>
          {!targetUsername && <div className="mt-3"><SessionStatus variant="pill" /></div>}
        </div>
        {kind ? (
          <Btn onClick={() => onCreate(kind)}>+ Buat {KIND[kind].label}</Btn>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(Object.keys(KIND) as Kind[]).map((k) => (
              <Btn key={k} variant="ghost" onClick={() => onCreate(k)}>{KIND[k].icon} {KIND[k].label}</Btn>
            ))}
          </div>
        )}
      </header>

      {!kind && (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            {(Object.keys(KIND) as Kind[]).map((k) => {
              const total = resp.filter((r) => interactions.find((i) => i.id === r.iid)?.kind === k).length
              return (
                <Card key={k} className={`p-5 ${KIND[k].soft} border-transparent`}>
                  <p className={`text-sm font-semibold ${KIND[k].text}`}>
                    {k === 'vote' ? 'Voting' : k === 'feedback' ? 'Kritik & Saran' : 'Pesan Anonim'}
                  </p>
                  <p className="mt-2 font-display text-5xl font-extrabold">{count(k)}</p>
                  <p className="mt-1 text-sm text-mute">{total} respons masuk</p>
                </Card>
              )
            })}
          </section>
          <Card className="p-6">
            <h2 className="mb-2 font-display text-xl font-bold">Aktivitas terbaru</h2>
            {recent.length === 0 ? (
              <p className="py-6 text-sm text-mute">Belum ada aktivitas.</p>
            ) : (
              <ul className="divide-y divide-line">
                {recent.map((r) => {
                  const it = findInteraction(r.iid)!
                  return (
                    <li key={r.id} className="flex items-center gap-3 py-3 text-sm">
                      <span className={`size-2.5 shrink-0 rounded-full ${KIND[it.kind].bg}`} />
                      {!seenIds.includes(r.id) && <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">BARU</span>}
                      <span className="min-w-0 flex-1 truncate">
                        <b>{r.name ?? 'Anonim'}</b>{' '}
                        {r.choice ? `memilih ${r.choice}` : `menulis: ${r.message}`}
                      </span>
                      <button className="hidden shrink-0 text-xs font-semibold text-brand hover:underline sm:block" onClick={() => onOpen(it.id)}>{it.title}</button>
                      <time className="shrink-0 text-xs text-mute">{fmtDate(r.at)}</time>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">{kind ? 'Daftar interaksi' : 'Semua interaksi'}</h2>
        {list.length === 0 && (
          <Card className="p-10 text-center text-sm text-mute">Belum ada interaksi. Buat yang pertama untuk mendapatkan public link.</Card>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((i) => {
            const n = resp.filter((r) => r.iid === i.id).length
            const nNew = resp.filter((r) => r.iid === i.id && !seenIds.includes(r.id)).length
            return (
              <button key={i.id} onClick={() => onOpen(i.id)} className="group rounded-2xl border border-line bg-white p-5 text-left transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between">
                  <KindBadge k={i.kind} />
                  <span className="flex items-center gap-2">
                    {nNew > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">{nNew} baru</span>}
                    <span className={`text-xs font-semibold ${i.active ? 'text-emerald-600' : 'text-mute'}`}>{i.active ? '● Aktif' : '○ Nonaktif'}</span>
                  </span>
                </div>
                <h3 className="mt-3 font-display text-lg font-bold leading-snug group-hover:text-brand">{i.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-mute">{i.description}</p>
                <p className="mt-4 text-xs text-mute">{n} respons{i.questions?.length ? ` · ${i.questions.length} pertanyaan` : ''} · /p/{i.slug}</p>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}

/**
 * Halaman Notifikasi owner: respons masuk yang belum dibaca di urutan
 * teratas (dengan lencana BARU), lalu riwayat respons terbaru. Membuka
 * sebuah respons menandainya dibaca dan membuka detail interaksinya.
 */
function Notifications({ unseen, resp, onOpenResponse, onMarkAll }: {
  unseen: Response[]
  resp: Response[]
  onOpenResponse: (r: Response) => void
  onMarkAll: () => void
}) {
  const { interactions } = useStore()
  const findInteraction = (iid: string) => interactions.find((i) => i.id === iid)
  const unseenIds = new Set(unseen.map((r) => r.id))
  const all = [
    ...unseen,
    ...[...resp].sort((a, b) => +new Date(b.at) - +new Date(a.at)).filter((r) => !unseenIds.has(r.id)),
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
          <p className="text-xs font-bold uppercase tracking-widest text-brand">Notifikasi</p>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Masukan baru</h1>
          <p className="mt-1 text-sm text-mute">
            {unseen.length > 0 ? `${unseen.length} respons belum dibaca di link Anda.` : 'Semua respons sudah dibaca.'}
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
            ? 'Belum ada aktivitas di link Anda.'
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
            const isNew = unseenIds.has(r.id)
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-3 py-4 text-sm">
                <span className={`size-2.5 shrink-0 rounded-full ${KIND[it.kind].bg}`} aria-hidden />
                {isNew && <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">BARU</span>}
                <span className="min-w-0 flex-1 truncate">
                  <b>{r.name ?? 'Anonim'}</b>{' '}
                  {r.choice ? `memilih ${r.choice}` : `menulis: ${r.message}`}
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
        Notifikasi dihitung dari perangkat &amp; browser ini saja — respons yang masuk saat Anda tidak membuka workspace akan muncul sebagai baru di sini.
      </p>
    </div>
  )
}

const jabatanTemplate = (): VoteQuestion[] =>
  ['Ketua', 'Wakil Ketua', 'Sekretaris', 'Bendahara'].map((title, k) => ({
    id: `q${k + 1}`,
    title,
    active: true,
    options: [
      { label: '', active: true },
      { label: '', active: true },
    ],
  }))

function Create({ kind, onClose, onDone, ownerIdOverride }: { kind: Kind; onClose: () => void; onDone: (id: string) => void; ownerIdOverride?: string }) {
  const { addInteraction, user } = useStore()
  const m = KIND[kind]
  const [f, setF] = useState({
    title: '',
    description: '',
    start: new Date().toISOString().slice(0, 10),
    end: '',
    options: kind === 'vote' ? ['', ''] : kind === 'feedback' ? ['Umum'] : [] as string[],
    banner: '',
  })
  /** Voting multi-pertanyaan: satu link berisi beberapa pertanyaan (mis. per jabatan). */
  const [multi, setMulti] = useState(false)
  const [questions, setQuestions] = useState<VoteQuestion[]>(jabatanTemplate().slice(0, 2))
  const label = kind === 'vote' ? 'Pilihan' : 'Topik form (custom)'
  const setOpt = (k: number, v: string) => setF((p) => ({ ...p, options: p.options.map((o, j) => (j === k ? v : o)) }))
  const setQ = (k: number, patch: Partial<VoteQuestion>) => setQuestions((p) => p.map((q, j) => (j === k ? { ...q, ...patch } : q)))
  const setQOpt = (k: number, j: number, patch: Partial<VoteQuestion['options'][number]>) =>
    setQuestions((p) => p.map((q, qi) => (qi === k ? { ...q, options: q.options.map((o, oj) => (oj === j ? { ...o, ...patch } : o)) } : q)))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (kind === 'vote' && multi) {
      const qs = questions
        .map((q, k) => ({ ...q, id: `q${k + 1}`, title: q.title.trim(), options: q.options.map((o) => ({ ...o, label: o.label.trim() })).filter((o) => o.label) }))
        .filter((q) => q.title)
      if (qs.length < 2) return alert('Voting multi-pertanyaan butuh minimal 2 pertanyaan.')
      for (const q of qs) {
        if (q.options.length < 2) return alert(`Pertanyaan "${q.title}" butuh minimal 2 pilihan.`)
        if (!q.options.some((o) => o.active)) return alert(`Pertanyaan "${q.title}" butuh minimal 1 pilihan aktif.`)
      }
      const options = qs.flatMap((q) => q.options.map((o) => o.label))
      onDone(addInteraction({ kind, title: f.title, description: f.description, start: f.start, end: f.end, options, questions: qs, active: true, banner: f.banner }, ownerIdOverride).id)
      return
    }
    const options = f.options.map((o) => o.trim()).filter(Boolean)
    if (kind === 'vote' && options.length < 2) return alert('Voting butuh minimal 2 pilihan.')
    onDone(addInteraction({ kind, title: f.title, description: f.description, start: f.start, end: f.end, options, active: true, banner: f.banner }, ownerIdOverride).id)
  }

  return (
    <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-ink/50 p-4 sm:p-10" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <div><KindBadge k={kind} /><h2 className="mt-2 font-display text-2xl font-extrabold">Buat {m.label}</h2></div>
        <MediaUpload
          type="banner"
          userId={user?.id || 'temp'}
          label="Banner/Thumbnail (Opsional)"
          onUpload={(asset) => setF({ ...f, banner: asset.url })}
        />
        <Field label="Judul"><input className={inputCls} required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Deskripsi"><textarea className={inputCls} rows={3} required value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        {kind === 'vote' && (
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-mute">Jumlah pertanyaan</span>
            <div className="flex gap-2">
              <Btn type="button" variant={!multi ? 'primary' : 'ghost'} className="flex-1 py-2" onClick={() => setMulti(false)}>Satu pertanyaan</Btn>
              <Btn type="button" variant={multi ? 'primary' : 'ghost'} className="flex-1 py-2" onClick={() => setMulti(true)}>Beberapa pertanyaan</Btn>
            </div>
            {multi && <p className="text-xs text-mute">Satu link untuk beberapa pertanyaan — mis. Ketua, Wakil Ketua, Sekretaris, Bendahara. Pengunjung menjawab semuanya dalam satu kunjungan.</p>}
          </div>
        )}
        {kind !== 'anon' && multi && kind === 'vote' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-mute">Pertanyaan ({questions.length})</span>
              <Btn type="button" variant="ghost" className="px-2 py-1 text-xs" onClick={() => setQuestions(jabatanTemplate())}>Pakai template jabatan</Btn>
            </div>
            {questions.map((q, k) => (
              <div key={k} className="space-y-2 rounded-xl border border-line bg-ground/50 p-3">
                <div className="flex items-center gap-2">
                  <input className={inputCls} value={q.title} placeholder={`Pertanyaan ${k + 1} — mis. Ketua`} onChange={(e) => setQ(k, { title: e.target.value })} />
                  <label className="flex shrink-0 cursor-pointer items-center gap-1 text-xs font-semibold">
                    <input type="checkbox" className="accent-brand" checked={q.active} onChange={(e) => setQ(k, { active: e.target.checked })} /> Aktif
                  </label>
                  {questions.length > 2 && (
                    <Btn type="button" variant="ghost" className="shrink-0 px-2 py-1" onClick={() => setQuestions((p) => p.filter((_, j) => j !== k))} aria-label="Hapus pertanyaan">✕</Btn>
                  )}
                </div>
                {q.options.map((o, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <input className={inputCls} value={o.label} placeholder={`Pilihan ${j + 1}`} onChange={(e) => setQOpt(k, j, { label: e.target.value })} />
                    <label className="flex shrink-0 cursor-pointer items-center gap-1 text-xs font-semibold">
                      <input type="checkbox" className="accent-brand" checked={o.active} onChange={(e) => setQOpt(k, j, { active: e.target.checked })} /> Aktif
                    </label>
                    {q.options.length > 2 && (
                      <Btn type="button" variant="ghost" className="shrink-0 px-2 py-1" onClick={() => setQ(k, { options: q.options.filter((_, oj) => oj !== j) })} aria-label="Hapus pilihan">✕</Btn>
                    )}
                  </div>
                ))}
                <Btn type="button" variant="ghost" className="px-2 py-1 text-xs" onClick={() => setQ(k, { options: [...q.options, { label: '', active: true }] })}>+ Tambah pilihan</Btn>
              </div>
            ))}
            <Btn type="button" variant="ghost" onClick={() => setQuestions((p) => [...p, { id: `q${p.length + 1}`, title: '', active: true, options: [{ label: '', active: true }, { label: '', active: true }] }])}>+ Tambah pertanyaan</Btn>
          </div>
        ) : kind !== 'anon' && (
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-mute">{label}</span>
            {f.options.map((o, k) => (
              <div key={k} className="flex gap-2">
                <input className={inputCls} value={o} placeholder={`${kind === 'vote' ? 'Pilihan' : 'Topik'} ${k + 1}`} onChange={(e) => setOpt(k, e.target.value)} />
                {f.options.length > (kind === 'vote' ? 2 : 0) && (
                  <Btn type="button" variant="ghost" onClick={() => setF({ ...f, options: f.options.filter((_, j) => j !== k) })} aria-label="Hapus">✕</Btn>
                )}
              </div>
            ))}
            <Btn type="button" variant="ghost" onClick={() => setF({ ...f, options: [...f.options, ''] })}>+ Tambah</Btn>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mulai"><input type="date" className={inputCls} value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
          <Field label="Berakhir"><input type="date" className={inputCls} value={f.end} min={f.start} onChange={(e) => setF({ ...f, end: e.target.value })} /></Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Btn type="button" variant="ghost" onClick={onClose}>Batal</Btn>
          <Btn>Buat &amp; dapatkan link</Btn>
        </div>
      </form>
    </div>
  )
}

function Detail({ it, back, seenIds, onSeenChange }: { it: Interaction; back: () => void; seenIds: string[]; onSeenChange: (ids: string[]) => void }) {
  const { responses, updateInteraction, removeInteraction } = useStore()
  const [tab, setTab] = useState<'hasil' | 'respons' | 'bagikan'>('hasil')
  const rs = responses.filter((r) => r.iid === it.id)
  // Membuka tab Respons berarti owner sudah melihat responsnya.
  useEffect(() => {
    if (tab !== 'respons') return
    const fresh = rs.filter((r) => !seenIds.includes(r.id)).map((r) => r.id)
    if (fresh.length > 0) onSeenChange(markResponsesSeen(fresh))
    // rs/seenIds sengaja tidak di-deps: penandaan hanya saat tab dibuka.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])
  const m = KIND[it.kind]
  const tabs = [
    ['hasil', it.kind === 'vote' ? 'Hasil & Statistik' : 'Statistik'],
    ['respons', `Respons (${rs.length})`],
    ['bagikan', 'Bagikan & Pengaturan'],
  ] as const

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <button onClick={back} className="text-sm font-semibold text-mute hover:text-ink">← Kembali</button>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <KindBadge k={it.kind} />
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{it.title}</h1>
          <p className="max-w-xl text-mute">{it.description}</p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
          <input type="checkbox" className="size-4 accent-brand" checked={it.active} onChange={(e) => updateInteraction(it.id, { active: e.target.checked })} />
          {it.active ? 'Aktif' : 'Nonaktif'}
        </label>
      </header>
      <div className="flex gap-1 border-b border-line">
        {tabs.map(([id, l]) => (
          <button key={id} onClick={() => setTab(id)} className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold ${tab === id ? 'border-ink text-ink' : 'border-transparent text-mute hover:text-ink'}`}>{l}</button>
        ))}
      </div>

      {tab === 'hasil' && <Stats it={it} rs={rs} />}
      {tab === 'respons' && <Responses it={it} rs={rs} seenIds={seenIds} />}
      {tab === 'bagikan' && (
        <div className="space-y-6">
          <Share it={it} />
          <Card className="space-y-4 p-6">
            <h2 className="font-display text-lg font-bold">Pengaturan interaksi</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Judul"><input className={inputCls} value={it.title} onChange={(e) => updateInteraction(it.id, { title: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Mulai"><input type="date" className={inputCls} value={it.start} onChange={(e) => updateInteraction(it.id, { start: e.target.value })} /></Field>
                <Field label="Berakhir"><input type="date" className={inputCls} value={it.end} onChange={(e) => updateInteraction(it.id, { end: e.target.value })} /></Field>
              </div>
            </div>
            <Field label="Deskripsi"><textarea className={inputCls} rows={2} value={it.description} onChange={(e) => updateInteraction(it.id, { description: e.target.value })} /></Field>
            {it.questions?.length ? (
              <div className="space-y-3">
                <h3 className="text-sm font-bold">Pertanyaan &amp; pilihan — aktif / nonaktif</h3>
                <p className="text-xs text-mute">Pertanyaan nonaktif disembunyikan dari pengunjung dan tidak dihitung progres. Pilihan nonaktif tetap tampil tapi tidak bisa dipilih.</p>
                {it.questions.map((q) => (
                  <div key={q.id} className="space-y-2 rounded-xl border border-line bg-ground/50 p-3">
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                      <input type="checkbox" className="size-4 accent-brand" checked={q.active} onChange={(e) => updateInteraction(it.id, { questions: it.questions!.map((x) => (x.id === q.id ? { ...x, active: e.target.checked } : x)) })} />
                      {q.title}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {q.options.map((o) => (
                        <label key={o.label} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${o.active ? 'border-vote/40 bg-vote-soft text-vote' : 'border-line bg-white text-mute'}`}>
                          <input type="checkbox" className="accent-vote" checked={o.active} onChange={(e) => updateInteraction(it.id, { questions: it.questions!.map((x) => (x.id === q.id ? { ...x, options: x.options.map((y) => (y.label === o.label ? { ...y, active: e.target.checked } : y)) } : x)) })} />
                          {o.label}{o.active ? '' : ' (Nonaktif)'}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <Btn variant="danger" onClick={() => { if (confirm('Hapus interaksi beserta seluruh responsnya?')) { removeInteraction(it.id); back() } }}>Hapus interaksi</Btn>
          </Card>
        </div>
      )}
      <span className="hidden">{m.label}</span>
    </div>
  )
}

function Stats({ it, rs }: { it: Interaction; rs: Response[] }) {
  if (it.kind === 'vote' && it.questions?.length) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-mute">{rs.length} pengunjung mengisi voting multi-pertanyaan ini.</p>
        {it.questions.map((q) => {
          const by = q.options
            .map((o) => ({ o, n: rs.filter((r) => r.choices?.[q.id] === o.label).length }))
            .sort((a, b) => b.n - a.n)
          return (
            <Card key={q.id} className="space-y-5 p-6">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-display text-lg font-bold">{q.title}</h2>
                <span className={`text-xs font-semibold ${q.active ? 'text-emerald-600' : 'text-mute'}`}>{q.active ? '● Aktif' : '○ Nonaktif'}</span>
              </div>
              {by.map((x, k) => (
                <Bar key={x.o.label} label={`${k === 0 && x.n > 0 ? '🏆 ' : ''}${x.o.label}${x.o.active ? '' : ' (Nonaktif)'}`} value={x.n} total={rs.length} color="bg-vote" />
              ))}
            </Card>
          )
        })}
      </div>
    )
  }
  if (it.kind === 'vote') {
    const by = it.options.map((o) => ({ o, n: rs.filter((r) => r.choice === o).length })).sort((a, b) => b.n - a.n)
    return (
      <Card className="space-y-5 p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg font-bold">Hasil voting</h2>
          <span className="text-sm text-mute">{rs.length} suara</span>
        </div>
        {by.map((x, k) => <Bar key={x.o} label={`${k === 0 && x.n > 0 ? '🏆 ' : ''}${x.o}`} value={x.n} total={rs.length} color="bg-vote" />)}
      </Card>
    )
  }
  const color = it.kind === 'feedback' ? 'bg-fb' : 'bg-anon'
  return (
    <div className="grid gap-4 sm:grid-cols-4">
      {STATUSES.map((s) => {
        const n = rs.filter((r) => r.status === s).length
        return (
          <Card key={s} className="p-5">
            <StatusPill s={s} />
            <p className="mt-3 font-display text-4xl font-extrabold">{n}</p>
            <div className="mt-3 h-1.5 rounded-full bg-ground">
              <div className={`h-full rounded-full ${color}`} style={{ width: `${rs.length ? (n / rs.length) * 100 : 0}%` }} />
            </div>
          </Card>
        )
      })}
    </div>
  )
}

function VerifiedChip({ r }: { r: Response }) {
  if (!r.verifiedVia) return null
  return (
    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700" title={r.verificationLabel}>
      ✓ {r.verifiedVia === 'google' ? 'Google' : 'WhatsApp'}{r.verificationLabel ? ` · ${r.verificationLabel}` : ''}
    </span>
  )
}

function Responses({ it, rs, seenIds }: { it: Interaction; rs: Response[]; seenIds: string[] }) {
  const { patchResponse, removeResponse } = useStore()
  const [q, setQ] = useState('')
  const [st, setSt] = useState<'Semua' | Status>('Semua')
  const list = rs.filter((r) => (st === 'Semua' || r.status === st) && `${r.name ?? ''} ${r.choice ?? ''} ${r.message ?? ''}`.toLowerCase().includes(q.toLowerCase()))

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap gap-2">
        <input className={`${inputCls} max-w-xs`} placeholder="Cari respons…" value={q} onChange={(e) => setQ(e.target.value)} />
        {it.kind !== 'vote' && (
          <select className={`${inputCls} w-40`} value={st} onChange={(e) => setSt(e.target.value as never)}>
            <option>Semua</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        )}
        <Btn variant="ghost" className="ml-auto" onClick={() => exportCsv(it.slug, list)}>Export CSV</Btn>
      </div>
      <Paginated items={list} render={(r) => it.kind === 'vote' && it.questions?.length ? (
        <div key={r.id} className="space-y-2 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex-1 font-semibold">{r.name ?? 'Anonim'}{r.anonymous && <span className="ml-2 rounded-full bg-anon-soft px-2 py-0.5 text-xs font-semibold text-anon">Anonymous</span>}</span>
            {!seenIds.includes(r.id) && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">BARU</span>}
            <VerifiedChip r={r} />
            <time className="w-28 text-right text-xs text-mute">{fmtDate(r.at)}</time>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {it.questions.map((q) => (
              <span key={q.id} className="rounded-full bg-vote-soft px-3 py-0.5 text-xs font-semibold text-vote">{q.title}: {r.choices?.[q.id] ?? '—'}</span>
            ))}
          </div>
        </div>
      ) : it.kind === 'vote' ? (
        <div key={r.id} className="flex flex-wrap items-center gap-2 py-3 text-sm">
          <span className="flex-1 font-semibold">{r.name ?? 'Anonim'}{r.anonymous && <span className="ml-2 rounded-full bg-anon-soft px-2 py-0.5 text-xs font-semibold text-anon">Anonymous</span>}</span>
          {!seenIds.includes(r.id) && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">BARU</span>}
          <VerifiedChip r={r} />
          <span className="rounded-full bg-vote-soft px-3 py-0.5 text-xs font-semibold text-vote">{r.choice}</span>
          <time className="w-28 text-right text-xs text-mute">{fmtDate(r.at)}</time>
        </div>
      ) : (
        <ResponseRow key={r.id} r={r} anon={it.kind === 'anon'} isNew={!seenIds.includes(r.id)} onPatch={(p) => patchResponse(r.id, p)} onDelete={() => removeResponse(r.id)} />
      )} />
    </Card>
  )
}

function ResponseRow({ r, anon, isNew, onPatch, onDelete }: { r: Response; anon: boolean; isNew: boolean; onPatch: (p: Partial<Response>) => void; onDelete: () => void }) {
  const [reply, setReply] = useState(r.reply ?? '')
  const [open, setOpen] = useState(false)
  // Anonim berlaku per-interaksi ('anon') atau per-respons (pengirim memilih Anonymous di form publik).
  const isAnon = anon || !!r.anonymous || !r.name
  return (
    <div className="space-y-2 py-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <b>{isAnon ? 'Anonim' : r.name}</b>
        {isNew && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">BARU</span>}
        {isAnon && <span className="rounded-full bg-anon-soft px-2 py-0.5 text-xs font-semibold text-anon">Anonymous</span>}
        <time className="text-xs text-mute">{fmtDate(r.at)}</time>
        {/* Status tetap ditampilkan & bisa diubah pemilik link untuk pesan
            anonim juga: yang disembunyikan hanya nama pengirim, bukan
            kontrol statusnya. */}
        <StatusPill s={r.status} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-mute">
            Update Status
            <select aria-label="Update status" className="rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-ink" value={r.status} onChange={(e) => onPatch({ status: e.target.value as Status })}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <button
            className={`text-xs font-semibold hover:underline ${r.status === 'Selesai' ? 'text-emerald-700' : 'text-brand'}`}
            disabled={r.status === 'Selesai'}
            onClick={() => onPatch({ status: 'Selesai' })}
          >
            {r.status === 'Selesai' ? '✓ Selesai' : 'Selesai'}
          </button>
          <button className="text-xs font-semibold text-brand hover:underline" onClick={() => { setOpen(!open); if (r.status === 'Baru') onPatch({ status: 'Dibaca' }) }}>Balas</button>
          <button className="text-xs font-semibold text-mute hover:text-ink" onClick={() => onPatch({ shared: !r.shared })}>{r.shared ? '✓ Dibagikan' : 'Share'}</button>
          <button className="text-xs font-semibold text-red-700 hover:underline" onClick={onDelete}>Hapus</button>
        </div>
      </div>
      <p className="leading-relaxed">{r.message}</p>
      {r.reply && !open && <p className="rounded-lg bg-ground px-3 py-2 text-mute"><b className="text-ink">Balasan:</b> {r.reply}</p>}
      {open && (
        <div className="flex gap-2">
          <input className={inputCls} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Tulis balasan…" />
          <Btn onClick={() => { onPatch({ reply, status: r.status === 'Baru' || r.status === 'Dibaca' ? 'Diproses' : r.status }); setOpen(false) }}>Kirim</Btn>
        </div>
      )}
    </div>
  )
}

function Share({ it }: { it: Interaction }) {
  const url = publicUrl(it.slug)
  const [copied, setCopied] = useState(false)
  const enc = encodeURIComponent(url)
  const text = encodeURIComponent(it.title)
  const socials = [
    ['WhatsApp', `https://wa.me/?text=${text}%20${enc}`],
    ['X', `https://twitter.com/intent/tweet?text=${text}&url=${enc}`],
    ['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${enc}`],
    ['Telegram', `https://t.me/share/url?url=${enc}&text=${text}`],
  ]
  return (
    <Card className="grid gap-6 p-6 sm:grid-cols-[1fr_auto]">
      <div className="space-y-4">
        <h2 className="font-display text-lg font-bold">Public link</h2>
        <div className="flex gap-2">
          <input readOnly className={`${inputCls} font-mono text-xs`} value={url} onFocus={(e) => e.target.select()} />
          <Btn onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>{copied ? 'Tersalin ✓' : 'Copy link'}</Btn>
        </div>
        <div className="flex flex-wrap gap-2">
          {socials.map(([n, h]) => <a key={n} href={h} target="_blank" rel="noreferrer" className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold hover:bg-brand-soft">{n}</a>)}
        </div>
        <a href={`#/p/${it.slug}`} target="_blank" className="inline-block text-sm font-semibold text-brand hover:underline">Buka sebagai pengunjung ↗</a>
      </div>
      <div className="text-center"><QR value={url} /><p className="mt-2 text-xs text-mute">QR Code</p></div>
    </Card>
  )
}

function Flow() {
  const STEPS = [
    ['Daftar / Login', 'Buat akun baru (otomatis sebagai User) atau login dengan akun yang sudah ada.'],
    ['Dashboard Utama', 'Ringkasan total Voting, Kritik & Saran, Pesan Anonim, serta aktivitas terbaru.'],
    ['Buat Interaksi', 'Pilih jenis, atur judul, deskripsi, periode, dan dapatkan public link.'],
    ['Bagikan Public Link', 'Copy link, QR Code, atau share ke WhatsApp, Telegram, X, Facebook.'],
    ['Kelola Respons', 'Lihat hasil, balas, ubah status, cari/filter, dan export CSV.'],
  ] as const

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-brand">Workflow</p>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Alur Kerja Forafa-App</h1>
      </header>
      <ol className="space-y-4">
        {STEPS.map(([t, d], k) => (
          <li key={t} className="flex gap-4 rounded-2xl border border-line bg-white p-5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand font-bold text-white">{k + 1}</span>
            <div><h2 className="font-display text-lg font-bold">{t}</h2><p className="text-sm text-mute">{d}</p></div>
          </li>
        ))}
      </ol>
      <Card className="p-6">
        <h2 className="font-display text-lg font-bold">Alur pengunjung (tanpa akun)</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-vote-soft p-4 text-sm"><b className="text-vote">Voting</b><p className="mt-1">Buka link → verifikasi Google / WhatsApp OTP di awal → jawab tiap pertanyaan (Ketua, Wakil, …) — bila ragu, pakai "Bantuan memilih voting yang tepat" → kirim vote</p></div>
          <div className="rounded-xl bg-fb-soft p-4 text-sm"><b className="text-fb">Kritik &amp; Saran</b><p className="mt-1">Buka link → verifikasi Google / WhatsApp OTP di awal → isi nama → tulis masukan → kirim, lalu pantau status &amp; balasan di Riwayat Saya</p></div>
          <div className="rounded-xl bg-anon-soft p-4 text-sm"><b className="text-anon">Anonim</b><p className="mt-1">Buka link → verifikasi Google / WhatsApp OTP di awal → tulis pesan → kirim (tetap tampil sebagai Anonim ke pemilik link) → pantau status &amp; balasan di Riwayat Saya</p></div>
        </div>
        <p className="mt-4 text-sm text-mute">
          Status respons: <StatusPill s="Baru" /> → <StatusPill s="Dibaca" /> → <StatusPill s="Diproses" /> → <StatusPill s="Selesai" />
        </p>
      </Card>
    </div>
  )
}
