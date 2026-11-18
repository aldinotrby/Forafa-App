import { useState } from 'react'
import { useStore, type Interaction, type VoteQuestion } from '../services/store'
import { Btn, Card, Field, KIND, KindBadge, Logo, inputCls } from '../components/ui'

/** Cara pengunjung mengidentifikasi diri saat mengisi form publik. */
type Identity = 'nama' | 'anon'
/** Tahap pengisian: isi form → konfirmasi → terkirim. */
type Phase = 'isi' | 'konfirmasi' | 'terkirim'
/** Tampilan voting multi-pertanyaan: satu pertanyaan per halaman, atau semuanya sekaligus. */
type MultiView = 'page' | 'all'

/** Voting multi-pertanyaan = kind 'vote' yang punya daftar `questions`. */
const isMulti = (it: Interaction | undefined) => !!it && it.kind === 'vote' && (it.questions?.length ?? 0) > 0
/** Pertanyaan yang tampil ke pengunjung: aktif dan punya minimal satu pilihan aktif. */
const flowQuestions = (it: Interaction | undefined): VoteQuestion[] =>
  (it?.questions ?? []).filter((q) => q.active && q.options.some((o) => o.active))
const multiSummary = (qs: VoteQuestion[], answers: Record<string, string>) =>
  qs.map((q) => `${q.title}: ${answers[q.id] ?? '—'}`).join('; ')

function QuestionBlock({ q, num, value, onPick }: { q: VoteQuestion; num: number; value: string; onPick: (label: string) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-mute">
        Pertanyaan {num} — {q.title}
      </legend>
      {q.options.map((o) => (
        <label
          key={o.label}
          className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
            !o.active
              ? 'cursor-not-allowed border-line bg-ground text-mute opacity-70'
              : value === o.label
                ? 'border-vote bg-vote-soft'
                : 'border-line hover:bg-ground'
          }`}
        >
          <input
            type="radio"
            name={`q-${q.id}`}
            className="accent-vote"
            checked={value === o.label}
            disabled={!o.active}
            onChange={() => onPick(o.label)}
            required
          />
          <span className="flex-1">{o.label}</span>
          {!o.active && <span className="rounded-full bg-ground px-2 py-0.5 text-xs font-semibold text-mute">Nonaktif</span>}
          {o.active && value === o.label && <span className="text-xs font-bold text-vote">✓ Dipilih</span>}
        </label>
      ))}
    </fieldset>
  )
}

export default function Public({ slug }: { slug: string }) {
  const { interactions, submit } = useStore()
  const it = interactions.find((i) => i.slug === slug)
  const [name, setName] = useState('')
  const [choice, setChoice] = useState('')
  const [msg, setMsg] = useState('')
  const [topic, setTopic] = useState('')
  const [identity, setIdentity] = useState<Identity>('nama')
  const [phase, setPhase] = useState<Phase>('isi')
  /** Jawaban voting multi-pertanyaan: id pertanyaan → label pilihan. */
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [view, setView] = useState<MultiView>('page')
  const [step, setStep] = useState(0)
  const [warn, setWarn] = useState('')

  const today = new Date().toISOString().slice(0, 10)
  const closed = !!it && (!it.active || (it.start && today < it.start) || (it.end && today > it.end))

  // Interaksi jenis 'anon' selalu anonim — pilihan identitas dikunci.
  const forcedAnon = it?.kind === 'anon'
  const effectiveIdentity: Identity = forcedAnon ? 'anon' : identity
  const isAnon = effectiveIdentity === 'anon'

  const multi = isMulti(it)
  const qs = flowQuestions(it)
  const hiddenCount = (it?.questions?.length ?? 0) - qs.length
  const answeredCount = qs.filter((q) => answers[q.id]).length
  const cur = qs[Math.min(step, Math.max(0, qs.length - 1))]
  const progressPct = qs.length ? Math.round((answeredCount / qs.length) * 100) : 0

  /** Pertanyaan pertama yang belum dijawab (untuk lompat & pesan). */
  const firstUnanswered = () => qs.findIndex((q) => !answers[q.id])

  /** Membuka tahap konfirmasi — jawaban belum dikirim pada tahap ini. */
  const review = (e: React.FormEvent) => {
    e.preventDefault()
    if (!it) return
    if (multi && qs.length === 0) {
      setWarn('Semua pertanyaan di voting ini sedang nonaktif.')
      return
    }
    if (multi) {
      const missing = firstUnanswered()
      if (missing >= 0) {
        setWarn(`Pertanyaan "${qs[missing].title}" belum dijawab.`)
        setStep(missing)
        setView('page')
        return
      }
    }
    setWarn('')
    setPhase('konfirmasi')
  }

  /** Tombol "Periksa & kirim" di halaman terakhir tampilan multi-page. */
  const goReview = () => {
    if (!it) return
    const missing = firstUnanswered()
    if (missing >= 0) {
      setWarn(`Pertanyaan "${qs[missing].title}" belum dijawab.`)
      setStep(missing)
      return
    }
    setWarn('')
    setPhase('konfirmasi')
  }

  const next = () => {
    if (!cur) return
    if (!answers[cur.id]) {
      setWarn(`Pilih dulu jawaban untuk "${cur.title}" sebelum lanjut.`)
      return
    }
    setWarn('')
    setStep((s) => Math.min(s + 1, qs.length - 1))
  }

  /** Mengirim jawaban setelah pengguna menekan "Ya, kirim jawaban" di tahap konfirmasi. */
  const send = () => {
    if (!it) return
    const sender = isAnon ? { anonymous: true as const } : { name: name.trim(), anonymous: false as const }
    if (multi) submit({ iid: it.id, choice: multiSummary(qs, answers), choices: { ...answers }, ...sender })
    else if (it.kind === 'vote') submit({ iid: it.id, choice, ...sender })
    else if (it.kind === 'feedback') submit({ iid: it.id, message: topic ? `[${topic}] ${msg}` : msg, ...sender })
    else submit({ iid: it.id, message: msg, anonymous: true })
    setPhase('terkirim')
  }

  const reset = () => {
    setPhase('isi')
    setName('')
    setChoice('')
    setMsg('')
    setTopic('')
    setIdentity('nama')
    setAnswers({})
    setStep(0)
    setView('page')
    setWarn('')
  }

  const m = it && KIND[it.kind]
  const identityStatus = isAnon
    ? 'Anonymous — nama Anda tidak diminta, tidak disimpan, dan tidak ditampilkan.'
    : `Nama asli — jawaban tampil atas nama "${name.trim() || '…'}" kepada pemilik interaksi.`

  return (
    <div className="min-h-screen bg-ground">
      <header className="border-b border-line bg-white"><div className="mx-auto flex max-w-xl items-center gap-2 px-5 py-3"><Logo size={28} /><b className="font-display">Forafa-App</b><span className="ml-auto rounded-full bg-ground px-3 py-1 text-xs text-mute">Pengunjung · tanpa akun</span></div></header>
      <main className="mx-auto max-w-xl px-5 py-10">
        {!it ? (
          <Card className="p-8 text-center"><h1 className="font-display text-2xl font-bold">Link tidak ditemukan</h1><p className="mt-2 text-mute">Public link ini tidak ada atau sudah dihapus.</p></Card>
        ) : (
          <Card className="overflow-hidden">
            <div className={`h-2 ${m!.bg}`} />
            <div className="space-y-6 p-7">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <KindBadge k={it.kind} />
                  {!closed && phase !== 'terkirim' && (
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${isAnon ? 'bg-anon-soft text-anon' : 'bg-brand-soft text-brand'}`} role="status">
                      {isAnon ? '◌ Identitas: Anonymous' : '👤 Identitas: Nama asli'}
                    </span>
                  )}
                </div>
                <h1 className="font-display text-3xl font-extrabold leading-tight">{it.title}</h1>
                <p className="text-mute">{it.description}</p>
              </div>

              {closed ? (
                <p className="rounded-lg bg-ground p-4 text-sm font-medium text-mute">Interaksi ini sedang tidak aktif atau di luar periode.</p>
              ) : phase === 'terkirim' ? (
                <div className="space-y-3 rounded-xl bg-brand-soft p-6 text-center">
                  <p className="font-display text-xl font-bold text-brand">{it.kind === 'vote' ? 'Suara Anda tercatat' : it.kind === 'anon' ? 'Pesan terkirim secara anonim' : 'Terima kasih atas masukan Anda'}</p>
                  <p className="text-sm text-brand/80" role="status">
                    {isAnon ? 'Terkirim sebagai Anonymous — identitas Anda tidak tercatat.' : `Terkirim atas nama ${name.trim()}.`}
                  </p>
                  {multi && (
                    <dl className="space-y-1.5 rounded-xl bg-white/70 p-4 text-left text-sm">
                      {qs.map((q) => (
                        <div key={q.id} className="flex justify-between gap-4">
                          <dt className="text-mute">{q.title}</dt>
                          <dd className="font-semibold">{answers[q.id]}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  <Btn variant="ghost" onClick={reset}>Kirim lagi</Btn>
                </div>
              ) : phase === 'konfirmasi' ? (
                <div className="space-y-5">
                  <div>
                    <h2 className="font-display text-xl font-bold">Konfirmasi sebelum mengirim</h2>
                    <p className="mt-1 text-sm text-mute">Periksa kembali jawaban Anda. Jawaban baru terkirim setelah Anda menekan tombol konfirmasi di bawah.</p>
                  </div>
                  <dl className="space-y-3 rounded-xl border border-line bg-ground/60 p-4 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="shrink-0 font-semibold text-mute">Identitas</dt>
                      <dd className="text-right font-semibold">{isAnon ? '◌ Anonymous' : `👤 Nama asli — ${name.trim()}`}</dd>
                    </div>
                    {multi ? (
                      qs.map((q) => (
                        <div key={q.id} className="flex justify-between gap-4">
                          <dt className="shrink-0 font-semibold text-mute">{q.title}</dt>
                          <dd className="text-right font-semibold text-vote">{answers[q.id]}</dd>
                        </div>
                      ))
                    ) : it.kind === 'vote' ? (
                      <div className="flex justify-between gap-4">
                        <dt className="shrink-0 font-semibold text-mute">Pilihan Anda</dt>
                        <dd className="text-right font-semibold text-vote">{choice}</dd>
                      </div>
                    ) : null}
                    {it.kind === 'feedback' && (
                      <div className="flex justify-between gap-4">
                        <dt className="shrink-0 font-semibold text-mute">Topik</dt>
                        <dd className="text-right font-semibold">{topic || 'Umum'}</dd>
                      </div>
                    )}
                    {it.kind !== 'vote' && (
                      <div>
                        <dt className="font-semibold text-mute">Pesan Anda</dt>
                        <dd className="mt-1 whitespace-pre-wrap rounded-lg bg-white p-3 leading-relaxed">{msg}</dd>
                      </div>
                    )}
                  </dl>
                  <p className={`rounded-lg px-3 py-2 text-xs leading-relaxed ${isAnon ? 'bg-anon-soft text-anon' : 'bg-brand-soft text-brand'}`} role="status">
                    Status identitas: {identityStatus}
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Btn variant="ghost" className="flex-1 py-2.5" onClick={() => setPhase('isi')}>← Kembali, periksa lagi</Btn>
                    <Btn className={`flex-1 py-2.5 ${m!.bg} hover:opacity-90`} onClick={send}>Ya, kirim jawaban</Btn>
                  </div>
                </div>
              ) : (
                <form onSubmit={review} className="space-y-4">
                  <div className="space-y-2 rounded-xl border border-line bg-ground/60 p-4 text-sm leading-relaxed">
                    <p className="font-display font-bold">🔒 Keterangan privasi — baca sebelum mengisi</p>
                    <ul className="list-disc space-y-1 pl-5 text-mute">
                      <li><b className="text-ink">Tampilkan nama:</b> nama yang Anda tulis tampil bersama jawaban Anda kepada pemilik interaksi ini.</li>
                      <li><b className="text-ink">Isi sebagai Anonymous:</b> nama tidak diminta dan tidak disimpan; jawaban Anda tercatat sebagai “Anonim” dan pemilik interaksi tidak dapat mengetahui siapa Anda.</li>
                      <li>Jawaban hanya digunakan untuk keperluan interaksi ini. Untuk mode Anonymous, identitas, IP, dan perangkat Anda juga tidak ditampilkan kepada pemilik link.</li>
                    </ul>
                    {forcedAnon && <p className="font-medium text-anon">Interaksi ini adalah Pesan Anonim — identitas selalu Anonymous dan tidak dapat diubah.</p>}
                  </div>

                  {!forcedAnon && (
                    <fieldset className="space-y-2">
                      <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-mute">Pilih identitas Anda</legend>
                      <label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${!isAnon ? 'border-brand bg-brand-soft' : 'border-line hover:bg-ground'}`}>
                        <input type="radio" name="identity" className="mt-0.5 accent-brand" checked={!isAnon} onChange={() => setIdentity('nama')} />
                        <span>
                          <span className="block text-sm font-semibold">👤 Tampilkan nama</span>
                          <span className="block text-xs text-mute">Jawaban tampil atas nama asli Anda kepada pemilik interaksi.</span>
                        </span>
                      </label>
                      <label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${isAnon ? 'border-anon bg-anon-soft' : 'border-line hover:bg-ground'}`}>
                        <input type="radio" name="identity" className="mt-0.5 accent-anon" checked={isAnon} onChange={() => setIdentity('anon')} />
                        <span>
                          <span className="block text-sm font-semibold">◌ Isi sebagai Anonymous</span>
                          <span className="block text-xs text-mute">Tanpa nama — jawaban tercatat sebagai “Anonim”.</span>
                        </span>
                      </label>
                    </fieldset>
                  )}

                  <p className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${isAnon ? 'bg-anon-soft text-anon' : 'bg-brand-soft text-brand'}`} role="status" aria-live="polite">
                    <span className={`size-2 shrink-0 rounded-full ${isAnon ? 'bg-anon' : 'bg-brand'}`} aria-hidden />
                    Status identitas: {identityStatus}
                  </p>

                  {!isAnon && <Field label="Nama"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required placeholder="Nama Anda" /></Field>}
                  {multi ? (
                    <div className="space-y-4">
                      {/* Progres pengisian */}
                      <div className="space-y-2" aria-live="polite">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold">Pertanyaan {view === 'page' ? `${step + 1} dari ${qs.length}` : `1–${qs.length} dari ${qs.length}`}</span>
                          <span className="tabular-nums text-mute">{answeredCount} dari {qs.length} terisi · {progressPct}%</span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-ground" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
                          <div className="h-full rounded-full bg-vote transition-all duration-300" style={{ width: `${progressPct}%` }} />
                        </div>
                        {hiddenCount > 0 && <p className="text-xs text-mute">{hiddenCount} pertanyaan sedang nonaktif dan disembunyikan.</p>}
                      </div>

                      {/* Pilihan tampilan: multi-page atau single-page */}
                      <div className="flex gap-2" role="group" aria-label="Tampilan voting">
                        <Btn type="button" variant={view === 'page' ? 'primary' : 'ghost'} className="flex-1 py-2" onClick={() => setView('page')}>▦ Satu per halaman</Btn>
                        <Btn type="button" variant={view === 'all' ? 'primary' : 'ghost'} className="flex-1 py-2" onClick={() => setView('all')}>☰ Semua sekaligus</Btn>
                      </div>

                      {/* Navigasi antarpertanyaan */}
                      <nav className="flex flex-wrap gap-2" aria-label="Navigasi pertanyaan">
                        {qs.map((q, i) => (
                          <button
                            key={q.id}
                            type="button"
                            onClick={() => { setStep(i); setWarn('') }}
                            aria-current={view === 'page' && step === i}
                            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                              view === 'page' && step === i
                                ? 'border-vote bg-vote text-white'
                                : answers[q.id]
                                  ? 'border-vote/40 bg-vote-soft text-vote'
                                  : 'border-line bg-white text-mute hover:bg-ground'
                            }`}
                          >
                            {answers[q.id] ? '✓ ' : ''}{i + 1}. {q.title}
                          </button>
                        ))}
                      </nav>

                      {warn && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700" role="alert">{warn}</p>}

                      {view === 'page' && cur ? (
                        <div className="space-y-4">
                          <QuestionBlock q={cur} num={step + 1} value={answers[cur.id] ?? ''} onPick={(label) => { setAnswers((p) => ({ ...p, [cur.id]: label })); setWarn('') }} />
                          <div className="flex gap-2">
                            <Btn type="button" variant="ghost" className="flex-1 py-2.5" disabled={step === 0} onClick={() => { setStep((s) => Math.max(0, s - 1)); setWarn('') }}>← Sebelumnya</Btn>
                            {step < qs.length - 1 ? (
                              <Btn type="button" className={`flex-1 py-2.5 ${m!.bg} hover:opacity-90`} onClick={next}>Lanjut →</Btn>
                            ) : (
                              <Btn type="button" className={`flex-1 py-2.5 ${m!.bg} hover:opacity-90`} onClick={goReview}>Periksa &amp; kirim</Btn>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-5">
                          {qs.map((q, i) => (
                            <QuestionBlock key={q.id} q={q} num={i + 1} value={answers[q.id] ?? ''} onPick={(label) => { setAnswers((p) => ({ ...p, [q.id]: label })); setWarn('') }} />
                          ))}
                        </div>
                      )}
                    </div>
                  ) : it.kind === 'vote' ? (
                    <fieldset className="space-y-2">
                      <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-mute">Pilih salah satu</legend>
                      {it.options.map((o) => (
                        <label key={o} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${choice === o ? 'border-vote bg-vote-soft' : 'border-line hover:bg-ground'}`}>
                          <input type="radio" name="opt" className="accent-vote" checked={choice === o} onChange={() => setChoice(o)} required />{o}
                        </label>
                      ))}
                    </fieldset>
                  ) : null}
                  {it.kind === 'feedback' && it.options.length > 0 && (
                    <Field label="Topik"><select className={inputCls} value={topic} onChange={(e) => setTopic(e.target.value)}><option value="">Umum</option>{it.options.map((o) => <option key={o}>{o}</option>)}</select></Field>
                  )}
                  {it.kind !== 'vote' && <Field label={it.kind === 'anon' ? 'Tulis pesan' : 'Kritik / saran'} hint={isAnon ? 'Anda mengisi sebagai Anonymous — nama Anda tidak dicatat.' : undefined}><textarea className={inputCls} rows={5} value={msg} onChange={(e) => setMsg(e.target.value)} required /></Field>}
                  {(!multi || view === 'all' || qs.length === 0) && (
                    <Btn className={`w-full py-2.5 ${m!.bg} hover:opacity-90`}>{it.kind === 'vote' ? 'Periksa & kirim vote' : 'Periksa & kirim'}</Btn>
                  )}
                  <p className="text-center text-xs text-mute">Anda akan diminta konfirmasi sebelum jawaban benar-benar terkirim.</p>
                </form>
              )}
            </div>
          </Card>
        )}
        <p className="mt-6 text-center text-xs text-mute"><a href="#/" className="font-semibold text-brand hover:underline">Buat interaksi Anda sendiri di Forafa-App</a></p>
      </main>
    </div>
  )
}
