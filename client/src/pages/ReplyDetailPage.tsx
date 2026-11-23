import { useEffect, useState } from 'react'
import { useStore, type Kind, type Response } from '../services/store'
import { fetchMyResponses, mergeHistories, type ServerResponseItem } from '../services/myResponses'
import { markReplySeen } from '../services/replyNotifications'
import { Card, KindBadge, Logo, StatusPill, fmtDate } from '../components/ui'

/**
 * Halaman khusus balasan (`#/balasan/:id`): menampilkan satu kiriman
 * beserta balasan pembuat linknya.
 *
 * Halaman ini TIDAK memakai layar login: kiriman dicari dulu di data
 * lokal perangkat ini (tersimpan di localStorage, tetap ada walau sesi
 * sudah berakhir), lalu — bila ada token akun (`fa_token`) — digabung
 * dengan kiriman dari server (`GET /responses/mine`). Jadi pengisi yang
 * mengeklik "Lihat balasan" dari notifikasi langsung masuk ke halaman
 * ini tanpa diminta login lagi. Bila kiriman hanya ada di server dan
 * tidak ada sesi login, halaman menampilkan penjelasan dan tautan ke
 * Riwayat Saya (di sanalah login dilakukan bila memang diperlukan).
 *
 * Membuka halaman ini menandai balasan itu sudah dibaca, sama seperti
 * membuka detail balasan sebelumnya.
 */

interface ResolvedLink {
  title: string
  slug: string
  kind: Kind
  active?: boolean
}

function resolveLink(r: Response, interactions: ReturnType<typeof useStore>['interactions']): ResolvedLink | undefined {
  const local = interactions.find((i) => i.id === r.iid)
  if (local) return { title: local.title, slug: local.slug, kind: local.kind, active: local.active }
  if (r.fromServer) {
    return {
      title: r.interactionTitle ?? 'Link dihapus',
      slug: r.interactionSlug ?? '',
      kind: r.interactionKind ?? (r.choice ? 'vote' : 'feedback'),
      active: undefined,
    }
  }
  return undefined
}

export default function ReplyDetailPage({ responseId }: { responseId: string }) {
  const { interactions, responses } = useStore()
  const [serverResponses, setServerResponses] = useState<ServerResponseItem[] | null>(null)
  const [serverDone, setServerDone] = useState(false)

  // Muat kiriman server bila ada sesi akun; tanpa token, langsung
  // tampilkan dari data lokal saja.
  useEffect(() => {
    let cancelled = false
    let hasToken = false
    try {
      hasToken = Boolean(sessionStorage.getItem('fa_token'))
    } catch {
      hasToken = false
    }
    if (!hasToken) {
      setServerDone(true)
      return
    }
    void fetchMyResponses().then((rows) => {
      if (cancelled) return
      setServerResponses(rows)
      setServerDone(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const merged = serverResponses ? mergeHistories(responses, serverResponses) : [...responses]
  const found = merged.find((r) => r.id === responseId) ?? null
  const link = found ? resolveLink(found, interactions) : undefined
  const foundId = found?.id ?? null
  const hasReply = Boolean(found?.reply)

  // Membuka halaman ini menandai balasan sudah dibaca.
  useEffect(() => {
    if (foundId && hasReply) markReplySeen(foundId)
  }, [foundId, hasReply])

  return (
    <div className="min-h-screen bg-ground">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-5 py-3">
          <Logo size={28} /><b className="font-display">Forafa-App</b>
          <span className="ml-auto rounded-full bg-ground px-3 py-1 text-xs text-mute">Pengisi link</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-5 py-10">
        {!serverDone ? (
          <Card className="p-6 text-center text-sm text-mute">Memuat balasan…</Card>
        ) : !found ? (
          <Card className="space-y-3 p-6 text-center">
            <h1 className="font-display text-2xl font-extrabold">Balasan tidak ditemukan</h1>
            <p className="text-sm leading-relaxed text-mute">
              Kiriman ini tidak ada di perangkat &amp; browser ini. Bila balasan itu tersimpan di server
              (kiriman dibuat saat masuk dengan akun Forafa), buka Riwayat Saya dan masuk dengan akun
              Anda supaya riwayat server dimuat.
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-2 text-sm">
              <a href="#/riwayat" className="font-semibold text-brand hover:underline">Buka Riwayat Saya →</a>
              <a href="#/" className="font-semibold text-brand hover:underline">← Kembali ke beranda</a>
            </div>
          </Card>
        ) : (
          <>
            <header>
              <p className="text-xs font-bold uppercase tracking-widest text-brand">Balasan dari pembuat link</p>
              <h1 className="font-display text-3xl font-extrabold tracking-tight">{link?.title ?? 'Link dihapus'}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                {link && <KindBadge k={link.kind} />}
                <StatusPill s={found.status} />
                {found.fromServer && (
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-700">Server</span>
                )}
                <time className="text-xs text-mute">Dikirim {fmtDate(found.at)}</time>
              </div>
            </header>

            <Card className="space-y-3 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-mute">Kiriman Anda</p>
              {found.message ? (
                <p className="whitespace-pre-wrap leading-relaxed">{found.message}</p>
              ) : (
                <p className="leading-relaxed">
                  <b>{found.choice ?? '—'}</b>
                </p>
              )}
              <p className="text-sm text-mute">
                {found.anonymous || link?.kind === 'anon' ? '◌ Dikirim sebagai Anonymous' : `👤 ${found.name ?? 'Tanpa nama'}`}
              </p>
            </Card>

            <Card className="space-y-3 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-mute">Balasan pembuat link</p>
              {found.reply ? (
                <p className="whitespace-pre-wrap rounded-lg bg-white p-3 leading-relaxed">{found.reply}</p>
              ) : (
                <p className="text-sm text-mute">Belum ada balasan. Pembuat link akan membalas setelah membaca kiriman Anda.</p>
              )}
              <p className="text-sm font-semibold text-emerald-700">
                {found.reply ? '✓ Sudah dibalas pembuat link' : '○ Belum ada balasan'}
              </p>
            </Card>

            <div className="flex flex-wrap items-center gap-4 text-sm">
              {link?.slug ? (
                <a href={`#/p/${link.slug}`} className="font-semibold text-brand hover:underline">Buka link ↗</a>
              ) : null}
              <a href="#/riwayat" className="font-semibold text-brand hover:underline">← Kembali ke Riwayat Saya</a>
            </div>
            <p className="text-center text-xs text-mute">
              Balasan ini sudah ditandai dibaca saat halaman dibuka.
            </p>
          </>
        )}
      </main>
    </div>
  )
}
