import { useMemo, useState } from 'react'
import { criteriaFor, recommendOption, summarizeCriteria, type HelperAnswer } from '../services/voteHelper'
import { Btn } from '../components/ui'

/**
 * Modal "Bantuan memilih voting yang tepat": pengunjung menjawab pertanyaan
 * kriteria, melihat hasil rekomendasi, lalu memilih "Gunakan rekomendasi"
 * (pilihan langsung terisi) atau "Pilih manual" (kembali ke daftar pilihan
 * voting tanpa mengubah apa pun).
 *
 * Label "AI segera hadir": mesin rekomendasi saat ini masih lokal
 * (lihat voteHelper.ts) — AI akan menggantikannya nanti.
 */
export default function VoteHelper({
  questionTitle,
  options,
  counts,
  totalVotes,
  onUse,
  onClose,
}: {
  questionTitle: string
  /** Pilihan aktif saja. */
  options: string[]
  /** Jumlah suara per label pilihan. */
  counts: Record<string, number>
  totalVotes: number
  onUse: (label: string) => void
  onClose: () => void
}) {
  const criteria = useMemo(() => criteriaFor(questionTitle), [questionTitle])
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, HelperAnswer>>({})
  const [done, setDone] = useState(false)

  const rec = useMemo(
    () => (done ? recommendOption(options, counts, totalVotes) : null),
    [done, options, counts, totalVotes],
  )
  const summary = useMemo(
    () => (done ? summarizeCriteria(Object.values(answers)) : []),
    [done, answers],
  )

  const pick = (label: string, tags: string[]) => {
    const c = criteria[idx]
    setAnswers((p) => ({ ...p, [c.id]: { criterionId: c.id, question: c.question, answer: label, tags } }))
    if (idx < criteria.length - 1) setIdx(idx + 1)
    else setDone(true)
  }

  const restart = () => {
    setAnswers({})
    setIdx(0)
    setDone(false)
  }

  const criterion = criteria[idx]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Bantuan memilih voting yang tepat" onClick={onClose}>
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold leading-snug">✨ Bantuan memilih voting yang tepat</h2>
            <p className="mt-1 text-sm text-mute">Membantu Anda memilih untuk: <b className="text-ink">{questionTitle}</b></p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup bantuan" className="shrink-0 rounded-full border border-line px-2.5 py-1 text-sm text-mute hover:bg-ground">✕</button>
        </div>
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
          <b>Rekomendasi AI segera hadir.</b> Untuk saat ini rekomendasi dihitung dari kriteria yang Anda jawab dan suara yang sudah masuk.
        </p>

        {!done ? (
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-mute">
              Pertanyaan {idx + 1} dari {criteria.length} — berdasarkan kriteria Anda
            </p>
            <div className="h-1.5 overflow-hidden rounded-full bg-ground">
              <div className="h-full rounded-full bg-vote transition-all" style={{ width: `${((idx + 1) / criteria.length) * 100}%` }} />
            </div>
            <h3 className="font-display text-lg font-bold leading-snug">{criterion.question}</h3>
            <div className="space-y-2">
              {criterion.options.map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => pick(o.label, o.tags)}
                  className="w-full rounded-xl border border-line px-4 py-3 text-left text-sm font-medium transition-colors hover:border-vote hover:bg-vote-soft"
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className="flex justify-between">
              {idx > 0 ? (
                <Btn type="button" variant="ghost" className="px-3 py-2 text-xs" onClick={() => setIdx(idx - 1)}>← Kembali</Btn>
              ) : (
                <span />
              )}
              <Btn type="button" variant="ghost" className="px-3 py-2 text-xs" onClick={onClose}>Tutup, saya pilih sendiri</Btn>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-mute">Hasil rekomendasi</p>
              {summary.length > 0 && (
                <p className="mt-1 text-sm text-mute">
                  Berdasarkan kriteria Anda, Anda mengutamakan: <b className="text-ink">{summary.join(', ')}</b>.
                </p>
              )}
            </div>
            {rec ? (
              <div className="rounded-xl border-2 border-vote bg-vote-soft p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-vote">Rekomendasi untuk Anda</p>
                <p className="mt-1 font-display text-2xl font-extrabold">{rec.label}</p>
                <p className="mt-1 text-sm text-mute">{rec.basis}</p>
              </div>
            ) : (
              <p className="rounded-xl bg-ground p-4 text-sm text-mute">Tidak ada pilihan aktif untuk pertanyaan ini.</p>
            )}
            <div className="space-y-2">
              <Btn type="button" className="w-full bg-vote py-2.5 hover:opacity-90" disabled={!rec} onClick={() => rec && onUse(rec.label)}>
                ✓ Gunakan rekomendasi
              </Btn>
              <Btn type="button" variant="ghost" className="w-full py-2.5" onClick={onClose}>
                Pilih manual — kembali ke pilihan voting
              </Btn>
            </div>
            <button type="button" className="mx-auto block text-xs font-semibold text-brand hover:underline" onClick={restart}>
              Ulangi pertanyaan kriteria dari awal
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
