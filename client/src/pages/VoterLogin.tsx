import { useEffect, useRef, useState } from 'react'
import { useStore } from '../services/store'
import { initGoogleSignIn, isGoogleConfigured } from '../services/googleAuth'
import {
  loadIdentities,
  maskPhone,
  normalizePhone,
  requestOtp,
  saveIdentity,
  validatePhone,
  verifyOtp,
  type VerifiedVoter,
} from '../services/otpService'
import { Btn, Card, Field, Logo, inputCls } from '../components/ui'

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
 * Layar login dashboard pengisi (`#/riwayat`): masuk dengan Google atau
 * nomor WhatsApp OTP, dengan mode Masuk / Daftar seperti halaman login
 * utama (`Auth.tsx`).
 *
 * - Mode Masuk: identitas harus sudah dikenal di perangkat ini — tersimpan
 *   sebagai identitas terverifikasi, atau ada kiriman lokal (`voterKey`)
 *   atas namanya. Bila tidak ada, pengguna diarahkan ke mode Daftar.
 * - Mode Daftar: verifikasi yang sama, lalu identitas baru dibuat dan
 *   disimpan — kiriman lama di perangkat ini yang memakai `voterKey`
 *   yang sama langsung ikut tampil di riwayat (tidak mulai dari 0).
 *
 * OTP WhatsApp memakai endpoint backend per-link
 * (`POST /public/{slug}/otp/send|verify`), jadi dipakai slug link aktif
 * pertama yang mau mengirim kode. Bila nomor itu sudah pernah mengisi
 * link tersebut, backend menjawab 409 dan slug aktif berikutnya dicoba;
 * bila semua link aktif menolak (atau tidak ada link aktif), pengguna
 * diarahkan masuk dengan Google. Slug yang berhasil dipakai untuk kirim
 * harus dipakai juga untuk verifikasi, karena kode OTP terikat pada link
 * itu. Bila server tidak terjangkau, `requestOtp` beralih ke mode demo
 * berlabel jelas, sama seperti gerbang verifikasi di halaman publik.
 */
export default function VoterLogin({ onLoggedIn, onCancel }: {
  onLoggedIn: (v: VerifiedVoter) => void
  onCancel?: () => void
}) {
  const { interactions, responses } = useStore()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [method, setMethod] = useState<'whatsapp' | 'google'>('whatsapp')
  const [name, setName] = useState('')
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
  const [usedSlug, setUsedSlug] = useState('')
  const googleBtnRef = useRef<HTMLDivElement>(null)
  const googleConfigured = isGoogleConfigured()

  // State terbaru untuk callback Google (efek GIS tidak di-init ulang
  // setiap kali mode/responses berubah).
  const latestRef = useRef({ mode, responses })
  latestRef.current = { mode, responses }

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
      if (err) {
        setError(err)
        return
      }
      if (!profile) return
      const v: VerifiedVoter = {
        method: 'google',
        key: `google:${profile.googleId}`,
        label: profile.email,
        verifiedAt: new Date().toISOString(),
        slug: '',
      }
      const { mode: m, responses: rs } = latestRef.current
      if (m === 'login' && !identityKnown(v.key, rs)) {
        setError('Akun Google ini belum terdaftar sebagai pengisi di perangkat ini. Silakan daftar dulu sebagai pengisi baru.')
        return
      }
      finishLogin(v)
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
    // finishLogin & identityKnown stabil (hanya setState + localStorage).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, googleConfigured])

  /** Identitas dikenal bila tersimpan, atau ada kiriman lokal atas namanya. */
  function identityKnown(key: string, rs: typeof responses) {
    return loadIdentities().some((v) => v.key === key) || rs.some((r) => r.voterKey === key)
  }

  function finishLogin(v: VerifiedVoter) {
    saveIdentity(v)
    setError(null)
    onLoggedIn(v)
  }

  const remainingSeconds = Math.max(0, Math.floor((expiresAt - now) / 1000))
  const mmss = `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, '0')}`
  const canResend = now >= resendAt

  const sendOtp = async () => {
    const check = validatePhone(phone)
    if (!check.phone) {
      setError(check.error ?? 'Nomor WhatsApp tidak valid.')
      return
    }
    const slugs = interactions.filter((i) => i.active).map((i) => i.slug)
    if (slugs.length === 0) {
      setError('Tidak ada link aktif saat ini untuk mengirim kode OTP. Masuk dengan akun Google untuk melihat riwayat Anda.')
      return
    }
    setSending(true)
    setError(null)
    setInfo(null)
    for (const slug of slugs) {
      const res = await requestOtp(slug, check.phone)
      if (res.ok) {
        setSending(false)
        setUsedSlug(slug)
        setOtpStep('code')
        setCode('')
        setExpiresAt(Date.now() + (res.expiresInSeconds ?? 300) * 1000)
        setResendAt(Date.now() + 60_000)
        setRemainingAttempts(null)
        setDevOtp(res.devOtp ?? null)
        setDemoMode(!!res.demo)
        setInfo(`Kode OTP dikirim ke ${maskPhone(check.phone)}. Kode berlaku 5 menit.`)
        return
      }
      // 409 = nomor ini sudah pernah mengisi link itu, jadi link itu tidak
      // mau mengirim kode lagi — coba link aktif berikutnya.
      if (!res.alreadyVoted) {
        setSending(false)
        setError(res.error ?? 'Gagal mengirim kode OTP.')
        return
      }
    }
    setSending(false)
    setError('Nomor ini sudah pernah mengisi semua link aktif, jadi kode OTP tidak bisa dikirim lewat link mana pun. Masuk dengan akun Google untuk melihat riwayat Anda.')
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
    if (!usedSlug) {
      setError('Minta kode OTP baru dulu sebelum memverifikasi.')
      return
    }
    setVerifying(true)
    setError(null)
    const res = await verifyOtp(usedSlug, check.phone, code)
    setVerifying(false)
    if (!res.ok) {
      setRemainingAttempts(res.remainingAttempts ?? null)
      setError(res.error ?? 'Verifikasi OTP gagal.')
      return
    }
    const v: VerifiedVoter = {
      method: 'whatsapp',
      key: `wa:${check.phone}`,
      label: mode === 'register' && name.trim() ? name.trim() : maskPhone(check.phone),
      token: res.verificationToken,
      verifiedAt: new Date().toISOString(),
      slug: usedSlug,
    }
    if (mode === 'login' && !identityKnown(v.key, responses)) {
      setError('Nomor WhatsApp ini belum terdaftar sebagai pengisi di perangkat ini. Silakan daftar dulu sebagai pengisi baru.')
      return
    }
    finishLogin(v)
  }

  const switchMode = (m: 'login' | 'register') => {
    setMode(m)
    setError(null)
    setInfo(null)
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <Card className="space-y-5 p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand">
            {mode === 'login' ? 'Masuk dashboard pengisi' : 'Daftar sebagai pengisi'}
          </p>
          <h2 className="font-display text-2xl font-extrabold">
            {mode === 'login' ? 'Masuk ke Riwayat Saya' : 'Buat akun pengisi'}
          </h2>
          <p className="mt-1 text-sm text-mute">
            {mode === 'login'
              ? 'Masuk dengan akun Google atau nomor WhatsApp yang pernah Anda pakai mengisi link — riwayat voting, kritik & saran, dan balasan yang sudah ada akan tampil lagi.'
              : 'Daftar dengan akun Google atau nomor WhatsApp. Setelah itu setiap link yang Anda isi dengan identitas ini tercatat di Riwayat Saya beserta status & balasannya.'}
          </p>
        </div>

        <div className="flex gap-2" role="group" aria-label="Cara masuk">
          <Btn type="button" variant={method === 'whatsapp' ? 'primary' : 'ghost'} className="flex-1 py-2" onClick={() => setMethod('whatsapp')}>💬 WhatsApp OTP</Btn>
          <Btn type="button" variant={method === 'google' ? 'primary' : 'ghost'} className="flex-1 py-2" onClick={() => setMethod('google')}><GoogleIcon /> Login Google</Btn>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
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
                  {mode === 'register'
                    ? 'Akun Google yang belum terdaftar otomatis dibuatkan identitas pengisi baru.'
                    : 'Login Google hanya dipakai untuk mengenali identitas Anda dan menampilkan riwayatnya.'}
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
                  Tombol Google belum aktif karena Client ID Google belum diatur. Sementara itu Anda bisa masuk lewat WhatsApp OTP.
                </p>
              </>
            )}
          </div>
        ) : otpStep === 'phone' ? (
          <div className="space-y-3">
            {mode === 'register' && (
              <Field label="Nama Anda" hint="Ditampilkan sebagai nama di dashboard pengisi. Boleh dikosongkan — nomor tersamarkan yang tampil.">
                <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="cth. Wati" />
              </Field>
            )}
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
            <Btn type="button" className="w-full py-2.5" disabled={sending} onClick={sendOtp}>
              {sending ? 'Mengirim kode…' : 'Kirim kode OTP'}
            </Btn>
            <p className="text-center text-xs text-mute">Nomor ini dipakai hanya untuk verifikasi identitas pengisi, bukan untuk menampilkan nomor Anda ke pemilik link.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="Kode OTP" hint={`Masukkan 6 angka yang dikirim ke ${maskPhone(normalizePhone(phone))}.`}>
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
            <Btn type="button" className="w-full py-2.5" disabled={verifying || remainingSeconds <= 0} onClick={verify}>
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

        <p className="text-center text-sm text-mute">
          {mode === 'login' ? 'Belum punya akun pengisi?' : 'Sudah punya akun pengisi?'}{' '}
          <button type="button" className="font-semibold text-brand hover:underline" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Daftar sekarang' : 'Masuk'}
          </button>
        </p>
        <p className="text-center text-sm">
          {onCancel
            ? <button type="button" className="font-semibold text-brand hover:underline" onClick={onCancel}>← Kembali ke dashboard</button>
            : <a href="#/" className="font-semibold text-brand hover:underline">← Kembali ke beranda</a>}
        </p>
      </Card>
      <p className="mt-4 flex items-center justify-center gap-2 text-xs text-mute"><Logo size={20} /><span>Forafa-App · Dashboard Pengisi</span></p>
    </div>
  )
}
