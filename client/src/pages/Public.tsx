import { useEffect, useRef, useState } from 'react'
import { useStore, type Interaction, type Response, type VoteQuestion } from '../services/store'
import { initGoogleSignIn, isGoogleConfigured } from '../services/googleAuth'
import {
  clearVoter,
  loadVoter,
  maskPhone,
  requestOtp,
  saveVoter,
  validatePhone,
  verifyOtp,
  type VerifiedVoter,
} from '../services/otpService'
import { Btn, Card, Field, KIND, KindBadge, Logo, fmtDate, inputCls } from '../components/ui'

/** Cara pengunjung mengidentifikasi diri saat mengisi form publik. */
type Identity = 'nama' | 'anon'
/** Tahap pengisian: verifikasi → isi form → konfirmasi → terkirim (atau sudah: sudah pernah voting). */
type Phase = 'verifikasi' | 'isi' | 'konfirmasi' | 'terkirim' | 'sudah'
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
 * Gerbang verifikasi sebelum voting: 1 akun Google / 1 nomor WhatsApp = 1 suara.
 * Berlaku untuk semua voting (satu maupun multi-pertanyaan). Feedback & pesan
 * anonim tidak melewati gerbang ini.
 */
function VerificationGate({ slug, onVerified, onAlreadyVoted }: {
  slug: string
  onVerified: (v: VerifiedVoter) => void
  onAlreadyVoted: (message: string) => void
}) {
  const [method, setMethod] = useState<'whatsapp' | 'google'>('whatsapp')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [otpStep, setOtpStep] = useState<'phone' | 'code'>('phone')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [devOtp, setDevOtp] = useState<string | null>(null)
  const [demoMode, setDemoMode] = useState(false)
  const [expiresAt, setExpiresAt] = useState(0)
  const [resendAt, setResendAt] = useState(0)
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const googleBtnRef = useRef<HTMLDivElement>(null)
  const googleConfigured = isGoogleConfigured()

  // Hitung mundur masa berlaku kode OTP.
  useEffect(() => {
    if (otpStep !== 'code' || !expiresAt) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [otpStep, expiresAt])

  // Tombol resmi Google dirender oleh Google Identity Services ke div ini.
  useEffect(() => {
    if (method !== 'google' || !googleConfigured) return
    let cleanup: (() => void) | undefined
    let cancelled = false
    initGoogleSignIn(({ profile, error: err }) => {
      if (err) setError(err)
      else if (profile) {
        onVerified({
          method: 'google',
          key: `google:${profile.googleId}`,
          label: profile.email,
          verifiedAt: new Date().toISOString(),
          slug,
        })
      }
    }, googleBtnRef.current)
      .then((fn) => {
        if (cancelled) fn()
        else cleanup = fn
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Login Google gagal dimuat.'))
    return () => {
      cancelled = true
      cleanup?.()
    }
    // onVerified stabil dari parent (setState + setPhase); sengaja tidak dimasukkan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, googleConfigured, slug])

  const remainingSeconds = Math.max(0, Math.floor((expiresAt - now) / 1000))
  const mmss = `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, '0')}`
  const canResend = now >= resendAt

  const sendOtp = async () => {
    const check = validatePhone(phone)
    if (!check.phone) {
      setError(check.error ?? 'Nomor WhatsApp tidak valid.')
      return
    }
    setSending(true)
    setError(null)
    setInfo(null)
    const res = await requestOtp(slug, check.phone)
    setSending(false)
    if (!res.ok) {
      if (res.alreadyVoted) {
        onAlreadyVoted(res.error ?? 'Nomor WhatsApp ini sudah pernah digunakan untuk mengisi voting ini. Setiap nomor hanya dapat mengisi satu kali.')
        return
      }
      // Notifikasi gagal verifikasi: pesan backend ditampilkan apa adanya.
      setError(res.error ?? 'Gagal mengirim kode OTP.')
      return
    }
    setOtpStep('code')
    setCode('')
    setExpiresAt(Date.now() + (res.expiresInSeconds ?? 300) * 1000)
    setResendAt(Date.now() + 60_000)
    setRemainingAttempts(null)
    setDevOtp(res.devOtp ?? null)
    setDemoMode(!!res.demo)
    setInfo(`Kode OTP dikirim ke ${maskPhone(check.phone)}. Kode berlaku 5 menit.`)
  }

  const verify = async () => {
    const check = validatePhone(phone)
    if (!check.phone) {
      setError(check.error ?? 'Nomor WhatsApp tidak valid.')
      return
    }
    if (code.replace(/[^0-9]/g, '').length !== 6) {
      setError('Masukkan 6 angka kode OTP yang Anda terima.')
      return
    }
    setVerifying(true)
    setError(null)
    const res = await verifyOtp(slug, check.phone, code)
    setVerifying(false)
    if (!res.ok) {
      setRemainingAttempts(res.remainingAttempts ?? null)
      setError(res.error ?? 'Verifikasi OTP gagal.')
      return
    }
    onVerified({
      method: 'whatsapp',
      key: `wa:${check.phone}`,
      label: maskPhone(check.phone),
      token: res.verificationToken,
      verifiedAt: new Date().toISOString(),
      slug,
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-bold">Verifikasi sebelum voting</h2>
        <p className="mt-1 text-sm text-mute">
          Satu akun Google atau satu nomor WhatsApp hanya dapat mengisi satu kali. Pilih cara verifikasi Anda.
        </p>
      </div>

      <div className="flex gap-2" role="group" aria-label="Cara verifikasi">
        <Btn type="button" variant={method === 'whatsapp' ? 'primary' : 'ghost'} className="flex-1 py-2" onClick={() => setMethod('whatsapp')}>💬 WhatsApp OTP</Btn>
        <Btn type="button" variant={method === 'google' ? 'primary' : 'ghost'} className="flex-1 py-2" onClick={() => setMethod('google')}><GoogleIcon /> Login Google</Btn>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          Verifikasi gagal: {error}
          {remainingAttempts !== null && remainingAttempts > 0 && ` Sisa kesempatan: ${remainingAttempts} kali.`}
        </p>
      )}
      {info && !error && <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand" role="status">{info}</p>}

      {method === 'google' ? (
        <div className="space-y-3">
          {googleConfigured ? (
            <>
              <div className="flex justify-center">
                <div ref={googleBtnRef} aria-label="Login dengan Google" />
              </div>
              <p className="text-center text-xs text-mute">
                Login Google hanya dipakai untuk memastikan satu akun satu suara. Nama yang tampil di jawaban tetap mengikuti pilihan identitas Anda di langkah berikutnya.
              </p>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setError('Login Google belum dikonfigurasi. Isi VITE_GOOGLE_CLIENT_ID di file .env (lihat .env.example), lalu muat ulang aplikasi.')}
                className="flex w-full items-center justify-center gap-3 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-ground"
              >
                <GoogleIcon /> Lanjutkan dengan Google
              </button>
              <p className="text-center text-xs text-mute">
                Tombol Google belum aktif karena Client ID Google belum diatur. Sementara itu Anda bisa verifikasi lewat WhatsApp OTP.
              </p>
            </>
          )}
        </div>
      ) : otpStep === 'phone' ? (
        <div className="space-y-3">
          <Field label="Nomor WhatsApp" hint="Kode OTP 6 angka dikirim ke nomor ini. Contoh: 0812-3456-7890.">
            <div className="flex items-center gap-2">
              <span className="shrink-0 rounded-lg border border-line bg-ground px-3 py-2 text-sm font-semibold text-mute">+62</span>
              <input
                className={inputCls}
                inputMode="tel"
                autoComplete="tel"
                placeholder="812-3456-7890"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^0-9+\s-]/g, ''))}
              />
            </div>
          </Field>
          <Btn className="w-full py-2.5" disabled={sending} onClick={sendOtp}>
            {sending ? 'Mengirim kode…' : 'Kirim kode OTP'}
          </Btn>
          <p className="text-center text-xs text-mute">Dengan melanjutkan, Anda menyetujui nomor ini dipakai hanya untuk verifikasi voting ini.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <Field label="Kode OTP" hint={`Masukkan 6 angka yang dikirim ke ${maskPhone(normalizePhoneForDisplay(phone))}.`}>
            <input
              className={`${inputCls} text-center text-2xl font-bold tracking-[0.5em]`}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') verify()
              }}
            />
          </Field>
          <p className="text-center text-sm" aria-live="polite">
            {remainingSeconds > 0 ? (
              <span className="text-mute">Kode berlaku <b className="text-ink tabular-nums">{mmss}</b></span>
            ) : (
              <span className="font-medium text-red-700">Kode kedaluwarsa — minta kode baru di bawah.</span>
            )}
          </p>
          {devOtp && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status">
              {demoMode
                ? <>Mode demo — server verifikasi tidak terjangkau, kode OTP Anda: <b className="tabular-nums">{devOtp}</b>. Di production kode dikirim via WhatsApp.</>
                : <>Kode demo dari server (provider mock): <b className="tabular-nums">{devOtp}</b>. Aktifkan provider WhatsApp (mis. Fonnte) agar kode terkirim sungguhan.</>}
            </p>
          )}
          <Btn className="w-full py-2.5" disabled={verifying || remainingSeconds <= 0} onClick={verify}>
            {verifying ? 'Memverifikasi…' : 'Verifikasi kode'}
          </Btn>
          <div className="flex gap-2">
            <Btn type="button" variant="ghost" className="flex-1 py-2" onClick={() => { setOtpStep('phone'); setError(null); setInfo(null); setDevOtp(null) }}>← Ganti nomor</Btn>
            <Btn type="button" variant="ghost" className="flex-1 py-2" disabled={!canResend || sending} onClick={sendOtp}>
              {canResend ? 'Kirim ulang kode' : `Kirim ulang (${Math.ceil((resendAt - now) / 1000)} dtk)`}
            </Btn>
          </div>
        </div>
      )}
    </div>
  )
}

function normalizePhoneForDisplay(raw: string): string {
  const clean = raw.replace(/[^0-9]/g, '')
  if (clean.startsWith('0')) return '62' + clean.slice(1)
  if (clean.startsWith('8')) return '62' + clean
  return clean
}

export default function Public({ slug }: { slug: string }) {
  const { interactions, responses, submit } = useStore()
  const it = interactions.find((i) => i.slug === slug)
  const [voter, setVoter] = useState<VerifiedVoter | null>(() => loadVoter(slug))
  const [phase, setPhase] = useState<Phase>(() => {
    const found = interactions.find((i) => i.slug === slug)
    if (found?.kind !== 'vote') return 'isi'
    const v = loadVoter(slug)
    if (!v) return 'verifikasi'
    return responses.some((r) => r.iid === found.id && r.voterKey === v.key) ? 'sudah' : 'isi'
  })
  const [alreadyMsg, setAlreadyMsg] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [choice, setChoice] = useState('')
  const [msg, setMsg] = useState('')
  const [topic, setTopic] = useState('')
  const [identity, setIdentity] = useState<Identity>('nama')
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

  const isVote = it?.kind === 'vote'
  const multi = isMulti(it)
  const qs = flowQuestions(it)
  const hiddenCount = (it?.questions?.length ?? 0) - qs.length
  const answeredCount = qs.filter((q) => answers[q.id]).length
  const cur = qs[Math.min(step, Math.max(0, qs.length - 1))]
  const progressPct = qs.length ? Math.round((answeredCount / qs.length) * 100) : 0

  /** Respons sebelumnya dari voter yang sama di voting ini (bila ada). */
  const prevVote: Response | undefined =
    isVote && voter && it ? responses.find((r) => r.iid === it.id && r.voterKey === voter.key) : undefined
  /** Tampilkan layar "sudah voting" — baik dari fase 'sudah' maupun saat reset setelah terkirim. */
  const showAlready = isVote && !!voter && !!prevVote && phase !== 'terkirim'

  /** Pertanyaan pertama yang belum dijawab (untuk lompat & pesan). */
  const firstUnanswered = () => qs.findIndex((q) => !answers[q.id])

  const handleVerified = (v: VerifiedVoter) => {
    saveVoter(v)
    setVoter(v)
    setAlreadyMsg(null)
    if (it && responses.some((r) => r.iid === it.id && r.voterKey === v.key)) {
      setPhase('sudah')
    } else {
      setPhase('isi')
    }
  }

  const handleAlreadyVoted = (message: string) => {
    setAlreadyMsg(message)
    setPhase('sudah')
  }

  const changeVerification = () => {
    clearVoter()
    setVoter(null)
    setAlreadyMsg(null)
    setPhase('verifikasi')
  }

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
    const voterInfo = voter
      ? { voterKey: voter.key, verifiedVia: voter.method, verificationLabel: voter.label }
      : {}
    if (multi) submit({ iid: it.id, choice: multiSummary(qs, answers), choices: { ...answers }, ...sender, ...voterInfo, verificationToken: voter?.token })
    else if (it.kind === 'vote') submit({ iid: it.id, choice, ...sender, ...voterInfo, verificationToken: voter?.token })
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
                  {voter && phase === 'isi' && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700" role="status">
                      ✓ Terverifikasi · {voter.method === 'google' ? 'Google' : 'WhatsApp'} {voter.label}
                    </span>
                  )}
                </div>
                <h1 className="font-display text-3xl font-extrabold leading-tight">{it.title}</h1>
                <p className="text-mute">{it.description}</p>
                {voter && phase === 'isi' && (
                  <button type="button" className="text-xs font-semibold text-brand hover:underline" onClick={changeVerification}>
                    Ganti verifikasi
                  </button>
                )}
              </div>

              {closed ? (
                <p className="rounded-lg bg-ground p-4 text-sm font-medium text-mute">Interaksi ini sedang tidak aktif atau di luar periode.</p>
              ) : phase === 'verifikasi' ? (
                <VerificationGate slug={it.slug} onVerified={handleVerified} onAlreadyVoted={handleAlreadyVoted} />
              ) : showAlready || phase === 'sudah' ? (
                <div className="space-y-4 rounded-xl bg-amber-50 p-6 text-center">
                  <p className="font-display text-xl font-bold text-amber-800">Anda sudah pernah melakukan voting</p>
                  <p className="text-sm leading-relaxed text-amber-900/80">
                    {alreadyMsg ?? `${voter?.method === 'google' ? 'Akun Google' : 'Nomor WhatsApp'} ${voter?.label ?? ''} sudah pernah digunakan untuk mengisi voting ini. Setiap akun/nomor hanya dapat mengisi satu kali.`}
                  </p>
                  {prevVote && (
                    <dl className="space-y-1.5 rounded-xl bg-white/70 p-4 text-left text-sm">
                      <div className="flex justify-between gap-4">
                        <dt className="text-mute">Pilihan Anda</dt>
                        <dd className="text-right font-semibold">{prevVote.choice}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-mute">Waktu</dt>
                        <dd className="text-right font-semibold">{fmtDate(prevVote.at)}</dd>
                      </div>
                    </dl>
                  )}
                  <Btn variant="ghost" onClick={changeVerification}>Verifikasi dengan akun/nomor lain</Btn>
                </div>
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
                    {voter && (
                      <div className="flex justify-between gap-4">
                        <dt className="shrink-0 font-semibold text-mute">Terverifikasi</dt>
                        <dd className="text-right font-semibold">{voter.method === 'google' ? 'Google' : 'WhatsApp'} · {voter.label}</dd>
                      </div>
                    )}
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
