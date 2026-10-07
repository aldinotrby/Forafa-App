import { useState } from 'react'
import { useStore, type Interaction, type Kind, type Response, type Status } from './store'
import { Bar, Btn, Card, Field, KIND, KindBadge, Logo, Paginated, QR, STATUSES, StatusPill, exportCsv, fmtDate, inputCls, publicUrl } from './ui'

type Nav = 'home' | Kind | 'flow'

export default function UserWorkspace({ asUserId, onBack, adminBanner }: { asUserId?: string; onBack?: () => void; adminBanner?: string } = {}) {
  const { user, logout, interactions } = useStore()
  const effectiveUserId = asUserId ?? user!.id
  const [nav, setNav] = useState<Nav>('home')
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState<Kind | null>(null)

  const go = (n: Nav) => { setNav(n); setOpenId(null) }
  const open = interactions.find((i) => i.id === openId)

  const navItems: { id: Nav; label: string; icon: string }[] = [
    { id: 'home', label: 'Dashboard', icon: '▦' },
    { id: 'vote', label: 'Voting', icon: KIND.vote.icon },
    { id: 'feedback', label: 'Kritik & Saran', icon: KIND.feedback.icon },
    { id: 'anon', label: 'Pesan Anonim', icon: KIND.anon.icon },
    { id: 'flow', label: 'Alur Kerja', icon: '⇢' },
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
            </button>
          ))}
        </nav>
        <div className="mt-auto hidden space-y-3 lg:block">
          {adminBanner ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-600">Melihat sebagai</p>
              <p className="font-semibold text-ink">{adminBanner}</p>
            </div>
          ) : (
            <div className="rounded-xl bg-ground p-3 text-sm">
              <p className="font-semibold">{user!.username}</p>
              <p className="text-xs text-mute">User</p>
            </div>
          )}
          {onBack ? (
            <Btn variant="ghost" className="w-full" onClick={onBack}>← Kembali ke Admin</Btn>
          ) : (
            <Btn variant="ghost" className="w-full" onClick={logout}>Keluar</Btn>
          )}
        </div>
      </aside>

      <main className="min-w-0 p-5 sm:p-8">
        {open ? (
          <Detail it={open} back={() => setOpenId(null)} />
        ) : nav === 'flow' ? (
          <Flow />
        ) : (
          <Listing nav={nav} onOpen={setOpenId} onCreate={setCreating} effectiveUserId={effectiveUserId} targetUsername={adminBanner} />
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

function Listing({ nav, onOpen, onCreate, effectiveUserId, targetUsername }: {
  nav: Nav; onOpen: (id: string) => void; onCreate: (k: Kind) => void; effectiveUserId: string; targetUsername?: string
}) {
  const { user, interactions } = useStore()
  const { mine, resp } = useMine(effectiveUserId)
  const kind = nav === 'home' || nav === 'flow' ? null : nav
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
            return (
              <button key={i.id} onClick={() => onOpen(i.id)} className="group rounded-2xl border border-line bg-white p-5 text-left transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between">
                  <KindBadge k={i.kind} />
                  <span className={`text-xs font-semibold ${i.active ? 'text-emerald-600' : 'text-mute'}`}>{i.active ? '● Aktif' : '○ Nonaktif'}</span>
                </div>
                <h3 className="mt-3 font-display text-lg font-bold leading-snug group-hover:text-brand">{i.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-mute">{i.description}</p>
                <p className="mt-4 text-xs text-mute">{n} respons · /p/{i.slug}</p>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function Create({ kind, onClose, onDone, ownerIdOverride }: { kind: Kind; onClose: () => void; onDone: (id: string) => void; ownerIdOverride?: string }) {
  const { addInteraction } = useStore()
  const m = KIND[kind]
  const [f, setF] = useState({
    title: '',
    description: '',
    start: new Date().toISOString().slice(0, 10),
    end: '',
    options: kind === 'vote' ? ['', ''] : kind === 'feedback' ? ['Umum'] : [] as string[],
  })
  const label = kind === 'vote' ? 'Pilihan' : 'Topik form (custom)'
  const setOpt = (k: number, v: string) => setF((p) => ({ ...p, options: p.options.map((o, j) => (j === k ? v : o)) }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const options = f.options.map((o) => o.trim()).filter(Boolean)
    if (kind === 'vote' && options.length < 2) return alert('Voting butuh minimal 2 pilihan.')
    onDone(addInteraction({ kind, title: f.title, description: f.description, start: f.start, end: f.end, options, active: true }, ownerIdOverride).id)
  }

  return (
    <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-ink/50 p-4 sm:p-10" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <div><KindBadge k={kind} /><h2 className="mt-2 font-display text-2xl font-extrabold">Buat {m.label}</h2></div>
        <Field label="Judul"><input className={inputCls} required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Deskripsi"><textarea className={inputCls} rows={3} required value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        {kind !== 'anon' && (
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

function Detail({ it, back }: { it: Interaction; back: () => void }) {
  const { responses, updateInteraction, removeInteraction } = useStore()
  const [tab, setTab] = useState<'hasil' | 'respons' | 'bagikan'>('hasil')
  const rs = responses.filter((r) => r.iid === it.id)
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
      {tab === 'respons' && <Responses it={it} rs={rs} />}
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
            <Btn variant="danger" onClick={() => { if (confirm('Hapus interaksi beserta seluruh responsnya?')) { removeInteraction(it.id); back() } }}>Hapus interaksi</Btn>
          </Card>
        </div>
      )}
      <span className="hidden">{m.label}</span>
    </div>
  )
}

function Stats({ it, rs }: { it: Interaction; rs: Response[] }) {
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

function Responses({ it, rs }: { it: Interaction; rs: Response[] }) {
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
      <Paginated items={list} render={(r) => it.kind === 'vote' ? (
        <div key={r.id} className="flex items-center gap-3 py-3 text-sm">
          <span className="flex-1 font-semibold">{r.name}</span>
          <span className="rounded-full bg-vote-soft px-3 py-0.5 text-xs font-semibold text-vote">{r.choice}</span>
          <time className="w-28 text-right text-xs text-mute">{fmtDate(r.at)}</time>
        </div>
      ) : (
        <ResponseRow key={r.id} r={r} anon={it.kind === 'anon'} onPatch={(p) => patchResponse(r.id, p)} onDelete={() => removeResponse(r.id)} />
      )} />
    </Card>
  )
}

function ResponseRow({ r, anon, onPatch, onDelete }: { r: Response; anon: boolean; onPatch: (p: Partial<Response>) => void; onDelete: () => void }) {
  const [reply, setReply] = useState(r.reply ?? '')
  const [open, setOpen] = useState(false)
  return (
    <div className="space-y-2 py-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <b>{anon ? 'Anonim' : r.name}</b>
        <time className="text-xs text-mute">{fmtDate(r.at)}</time>
        {!anon && <StatusPill s={r.status} />}
        <div className="ml-auto flex gap-2">
          {!anon && (
            <select aria-label="Ubah status" className="rounded-md border border-line bg-white px-2 py-1 text-xs" value={r.status} onChange={(e) => onPatch({ status: e.target.value as Status })}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          )}
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
          <div className="rounded-xl bg-vote-soft p-4 text-sm"><b className="text-vote">Voting</b><p className="mt-1">Buka link → isi nama → pilih satu → kirim vote</p></div>
          <div className="rounded-xl bg-fb-soft p-4 text-sm"><b className="text-fb">Kritik &amp; Saran</b><p className="mt-1">Buka link → isi nama → tulis masukan → kirim</p></div>
          <div className="rounded-xl bg-anon-soft p-4 text-sm"><b className="text-anon">Anonim</b><p className="mt-1">Buka link → tulis pesan → kirim (tanpa identitas)</p></div>
        </div>
        <p className="mt-4 text-sm text-mute">
          Status respons: <StatusPill s="Baru" /> → <StatusPill s="Dibaca" /> → <StatusPill s="Diproses" /> → <StatusPill s="Selesai" />
        </p>
      </Card>
    </div>
  )
}
