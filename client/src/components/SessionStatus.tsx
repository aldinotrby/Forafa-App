import { useStore } from '../services/store'
import { fmtDate } from './ui'

/**
 * Status login & kondisi sesi pengguna.
 *
 * - variant="panel": rincian lengkap untuk sidebar workspace/admin —
 *   identitas, status login, cara login, waktu login, aktivitas terakhir,
 *   waktu tab dibuka, dan info sesi yang dipulihkan setelah tab ditutup.
 * - variant="pill": ringkas untuk header halaman — titik presence + status.
 */

const PROVIDER_LABEL = { password: 'Password', google: 'Google' } as const

export function SessionStatus({ variant = 'panel', dark = false }: { variant?: 'panel' | 'pill'; dark?: boolean }) {
  const { user, session, presence, loginStatus } = useStore()

  if (!user || loginStatus === 'keluar') {
    return (
      <div className={`flex items-center gap-2 text-sm ${dark ? 'text-white/60' : 'text-mute'}`} role="status">
        <span className="size-2.5 shrink-0 rounded-full bg-red-400" aria-hidden />
        <span>Status login: <b className={dark ? 'text-white' : 'text-ink'}>Belum masuk</b></span>
      </div>
    )
  }

  const online = presence === 'online'
  const dot = online ? 'bg-emerald-500' : 'bg-amber-400'
  const presenceLabel = online ? 'Online — tab aktif' : 'Tab tidak aktif'

  if (variant === 'pill') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink" role="status" title={session ? `Login sejak ${fmtDate(session.loginAt)}` : undefined}>
        <span className={`size-2 shrink-0 rounded-full ${dot}`} aria-hidden />
        {presenceLabel} · {user.username}
        {session && <span className="font-normal text-mute">via {PROVIDER_LABEL[session.provider]}</span>}
      </span>
    )
  }

  const rows: [string, string][] = [
    ['Status login', `Masuk sebagai ${user.role}`],
    ['Kondisi akun', presenceLabel],
    ...(session
      ? ([
          ['Cara login', PROVIDER_LABEL[session.provider]],
          ['Login sejak', fmtDate(session.loginAt)],
          ['Terakhir aktif', fmtDate(session.lastSeenAt)],
          ['Tab ini dibuka', fmtDate(session.tabOpenedAt)],
        ] as [string, string][])
      : []),
  ]

  return (
    <div className={`space-y-3 rounded-xl p-3 text-sm ${dark ? 'bg-white/10 text-white' : 'bg-ground'}`} role="status" aria-label="Status login pengguna">
      <div className="flex items-center gap-2.5">
        {user.avatar ? (
          <img src={user.avatar} alt="" className="size-9 shrink-0 rounded-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-full font-bold ${dark ? 'bg-white/15 text-white' : 'bg-brand-soft text-brand'}`}>
            {user.username[0].toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold">{user.username}</p>
          <p className={`truncate text-xs ${dark ? 'text-white/50' : 'text-mute'}`}>{user.email}</p>
        </div>
        <span className={`ml-auto flex shrink-0 items-center gap-1.5 text-xs font-semibold ${online ? 'text-emerald-500' : 'text-amber-500'}`}>
          <span className={`size-2 rounded-full ${dot}`} aria-hidden />
          {online ? 'Online' : 'Tidak aktif'}
        </span>
      </div>

      <dl className={`space-y-1 border-t pt-2.5 text-xs ${dark ? 'border-white/10' : 'border-line'}`}>
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <dt className={dark ? 'text-white/50' : 'text-mute'}>{label}</dt>
            <dd className="text-right font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      {session?.restored && (
        <p className={`rounded-lg px-2.5 py-2 text-xs leading-relaxed ${dark ? 'bg-white/10 text-white/70' : 'bg-brand-soft text-brand'}`}>
          Sesi dipulihkan — Anda masih login dari kunjungan sebelumnya.
          {session.lastTabClosedAt ? <> Tab sebelumnya ditutup {fmtDate(session.lastTabClosedAt)}.</> : null}
        </p>
      )}
    </div>
  )
}
