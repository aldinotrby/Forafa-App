import { useMemo, useState, type ReactNode } from 'react'
import type { Kind, Response, Status } from './store'

export const KIND = {
  vote: { label: 'Voting', long: 'Voting / Pemilihan', text: 'text-vote', bg: 'bg-vote', soft: 'bg-vote-soft', ring: 'border-vote/30', icon: '◧' },
  feedback: { label: 'Kritik & Saran', long: 'Kritik & Saran', text: 'text-fb', bg: 'bg-fb', soft: 'bg-fb-soft', ring: 'border-fb/30', icon: '✎' },
  anon: { label: 'Pesan Anonim', long: 'Pesan Anonymous', text: 'text-anon', bg: 'bg-anon', soft: 'bg-anon-soft', ring: 'border-anon/30', icon: '◌' },
} satisfies Record<Kind, Record<string, string>>

export const STATUSES: Status[] = ['Baru', 'Dibaca', 'Diproses', 'Selesai']
const STATUS_STYLE: Record<Status, string> = {
  Baru: 'bg-red-100 text-red-700',
  Dibaca: 'bg-sky-100 text-sky-700',
  Diproses: 'bg-amber-100 text-amber-800',
  Selesai: 'bg-emerald-100 text-emerald-700',
}

export const publicUrl = (slug: string) => `${location.origin}${location.pathname}#/p/${slug}`
export const fmtDate = (iso: string) => new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <rect width="40" height="40" rx="11" fill="#0f766e" />
      <path d="M12 30V12h14M12 21h10" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="29" cy="28" r="3.2" fill="#7ee0cf" />
    </svg>
  )
}

export function Btn({ variant = 'primary', className = '', ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const v = {
    primary: 'bg-brand text-white hover:bg-[#0b5f58]',
    ghost: 'bg-white text-ink border border-line hover:bg-brand-soft',
    danger: 'bg-white text-red-700 border border-red-200 hover:bg-red-50',
  }[variant]
  return <button {...p} className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${v} ${className}`} />
}

export const inputCls = 'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm placeholder:text-mute/70 focus:border-brand focus:outline-none'

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-mute">{label}</span>
      {children}
      {hint && <span className="block text-xs text-mute">{hint}</span>}
    </label>
  )
}

export function StatusPill({ s }: { s: Status }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[s]}`}>{s}</span>
}

export function KindBadge({ k }: { k: Kind }) {
  const m = KIND[k]
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${m.soft} ${m.text}`}>{m.icon} {m.label}</span>
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-white ${className}`}>{children}</div>
}

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export function QR({ value, size = 168 }: { value: string; size?: number }) {
  const n = 25
  const cells = useMemo(() => {
    let seed = hash(value)
    const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32)
    const inFinder = (x: number, y: number) => (x < 8 && y < 8) || (x >= n - 8 && y < 8) || (x < 8 && y >= n - 8)
    const out: [number, number][] = []
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!inFinder(x, y) && rnd() > 0.52) out.push([x, y])
    return out
  }, [value])
  const finder = (x: number, y: number) => (
    <g key={`${x}${y}`} transform={`translate(${x} ${y})`}>
      <rect width="7" height="7" fill="#0d2b2e" />
      <rect x="1" y="1" width="5" height="5" fill="#fff" />
      <rect x="2" y="2" width="3" height="3" fill="#0d2b2e" />
    </g>
  )
  return (
    <svg width={size} height={size} viewBox={`-1 -1 ${n + 2} ${n + 2}`} className="rounded-lg bg-white" role="img" aria-label="QR Code public link">
      <rect x="-1" y="-1" width={n + 2} height={n + 2} fill="#fff" />
      {cells.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#0d2b2e" />)}
      {finder(0, 0)}{finder(n - 7, 0)}{finder(0, n - 7)}
    </svg>
  )
}

export function exportCsv(name: string, rows: Response[]) {
  const esc = (v?: string) => `"${(v ?? '').replace(/"/g, '""')}"`
  const csv = ['waktu,nama,pilihan,pesan,status,balasan', ...rows.map((r) => [r.at, r.name, r.choice, r.message, r.status, r.reply].map(esc).join(','))].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = `${name}.csv`
  a.click()
}

export function Paginated<T>({ items, perPage = 6, render }: { items: T[]; perPage?: number; render: (x: T) => ReactNode }) {
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(items.length / perPage))
  const cur = Math.min(page, pages - 1)
  return (
    <div>
      <div className="divide-y divide-line">{items.slice(cur * perPage, cur * perPage + perPage).map(render)}</div>
      {items.length === 0 && <p className="py-10 text-center text-sm text-mute">Belum ada data yang cocok.</p>}
      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-line pt-3 text-sm text-mute">
          <span>Halaman {cur + 1} dari {pages}</span>
          <div className="flex gap-2">
            <Btn variant="ghost" disabled={cur === 0} onClick={() => setPage(cur - 1)}>Sebelumnya</Btn>
            <Btn variant="ghost" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Berikutnya</Btn>
          </div>
        </div>
      )}
    </div>
  )
}

export function Bar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total ? Math.round((value / total) * 100) : 0
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm"><span className="font-medium">{label}</span><span className="tabular-nums text-mute">{value} suara · {pct}%</span></div>
      <div className="h-2.5 overflow-hidden rounded-full bg-ground"><div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} /></div>
    </div>
  )
}
