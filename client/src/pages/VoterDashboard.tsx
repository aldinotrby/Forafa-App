import { useEffect, useRef, useState } from 'react'
import { useStore, type Interaction, type Response } from '../services/store'
import { initGoogleSignIn, isGoogleConfigured } from '../services/googleAuth'
import { loadIdentities, removeIdentity, saveIdentity, type VerifiedVoter } from '../services/otpService'
import { loadSeenReplyIds, markRepliesSeen, markReplySeen } from '../services/replyNotifications'
import { Btn, Card, KindBadge, Logo, StatusPill, fmtDate } from '../components/ui'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  )
}

/**
 * Dashboard pengisi link (`#/riwayat`): profil, riwayat voting, riwayat
 * kritik & saran, link voting yang pernah diisi, serta status & detail
 * balasan dari pembuat link — untuk identitas terverifikasi (Google /
 * WhatsApp) yang tersimpan di perangkat ini.
 *
 * Riwayat dihitung dari data lokal di perangkat & browser ini saja
 * (localStorage): pengisian yang dilakukan tanpa verifikasi tidak
 * tertaut ke identitas mana pun sehingga tidak muncul di sini.
 */
export default function VoterDashboard() {
  const { interactions, responses } = useStore()
  const [identities, setIdentities] = useState<VerifiedVoter[]>(() => loadIdentities())
  const [selectedKey, setSelectedKey] = useState<string>(() => loadIdentities()[0]?.key ?? '')
  const [openReplyId, setOpenReplyId] = useState<string | null>(null)
  /** Id respons yang balasannya sudah dibaca (notifikasi balasan). */
  const [seenIds, setSeenIds] = useState<string[]>(() => loadSeenReplyIds())
  const [showGoogle, setShowGoogle] = useState(false)
  const [googleErr, setGoogleErr] = useState<string | null>(null)
  const googleBtnRef = useRef<HTMLDivElement>(null)
  const googleConfigured = isGoogleConfigured()

  const selected = identities.find((v) => v.key === selectedKey) ?? identities[0] ?? null

  // Tambah akun Google sebagai identitas dashboard (juga dipakai saat belum ada identitas sama sekali).
  const needGoogle = showGoogle || identities.length === 0
  useEffect(() => {
    if (!needGoogle || !googleConfigured) return
    let cleanup: (() => void) | undefined
    let cancelled = false
    initGoogleSignIn(({ profile, error }) => {
      if (error) setGoogleErr(error)
      else if (profile) {
        const v: VerifiedVoter = {
          method: 'google',
          key: `google:${profile.googleId}`,
          label: profile.email,
          verifiedAt: new Date().toISOString(),
          slug: '',
        }
        saveIdentity(v)
        setIdentities(loadIdentities())
        setSelectedKey(v.key)
        setShowGoogle(false)
      }
    }, googleBtnRef.current)
      .then((fn) => {
        if (cancelled) fn()
        else cleanup = fn
      })
      .catch((e) => setGoogleErr(e instanceof Error ? e.message : 'Login Google gagal dimuat.'))
    return () => {
      cancelled = true
      cleanup?.()
    }
    // needGoogle berubah saat identitas ditambah/dihapus; handler di bawah stabil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needGoogle, googleConfigured])

  const findInteraction = (iid: string) => interactions.find((i) => i.id === iid)
  const myResponses = selected
    ? [...responses.filter((r) => r.voterKey === selected.key)].sort((a, b) => +new Date(b.at) - +new Date(a.at))
    : []
  const voteResponses = myResponses.filter((r) => findInteraction(r.iid)?.kind === 'vote')
  const feedbackResponses = myResponses.filter((r) => findInteraction(r.iid)?.kind !== 'vote')
  const repliesReceived = feedbackResponses.filter((r) => r.reply).length
  /** Balasan yang belum dibaca untuk identitas yang dipilih. */
  const unseen = selected
    ? [...responses.filter((r) => r.voterKey === selected.key && r.reply && !seenIds.includes(r.id))].sort((a, b) => +new Date(b.at) - +new Date(a.at))
    : []

  // Link voting yang pernah diisi (unik per interaksi, beserta pengisian terakhir).
  const voteLinks = (() => {
    const map = new Map<string, { it: Interaction; lastAt: string; count: number }>()
    for (const r of voteResponses) {
      const it = findInteraction(r.iid)
      if (!it) continue
      const prev = map.get(it.id)
      if (prev) map.set(it.id, { ...prev, count: prev.count + 1, lastAt: r.at > prev.lastAt ? r.at : prev.lastAt })
      else map.set(it.id, { it, lastAt: r.at, count: 1 })
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

        {identities.length === 0 || !selected ? (
          <Card className="space-y-4 p-6 text-center">
            <h2 className="font-display text-xl font-bold">Belum ada identitas terverifikasi</h2>
            <p className="mx-auto max-w-md text-sm text-mute">
              Verifikasi dengan akun Google di bawah ini, atau verifikasi lewat WhatsApp OTP saat mengisi link voting.
              Identitas yang sudah terverifikasi akan tersimpan di perangkat ini beserta riwayatnya.
            </p>
            {googleConfigured ? (
              <div className="flex justify-center"><div ref={googleBtnRef} aria-label="Login dengan Google" /></div>
            ) : (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Login Google belum dikonfigurasi (isi VITE_GOOGLE_CLIENT_ID). Sementara itu, verifikasi lewat WhatsApp OTP di link voting.
              </p>
            )}
            {googleErr && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{googleErr}</p>}
            <p><a href="#/" className="text-sm font-semibold text-brand hover:underline">← Kembali ke beranda</a></p>
          </Card>
        ) : (
          <>
            {/* Pilihan identitas */}
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Pilih identitas">
              {identities.map((v) => (
                <button
                  key={v.key}
                  onClick={() => setSelectedKey(v.key)}
                  aria-current={selectedKey === v.key}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    selectedKey === v.key ? 'border-brand bg-brand text-white' : 'border-line bg-white text-mute hover:bg-ground'
                  }`}
                >
                  {v.method === 'google' ? 'G ' : '💬 '} {v.label}
                </button>
              ))}
              <Btn variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => { setGoogleErr(null); setShowGoogle((s) => !s) }}>
                + Akun Google
              </Btn>
            </div>
            {showGoogle && (
              <Card className="space-y-3 p-5">
                {googleConfigured ? (
                  <div className="flex justify-center"><div ref={googleBtnRef} aria-label="Login dengan Google" /></div>
                ) : (
                  <p className="text-sm text-mute">Login Google belum dikonfigurasi. Isi VITE_GOOGLE_CLIENT_ID di file .env (lihat .env.example), lalu muat ulang aplikasi.</p>
                )}
                {googleErr && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{googleErr}</p>}
              </Card>
            )}

            {/* Notifikasi balasan baru dari pembuat link */}
            {unseen.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4" role="status">
                <span className="text-xl" aria-hidden>🔔</span>
                <p className="min-w-0 flex-1 text-sm leading-relaxed text-amber-900">
                  <b>Ada {unseen.length} balasan baru dari pembuat link</b> untuk kritik &amp; saran Anda. Buka detail balasan di bawah untuk membacanya.
                </p>
                <a href="#kritik-saran" className="text-sm font-semibold text-brand hover:underline">Lihat balasan</a>
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
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-mute">
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    ✓ Terverifikasi · {selected.method === 'google' ? 'Google' : 'WhatsApp OTP'}
                  </span>
                  <span>Terverifikasi {fmtDate(selected.verifiedAt)}</span>
                </p>
              </div>
              <Btn variant="ghost" className="text-xs" onClick={() => dropIdentity(selected.key)}>Hapus dari perangkat</Btn>
            </Card>

            {/* Statistik ringkas */}
            <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                ['Voting diisi', voteResponses.length],
                ['Kritik & saran', feedbackResponses.length],
                ['Link voting', voteLinks.length],
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
                  {voteLinks.map(({ it, lastAt, count }) => (
                    <Card key={it.id} className="p-5">
                      <div className="flex items-center justify-between gap-2">
                        <KindBadge k={it.kind} />
                        <span className={`text-xs font-semibold ${it.active ? 'text-emerald-600' : 'text-mute'}`}>{it.active ? '● Aktif' : '○ Nonaktif'}</span>
                      </div>
                      <h3 className="mt-3 font-display text-lg font-bold leading-snug">{it.title}</h3>
                      <p className="mt-1 text-sm text-mute">{count} suara · terakhir {fmtDate(lastAt)}</p>
                      <a href={`#/p/${it.slug}`} className="mt-3 inline-block text-sm font-semibold text-brand hover:underline">Buka link ↗</a>
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
                    const it = findInteraction(r.iid)
                    return (
                      <div key={r.id} className="flex flex-wrap items-center gap-2 py-4 text-sm">
                        <span className="min-w-0 flex-1">
                          <b>{it?.title ?? 'Link dihapus'}</b>
                          <span className="block truncate text-mute">{r.choice}</span>
                        </span>
                        <StatusPill s={r.status} />
                        <a href={it ? `#/p/${it.slug}` : undefined} className="shrink-0 text-xs font-semibold text-brand hover:underline">Lihat link</a>
                        <time className="w-28 shrink-0 text-right text-xs text-mute">{fmtDate(r.at)}</time>
                      </div>
                    )
                  })}
                </Card>
              )}
            </section>

            {/* Riwayat kritik & saran + status & detail balasan */}
            <section className="space-y-3" id="kritik-saran">
              <h2 className="font-display text-xl font-bold">Riwayat kritik &amp; saran</h2>
              {feedbackResponses.length === 0 ? (
                <Card className="p-6 text-center text-sm text-mute">
                  Belum ada kritik &amp; saran dari identitas ini. Isi kritik &amp; saran dengan verifikasi opsional di formnya agar tercatat di sini.
                </Card>
              ) : (
                <div className="space-y-3">
                  {feedbackResponses.map((r) => {
                    const it = findInteraction(r.iid)
                    const open = openReplyId === r.id
                    return (
                      <Card key={r.id} className="p-5">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <b className="flex-1">{it?.title ?? 'Link dihapus'}</b>
                          {r.reply && !seenIds.includes(r.id) && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">BARU</span>
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
                          <button
                            className="font-semibold text-brand hover:underline"
                            onClick={() => {
                              if (!open && r.reply) setSeenIds(markReplySeen(r.id))
                              setOpenReplyId(open ? null : r.id)
                            }}
                          >
                            {open ? 'Tutup detail ↑' : 'Lihat detail balasan ↓'}
                          </button>
                        </div>
                        {open && <ReplyDetail r={r} />}
                      </Card>
                    )
                  })}
                </div>
              )}
            </section>

            <p className="text-center text-xs text-mute">
              Riwayat dihitung dari perangkat &amp; browser ini saja (data tersimpan lokal). Pengisian tanpa verifikasi tidak tertaut ke identitas mana pun.
              {' '}<a href="#/" className="font-semibold text-brand hover:underline">← Kembali ke beranda</a>
            </p>
          </>
        )}
      </main>
    </div>
  )
}

/** Detail balasan pesan: pesan lengkap, balasan pemilik, dan statusnya. */
function ReplyDetail({ r }: { r: Response }) {
  return (
    <div className="mt-4 space-y-3 rounded-xl border border-line bg-ground/60 p-4 text-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-mute">Pesan Anda</p>
        <p className="mt-1 whitespace-pre-wrap leading-relaxed">{r.message}</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-mute">Balasan pembuat link</p>
        {r.reply ? (
          <p className="mt-1 whitespace-pre-wrap rounded-lg bg-white p-3 leading-relaxed">{r.reply}</p>
        ) : (
          <p className="mt-1 text-mute">Belum ada balasan. Pembuat link akan membalas setelah membaca pesan Anda.</p>
        )}
      </div>
      <p className="flex items-center gap-2 text-xs text-mute">
        Status balasan: <StatusPill s={r.status} />
        <span>Dikirim {fmtDate(r.at)}</span>
      </p>
    </div>
  )
}
