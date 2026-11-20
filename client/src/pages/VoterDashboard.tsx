import { useEffect, useState } from 'react'
import { useStore, type Kind, type Response } from '../services/store'
import { fetchMyResponses, mergeHistories, type ServerResponseItem } from '../services/myResponses'
import { loadIdentities, removeIdentity, type VerifiedVoter } from '../services/otpService'
import { loadSeenReplyIds, markRepliesSeen } from '../services/replyNotifications'
import { Btn, Card, KindBadge, Logo, StatusPill, fmtDate } from '../components/ui'
import VoterLogin from './VoterLogin'

/**
 * Dashboard pengisi link (`#/riwayat`): profil, riwayat voting, riwayat
 * kritik & saran, riwayat pesan anonim, link voting yang pernah diisi,
 * serta status & detail balasan dari pembuat link — untuk identitas
 * terverifikasi (Google) yang tersimpan di perangkat ini.
 *
 * Identitas ditambahkan saat pengisi verifikasi di awal pengisian sebuah
 * link (Login Google di halaman publik), atau lewat layar login
 * di dashboard ini sendiri (`VoterLogin`) — masuk dengan identitas yang
 * sudah ada, atau daftar sebagai pengisi baru. Tidak ada data demo.
 *
 * Riwayat dihitung dari data lokal di perangkat & browser ini saja
 * (localStorage): setiap kiriman — voting, kritik & saran, maupun pesan
 * anonim — selalu membawa `voterKey` identitas terverifikasi pengirimnya,
 * sehingga balasan pemilik link atas kiriman itu muncul di sini. Saat
 * pengisi masuk lewat layar login, kiriman lama di perangkat ini yang
 * memakai `voterKey` yang sama langsung ikut tampil — riwayat tidak
 * mulai dari 0 bila ia sudah pernah mengisi link sebelumnya.
 *
 * Riwayat dari server: bila pengguna masuk dengan akun Forafa, dashboard
 * juga mengambil `GET /responses/mine` — kiriman yang dibuat saat masuk
 * (di perangkat mana pun) karena submit publik menyertakan JWT akun
 * sehingga backend mencatat `user_id`-nya. Kiriman server digabung ke
 * riwayat identitas yang cocok (akun Google → identitas Google yang
 * sama; akun email → pilihan "Akun Forafa" sendiri) dan ditandai lencana
 * "Server". Bila server tidak terjangkau, dashboard tetap menampilkan
 * riwayat lokal.
 *
 * Detail balasan tidak lagi dibuka inline di sini: tombol "Lihat detail
 * balasan" membuka halaman khusus (`#/balasan/:id`, `ReplyDetailPage`)
 * yang menampilkan kiriman beserta balasannya tanpa layar login.
 */

/** Identitas yang bisa dipilih: identitas voter (Google) atau akun
    Forafa yang sedang login (riwayat server). */
interface DashboardIdentity {
  key: string
  label: string
  kind: 'voter' | 'account'
  method?: 'google' | 'whatsapp'
  verifiedAt?: string
}

/** Link yang dirujuk satu kiriman — dari data lokal, atau dari kolom
    backend bila linknya tidak ada di perangkat ini. */
interface ResolvedInteraction {
  title: string
  slug: string
  kind: Kind
  /** undefined = status tidak diketahui (kiriman server yang linknya
      tidak ada di perangkat ini). */
  active?: boolean
}

export default function VoterDashboard() {
  const { user, session, logout, interactions, responses } = useStore()
  const [identities, setIdentities] = useState<VerifiedVoter[]>(() => loadIdentities())
  const [selectedKey, setSelectedKey] = useState<string>(() => loadIdentities()[0]?.key ?? '')
  /** Id respons yang balasannya sudah dibaca (notifikasi balasan). */
  const [seenIds, setSeenIds] = useState<string[]>(() => loadSeenReplyIds())
  /** Tampilkan layar login untuk menambah identitas lain. */
  const [showLogin, setShowLogin] = useState(false)
  /** Info login terakhir — dipakai banner "riwayat ditemukan". */
  const [justLoggedIn, setJustLoggedIn] = useState<{ label: string; count: number } | null>(null)
  /** Kiriman milik akun login dari server (`GET /responses/mine`). */
  const [serverResponses, setServerResponses] = useState<ServerResponseItem[] | null>(null)
  const [serverState, setServerState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')

  /** Kunci identitas yang mewakili akun Forafa yang sedang login:
      akun Google → `google:<sub>` (sama dengan voterKey-nya); akun email
      → `account:<id>` (tidak punya voterKey, jadi tampil sebagai
      pilihan identitas sendiri). */
  const accountKey = user ? (user.googleId ? `google:${user.googleId}` : `account:${user.id}`) : null
  const accountIdentity: DashboardIdentity | null =
    user && accountKey
      ? {
          key: accountKey,
          label: `Akun Forafa · ${user.username}`,
          kind: 'account',
          method: user.googleId ? 'google' : undefined,
          verifiedAt: session?.loginAt,
        }
      : null
  const voterIdentities: DashboardIdentity[] = identities.map((v) => ({
    key: v.key,
    label: v.label,
    kind: 'voter',
    method: v.method,
    verifiedAt: v.verifiedAt,
  }))
  /** Akun tidak diduplikasi bila kuncinya sudah ada sebagai identitas voter. */
  const allIdentities: DashboardIdentity[] = [
    ...voterIdentities,
    ...(accountIdentity && !voterIdentities.some((v) => v.key === accountIdentity.key) ? [accountIdentity] : []),
  ]

  /** Bila belum ada identitas voter yang dipilih tetapi akun login ada,
      pilih identitas akun supaya riwayat server langsung tampil. */
  useEffect(() => {
    if (!selectedKey && accountIdentity) setSelectedKey(accountIdentity.key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, accountKey])

  /** Ambil riwayat server saat akun login tersedia. Token backend
      (`fa_token`) diisi sesaat setelah login — bila belum ada saat
      dashboard dibuka, coba sekali lagi setelah 2 detik. */
  useEffect(() => {
    if (!user) {
      setServerResponses(null)
      setServerState('idle')
      return
    }
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const run = async () => {
      setServerState('loading')
      const rows = await fetchMyResponses()
      if (cancelled) return
      if (rows !== null) {
        setServerState('ok')
        setServerResponses(rows)
        return
      }
      let hasToken = false
      try {
        hasToken = Boolean(sessionStorage.getItem('fa_token'))
      } catch {
        hasToken = false
      }
      if (!hasToken) {
        timer = setTimeout(async () => {
          if (cancelled) return
          const retry = await fetchMyResponses()
          if (cancelled) return
          if (retry === null) {
            setServerState('error')
            setServerResponses(null)
          } else {
            setServerState('ok')
            setServerResponses(retry)
          }
        }, 2000)
        return
      }
      setServerState('error')
      setServerResponses(null)
    }
    void run()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  /** Muat ulang riwayat server (tombol "Perbarui"). */
  const refreshServer = async () => {
    if (!user) return
    setServerState('loading')
    const rows = await fetchMyResponses()
    if (rows === null) {
      setServerState('error')
      setServerResponses(null)
    } else {
      setServerState('ok')
      setServerResponses(rows)
    }
  }

  /** Identitas sudah disimpan oleh VoterLogin; muat ulang, pilih, dan
      hitung berapa kiriman lama yang ikut tampil untuk identitas itu. */
  const handleLoggedIn = (v: VerifiedVoter) => {
    setIdentities(loadIdentities())
    setSelectedKey(v.key)
    setJustLoggedIn({ label: v.label, count: responses.filter((r) => r.voterKey === v.key).length })
    setShowLogin(false)
  }

  const selected = allIdentities.find((v) => v.key === selectedKey) ?? allIdentities[0] ?? null
  /** Riwayat server hanya berlaku untuk identitas yang mewakili akun
      login (identitas Google yang sama, atau pilihan "Akun Forafa"). */
  const serverApplies = accountKey !== null && selected?.key === accountKey
  /** Pool lokal untuk dedupe: identitas akun tidak punya voterKey, jadi
      semua kiriman lokal dipakai sebagai pembanding. */
  const baseLocal = selected
    ? selected.kind === 'account'
      ? responses
      : responses.filter((r) => r.voterKey === selected.key)
    : []
  const merged = serverResponses ? mergeHistories(baseLocal, serverResponses) : [...baseLocal]
  /** Tampilan akun hanya berisi kiriman server (yang cocok dengan lokal
      sudah digabung menjadi versi server); tampilan voter berisi kiriman
      lokalnya ditambah kiriman server yang tidak punya padanan lokal. */
  const myResponses = (
    selected?.kind === 'account'
      ? merged.filter((r) => r.fromServer)
      : merged.filter((r) => r.voterKey === selected?.key || r.fromServer)
  ).sort((a, b) => +new Date(b.at) - +new Date(a.at))

  const resolveInteraction = (r: Response): ResolvedInteraction | undefined => {
    const local = interactions.find((i) => i.id === r.iid)
    if (local) return { title: local.title, slug: local.slug, kind: local.kind, active: local.active }
    if (r.fromServer) {
      return {
        title: r.interactionTitle ?? 'Link dihapus',
        slug: r.interactionSlug ?? '',
        kind: r.interactionKind ?? 'feedback',
        active: undefined,
      }
    }
    return undefined
  }
  const voteResponses = myResponses.filter((r) => resolveInteraction(r)?.kind === 'vote')
  const feedbackResponses = myResponses.filter((r) => resolveInteraction(r)?.kind === 'feedback')
  /** Pesan anonim dipisah dari kritik & saran agar balasan atas pesan
      anonim mudah ditemukan — sebelumnya tercampur di satu daftar. */
  const anonResponses = myResponses.filter((r) => resolveInteraction(r)?.kind === 'anon')
  const repliesReceived = myResponses.filter((r) => r.reply && resolveInteraction(r)?.kind !== 'vote').length
  /** Balasan yang belum dibaca untuk identitas yang dipilih. */
  const unseen = myResponses.filter((r) => r.reply && !seenIds.includes(r.id))

  // Link voting yang pernah diisi (unik per interaksi, beserta pengisian terakhir).
  const voteLinks = (() => {
    const map = new Map<string, { it: ResolvedInteraction; lastAt: string; count: number }>()
    for (const r of voteResponses) {
      const it = resolveInteraction(r)
      if (!it) continue
      const prev = map.get(r.iid)
      if (prev) map.set(r.iid, { ...prev, count: prev.count + 1, lastAt: r.at > prev.lastAt ? r.at : prev.lastAt })
      else map.set(r.iid, { it, lastAt: r.at, count: 1 })
    }
    return [...map.values()].sort((a, b) => +new Date(b.lastAt) - +new Date(a.lastAt))
  })()

  const dropIdentity = (key: string) => {
    if (!confirm('Hapus identitas ini dari perangkat? Riwayatnya tidak akan tampil lagi di dashboard ini.')) return
    removeIdentity(key)
    const rest = loadIdentities()
    setIdentities(rest)
    setSelectedKey(rest[0]?.key ?? '')
  }

  return (
    <div className="min-h-screen bg-ground">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-5 py-3">
          <Logo size={28} /><b className="font-display">Forafa-App</b>
          <span className="ml-auto rounded-full bg-ground px-3 py-1 text-xs text-mute">Pengisi link</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-5 py-10">
        <header>
          <p className="text-xs font-bold uppercase tracking-widest text-brand">Dashboard pengisi</p>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Riwayat Saya</h1>
          <p className="mt-1 text-sm text-mute">Voting, kritik &amp; saran, dan balasan dari pembuat link — untuk identitas terverifikasi Anda.</p>
        </header>

        {showLogin || allIdentities.length === 0 || !selected ? (
          <VoterLogin onLoggedIn={handleLoggedIn} onCancel={allIdentities.length > 0 ? () => setShowLogin(false) : undefined} />
        ) : (
          <>
            {/* Banner riwayat yang ikut tampil setelah masuk */}
            {justLoggedIn && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4" role="status">
                <span className="text-xl" aria-hidden>✓</span>
                <p className="min-w-0 flex-1 text-sm leading-relaxed text-emerald-900">
                  Masuk sebagai <b>{justLoggedIn.label}</b>.{' '}
                  {justLoggedIn.count > 0
                    ? <>Ditemukan <b>{justLoggedIn.count} kiriman sebelumnya</b> dengan identitas ini di perangkat ini — riwayat Anda tampil di bawah.</>
                    : <>Belum ada kiriman tercatat dengan identitas ini di perangkat ini — kiriman berikutnya yang terverifikasi akan muncul di sini.</>}
                </p>
                <Btn variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => setJustLoggedIn(null)}>Tutup</Btn>
              </div>
            )}

            {/* Pilihan identitas */}
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Pilih identitas">
              {allIdentities.map((v) => (
                <button
                  key={v.key}
                  onClick={() => setSelectedKey(v.key)}
                  aria-current={selectedKey === v.key}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    selectedKey === v.key ? 'border-brand bg-brand text-white' : 'border-line bg-white text-mute hover:bg-ground'
                  }`}
                >
                  {v.kind === 'account' ? '' : v.method === 'google' ? 'G ' : '💬 '} {v.label}
                </button>
              ))}
            </div>

            {/* Status riwayat server (hanya untuk identitas akun login) */}
            {serverApplies && (
              <div
                className={`flex flex-wrap items-center gap-3 rounded-xl border p-4 text-sm leading-relaxed ${
                  serverState === 'error'
                    ? 'border-amber-200 bg-amber-50 text-amber-900'
                    : 'border-line bg-white text-mute'
                }`}
                role="status"
              >
                {serverState === 'loading' && <p className="min-w-0 flex-1">Memuat riwayat dari server…</p>}
                {serverState === 'ok' && (
                  <>
                    <p className="min-w-0 flex-1">
                      Riwayat server dimuat — <b>{serverResponses?.length ?? 0} kiriman</b> dari akun ini (dari perangkat mana pun).
                      Kiriman server ditandai lencana “Server”.
                    </p>
                    <Btn variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => void refreshServer()}>Perbarui</Btn>
                  </>
                )}
                {serverState === 'error' && (
                  <>
                    <p className="min-w-0 flex-1">
                      Riwayat server tidak bisa dimuat — backend tidak terjangkau atau sesi akun sudah berakhir.
                      Riwayat lokal di perangkat ini tetap tampil.
                    </p>
                    <Btn variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => void refreshServer()}>Coba lagi</Btn>
                  </>
                )}
                {serverState === 'idle' && (
                  <p className="min-w-0 flex-1">Riwayat server akan dimuat untuk akun ini.</p>
                )}
              </div>
            )}

            {/* Notifikasi balasan baru dari pembuat link */}
            {unseen.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4" role="status">
                <span className="text-xl" aria-hidden>🔔</span>
                <p className="min-w-0 flex-1 text-sm leading-relaxed text-amber-900">
                  <b>Ada {unseen.length} balasan baru dari pembuat link</b> untuk kritik &amp; saran dan pesan anonim Anda. Buka halaman balasan untuk membacanya.
                </p>
                <a href={`#/balasan/${unseen[0].id}`} className="text-sm font-semibold text-brand hover:underline">Lihat balasan</a>
                <Btn variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => setSeenIds(markRepliesSeen(unseen.map((r) => r.id)))}>Tandai sudah dibaca</Btn>
              </div>
            )}

            {/* Profil pengguna */}
            <Card className="flex flex-wrap items-center gap-4 p-6">
              <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-brand font-display text-2xl font-extrabold text-white" aria-hidden>
                {selected.label.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-display text-2xl font-extrabold">{selected.label}</h2>
                {selected.kind === 'account' ? (
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-mute">
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700">Akun Forafa</span>
                    {selected.verifiedAt && <span>Masuk {fmtDate(selected.verifiedAt)}</span>}
                    <span>Riwayat dari server — kiriman saat masuk dengan akun ini.</span>
                  </p>
                ) : (
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-mute">
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      ✓ Terverifikasi · {selected.method === 'google' ? 'Google' : 'WhatsApp OTP'}
                    </span>
                    {selected.verifiedAt && <span>Terverifikasi {fmtDate(selected.verifiedAt)}</span>}
                  </p>
                )}
              </div>
              {selected.kind === 'account' ? (
                <Btn variant="ghost" className="text-xs" onClick={logout}>Keluar</Btn>
              ) : (
                <Btn variant="ghost" className="text-xs" onClick={() => dropIdentity(selected.key)}>Hapus dari perangkat</Btn>
              )}
            </Card>

            {/* Statistik ringkas */}
            <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                ['Voting diisi', voteResponses.length],
                ['Kritik & saran', feedbackResponses.length],
                ['Pesan anonim', anonResponses.length],
                ['Balasan diterima', repliesReceived],
              ].map(([label, n]) => (
                <Card key={label as string} className="p-5">
                  <p className="text-sm font-semibold text-mute">{label as string}</p>
                  <p className="mt-2 font-display text-4xl font-extrabold">{n as number}</p>
                </Card>
              ))}
            </section>

            {/* Link voting yang pernah diisi */}
            <section className="space-y-3">
              <h2 className="font-display text-xl font-bold">Link voting yang pernah diisi</h2>
              {voteLinks.length === 0 ? (
                <Card className="p-6 text-center text-sm text-mute">Belum ada voting yang diisi dengan identitas ini.</Card>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {voteLinks.map(({ it, lastAt, count }, k) => (
                    <Card key={`${it.slug || it.title}-${k}`} className="p-5">
                      <div className="flex items-center justify-between gap-2">
                        <KindBadge k={it.kind} />
                        {it.active === undefined ? (
                          <span className="text-xs font-semibold text-mute">Server</span>
                        ) : (
                          <span className={`text-xs font-semibold ${it.active ? 'text-emerald-600' : 'text-mute'}`}>{it.active ? '● Aktif' : '○ Nonaktif'}</span>
                        )}
                      </div>
                      <h3 className="mt-3 font-display text-lg font-bold leading-snug">{it.title}</h3>
                      <p className="mt-1 text-sm text-mute">{count} suara · terakhir {fmtDate(lastAt)}</p>
                      {it.slug ? (
                        <a href={`#/p/${it.slug}`} className="mt-3 inline-block text-sm font-semibold text-brand hover:underline">Buka link ↗</a>
                      ) : null}
                    </Card>
                  ))}
                </div>
              )}
            </section>

            {/* Riwayat voting */}
            <section className="space-y-3">
              <h2 className="font-display text-xl font-bold">Riwayat voting</h2>
              {voteResponses.length === 0 ? (
                <Card className="p-6 text-center text-sm text-mute">Belum ada riwayat voting untuk identitas ini.</Card>
              ) : (
                <Card className="divide-y divide-line px-5">
                  {voteResponses.map((r) => {
                    const it = resolveInteraction(r)
                    return (
                      <div key={r.id} className="flex flex-wrap items-center gap-2 py-4 text-sm">
                        <span className="min-w-0 flex-1">
                          <b>{it?.title ?? 'Link dihapus'}</b>
                          <span className="block truncate text-mute">{r.choice}</span>
                        </span>
                        {r.fromServer && (
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-700">Server</span>
                        )}
                        <StatusPill s={r.status} />
                        {r.reply && (
                          <a href={`#/balasan/${r.id}`} className="shrink-0 text-xs font-semibold text-brand hover:underline">Lihat balasan</a>
                        )}
                        {it?.slug ? (
                          <a href={`#/p/${it.slug}`} className="shrink-0 text-xs font-semibold text-brand hover:underline">Lihat link</a>
                        ) : null}
                        <time className="w-28 shrink-0 text-right text-xs text-mute">{fmtDate(r.at)}</time>
                      </div>
                    )
                  })}
                </Card>
              )}
            </section>

            {/* Riwayat kritik & saran + status & detail balasan */}
            <HistorySection
              id="kritik-saran"
              title="Riwayat kritik & saran"
              empty="Belum ada kritik & saran dari identitas ini. Isi kritik & saran lewat linknya — verifikasi Google di awal — agar tercatat di sini beserta balasannya."
              items={feedbackResponses}
              findInteraction={resolveInteraction}
              seenIds={seenIds}
            />

            {/* Riwayat pesan anonim + status & detail balasan */}
            <HistorySection
              id="pesan-anonim"
              title="Riwayat pesan anonim"
              empty="Belum ada pesan anonim dari identitas ini. Isi pesan anonim lewat linknya — verifikasi Google di awal — agar tercatat di sini beserta balasannya. Pemilik link tetap melihat kiriman Anda sebagai “Anonim”."
              items={anonResponses}
              findInteraction={resolveInteraction}
              seenIds={seenIds}
            />

            <p className="text-center text-xs text-mute">
              Riwayat lokal dihitung dari perangkat &amp; browser ini saja (data tersimpan lokal).
              Bila Anda masuk dengan akun Forafa, kiriman yang dibuat saat masuk juga tersimpan di server
              dan tampil di sini dengan lencana “Server” — dari perangkat mana pun.
              {' '}<a href="#/" className="font-semibold text-brand hover:underline">← Kembali ke beranda</a>
            </p>
          </>
        )}
      </main>
    </div>
  )
}

/** Satu daftar riwayat masukan (kritik & saran, atau pesan anonim):
    status, lencana balasan baru, dan tautan ke halaman khusus balasan
    (`#/balasan/:id`) — detail balasan tidak dibuka inline di sini. */
function HistorySection({ id, title, empty, items, findInteraction, seenIds }: {
  id: string
  title: string
  empty: string
  items: Response[]
  findInteraction: (r: Response) => ResolvedInteraction | undefined
  seenIds: string[]
}) {
  return (
    <section className="space-y-3" id={id}>
      <h2 className="font-display text-xl font-bold">{title}</h2>
      {items.length === 0 ? (
        <Card className="p-6 text-center text-sm text-mute">{empty}</Card>
      ) : (
        <div className="space-y-3">
          {items.map((r) => {
            const it = findInteraction(r)
            return (
              <Card key={r.id} className="p-5">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <b className="flex-1">{it?.title ?? 'Link dihapus'}</b>
                  {r.reply && !seenIds.includes(r.id) && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">BARU</span>
                  )}
                  {r.fromServer && (
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-700">Server</span>
                  )}
                  {it && <KindBadge k={it.kind} />}
                  <StatusPill s={r.status} />
                  <time className="text-xs text-mute">{fmtDate(r.at)}</time>
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-mute">{r.message}</p>
                <div className="mt-3 flex items-center gap-3 text-sm">
                  <span className={`font-semibold ${r.reply ? 'text-emerald-700' : 'text-mute'}`}>
                    {r.reply ? '✓ Sudah dibalas pembuat link' : '○ Belum ada balasan'}
                  </span>
                  <a href={`#/balasan/${r.id}`} className="font-semibold text-brand hover:underline">
                    {r.reply ? 'Lihat detail balasan →' : 'Lihat detail →'}
                  </a>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </section>
  )
}
