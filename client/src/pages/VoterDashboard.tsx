import { useState } from 'react'
import { useStore, type Interaction, type Response } from '../services/store'
import { loadIdentities, removeIdentity, type VerifiedVoter } from '../services/otpService'
import { loadSeenReplyIds, markRepliesSeen, markReplySeen } from '../services/replyNotifications'
import { Btn, Card, KindBadge, Logo, StatusPill, fmtDate } from '../components/ui'
import VoterLogin from './VoterLogin'

/**
 * Dashboard pengisi link (`#/riwayat`): profil, riwayat voting, riwayat
 * kritik & saran, riwayat pesan anonim, link voting yang pernah diisi,
 * serta status & detail balasan dari pembuat link — untuk identitas
 * terverifikasi (Google / WhatsApp) yang tersimpan di perangkat ini.
 *
 * Identitas ditambahkan saat pengisi verifikasi di awal pengisian sebuah
 * link (Google / WhatsApp OTP di halaman publik), atau lewat layar login
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
 */
export default function VoterDashboard() {
  const { interactions, responses } = useStore()
  const [identities, setIdentities] = useState<VerifiedVoter[]>(() => loadIdentities())
  const [selectedKey, setSelectedKey] = useState<string>(() => loadIdentities()[0]?.key ?? '')
  const [openReplyId, setOpenReplyId] = useState<string | null>(null)
  /** Id respons yang balasannya sudah dibaca (notifikasi balasan). */
  const [seenIds, setSeenIds] = useState<string[]>(() => loadSeenReplyIds())
  /** Tampilkan layar login untuk menambah identitas lain. */
  const [showLogin, setShowLogin] = useState(false)
  /** Info login terakhir — dipakai banner "riwayat ditemukan". */
  const [justLoggedIn, setJustLoggedIn] = useState<{ label: string; count: number } | null>(null)

  /** Identitas sudah disimpan oleh VoterLogin; muat ulang, pilih, dan
      hitung berapa kiriman lama yang ikut tampil untuk identitas itu. */
  const handleLoggedIn = (v: VerifiedVoter) => {
    setIdentities(loadIdentities())
    setSelectedKey(v.key)
    setJustLoggedIn({ label: v.label, count: responses.filter((r) => r.voterKey === v.key).length })
    setShowLogin(false)
  }

  const selected = identities.find((v) => v.key === selectedKey) ?? identities[0] ?? null

  const findInteraction = (iid: string) => interactions.find((i) => i.id === iid)
  const myResponses = selected
    ? [...responses.filter((r) => r.voterKey === selected.key)].sort((a, b) => +new Date(b.at) - +new Date(a.at))
    : []
  const voteResponses = myResponses.filter((r) => findInteraction(r.iid)?.kind === 'vote')
  const feedbackResponses = myResponses.filter((r) => findInteraction(r.iid)?.kind === 'feedback')
  /** Pesan anonim dipisah dari kritik & saran agar balasan atas pesan
      anonim mudah ditemukan — sebelumnya tercampur di satu daftar. */
  const anonResponses = myResponses.filter((r) => findInteraction(r.iid)?.kind === 'anon')
  const repliesReceived = myResponses.filter((r) => r.reply && findInteraction(r.iid)?.kind !== 'vote').length
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

        {showLogin || identities.length === 0 || !selected ? (
          <VoterLogin onLoggedIn={handleLoggedIn} onCancel={identities.length > 0 ? () => setShowLogin(false) : undefined} />
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
            </div>

            {/* Notifikasi balasan baru dari pembuat link */}
            {unseen.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4" role="status">
                <span className="text-xl" aria-hidden>🔔</span>
                <p className="min-w-0 flex-1 text-sm leading-relaxed text-amber-900">
                  <b>Ada {unseen.length} balasan baru dari pembuat link</b> untuk kritik &amp; saran dan pesan anonim Anda. Buka detail balasan di bawah untuk membacanya.
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
            <HistorySection
              id="kritik-saran"
              title="Riwayat kritik & saran"
              empty="Belum ada kritik & saran dari identitas ini. Isi kritik & saran lewat linknya — verifikasi Google / WhatsApp OTP di awal — agar tercatat di sini beserta balasannya."
              items={feedbackResponses}
              findInteraction={findInteraction}
              openReplyId={openReplyId}
              seenIds={seenIds}
              onToggleReply={(r, open) => {
                if (!open && r.reply) setSeenIds(markReplySeen(r.id))
                setOpenReplyId(open ? null : r.id)
              }}
            />

            {/* Riwayat pesan anonim + status & detail balasan */}
            <HistorySection
              id="pesan-anonim"
              title="Riwayat pesan anonim"
              empty="Belum ada pesan anonim dari identitas ini. Isi pesan anonim lewat linknya — verifikasi Google / WhatsApp OTP di awal — agar tercatat di sini beserta balasannya. Pemilik link tetap melihat kiriman Anda sebagai “Anonim”."
              items={anonResponses}
              findInteraction={findInteraction}
              openReplyId={openReplyId}
              seenIds={seenIds}
              onToggleReply={(r, open) => {
                if (!open && r.reply) setSeenIds(markReplySeen(r.id))
                setOpenReplyId(open ? null : r.id)
              }}
            />

            <p className="text-center text-xs text-mute">
              Riwayat dihitung dari perangkat &amp; browser ini saja (data tersimpan lokal). Setiap kiriman tercatat
              karena Anda verifikasi dengan Google / WhatsApp OTP di awal sebelum mengisi link.
              {' '}<a href="#/" className="font-semibold text-brand hover:underline">← Kembali ke beranda</a>
            </p>
          </>
        )}
      </main>
    </div>
  )
}

/** Satu daftar riwayat masukan (kritik & saran, atau pesan anonim):
    status, lencana balasan baru, dan detail balasan pemilik link. */
function HistorySection({ id, title, empty, items, findInteraction, openReplyId, seenIds, onToggleReply }: {
  id: string
  title: string
  empty: string
  items: Response[]
  findInteraction: (iid: string) => Interaction | undefined
  openReplyId: string | null
  seenIds: string[]
  onToggleReply: (r: Response, open: boolean) => void
}) {
  return (
    <section className="space-y-3" id={id}>
      <h2 className="font-display text-xl font-bold">{title}</h2>
      {items.length === 0 ? (
        <Card className="p-6 text-center text-sm text-mute">{empty}</Card>
      ) : (
        <div className="space-y-3">
          {items.map((r) => {
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
                    onClick={() => onToggleReply(r, open)}
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
